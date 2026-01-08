/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import * as vscode from 'vscode';
import { frontmatterSchema } from './frontmatterSchema';
import { performanceLogger } from './performanceLogger';

interface SchemaProperty {
    type?: string;
    description?: string;
    properties?: { [key: string]: SchemaProperty };
    items?: SchemaProperty;
    enum?: readonly string[] | string[];
    $ref?: string;
    additionalProperties?: boolean | SchemaProperty;
    [key: string]: unknown;
}

interface FrontmatterSchema {
    properties: { [key: string]: SchemaProperty };
    definitions: { [key: string]: SchemaProperty };
    metadata: {
        lifecycleStates: {
            values: Array<{ key: string; description: string }>;
        };
        knownKeys: {
            keys: string[];
        };
    };
}

interface ValidationError {
    range: vscode.Range;
    message: string;
    severity: vscode.DiagnosticSeverity;
    code?: string;
}

export class FrontmatterValidationProvider {
    private schema: FrontmatterSchema;
    private readonly FRONTMATTER_START = /^---\s*$/;
    private readonly FRONTMATTER_END = /^---\s*$/;
    
    // Lifecycle states for validation (excluding 'all' which is only valid with a lifecycle state)
    private readonly LIFECYCLE_STATES = [
        'ga', 'preview', 'beta', 'deprecated', 'removed', 
        'unavailable', 'planned', 'development', 'discontinued'
    ];
    
    // Single lifecycle entry pattern (supports all version specifier formats):
    // - Greater than or equal (default): x.x, x.x+, x.x.x, x.x.x+
    // - Range: x.x-y.y, x.x.x-y.y.y
    // - Exact: =x.x, =x.x.x
    // - All: all
    private readonly SINGLE_ENTRY_PATTERN = /^(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)(\s+(all|=[0-9]+(\.[0-9]+)*|[0-9]+(\.[0-9]+)*-[0-9]+(\.[0-9]+)*|[0-9]+(\.[0-9]+)*\+?))?$/;
    
    // Pattern to detect implicit version (x.x without + or =) for hint
    private readonly IMPLICIT_VERSION_PATTERN = /^(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)\s+[0-9]+(\.[0-9]+)*$/;

    constructor() {
        this.schema = frontmatterSchema as unknown as FrontmatterSchema;
    }

    public validateDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
        return performanceLogger.measureSync(
            'FrontmatterValidation.validateDocument',
            () => {
                const frontmatterRange = this.getFrontmatterRange(document);
                if (!frontmatterRange) {
                    return [];
                }

                const errors: ValidationError[] = [];
                
                try {
                    const frontmatterText = document.getText(frontmatterRange);
                    const lines = frontmatterText.split('\n').slice(1, -1); // Remove --- markers
                    
                    // Parse YAML and validate structure
                    const yamlData = this.parseYamlForValidation(lines, frontmatterRange.start.line + 1);
                    
                    // Validate against schema
                    this.validateFrontmatterData(yamlData, errors, document, frontmatterRange.start.line + 1);
                    
                } catch (error) {
                    // YAML parsing error
                    errors.push({
                        range: frontmatterRange,
                        message: `Invalid YAML syntax: ${error}`,
                        severity: vscode.DiagnosticSeverity.Error,
                        code: 'yaml_syntax_error'
                    });
                }

                // Convert validation errors to diagnostics
                return errors.map(error => {
                    const diagnostic = new vscode.Diagnostic(error.range, error.message, error.severity);
                    if (error.code) {
                        diagnostic.code = error.code;
                    }
                    diagnostic.source = 'Elastic Docs Frontmatter';
                    return diagnostic;
                });
            },
            { fileName: document.fileName }
        );
    }

    private getFrontmatterRange(document: vscode.TextDocument): vscode.Range | null {
        if (document.lineCount < 2) return null;

        // Check if document starts with frontmatter
        if (!this.FRONTMATTER_START.test(document.lineAt(0).text)) {
            return null;
        }

        // Find the end of frontmatter
        for (let i = 1; i < document.lineCount; i++) {
            if (this.FRONTMATTER_END.test(document.lineAt(i).text)) {
                return new vscode.Range(0, 0, i, 0);
            }
        }

        return null;
    }

    private parseYamlForValidation(lines: string[], _startLine: number): Record<string, unknown> {
        return performanceLogger.measureSync(
            'FrontmatterValidation.parseYaml',
            () => {
                const result: Record<string, unknown> = {};
                const stack: Array<{ obj: Record<string, unknown>; indent: number }> = [{ obj: result, indent: -1 }];
                
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    
                    if (!line.trim()) {
                        continue;
                    }
                    
                    const indent = line.length - line.trimStart().length;
                    const trimmed = line.trim();
                    
                    // Pop stack until we find the right parent
                    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
                        stack.pop();
                    }
                    
                    const parent = stack[stack.length - 1].obj;
                    
                    if (trimmed.startsWith('- ')) {
                        // Array item - need to find the parent field and ensure it's an array
                        const itemContent = trimmed.substring(2).trim();
                        
                        // We need to look in the parent of the current stack frame
                        // The array items should be added to the parent that contains the field name
                        let arrayParent = null;
                        let arrayKey = null;
                        
                        // Walk up the stack to find where to put this array item
                        for (let stackIdx = stack.length - 1; stackIdx >= 0; stackIdx--) {
                            const stackFrame = stack[stackIdx];
                            const keys = Object.keys(stackFrame.obj);
                            
                            for (let j = keys.length - 1; j >= 0; j--) {
                                const key = keys[j];
                                const value = stackFrame.obj[key];

                                if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value as object).length === 0) {
                                    // This empty object should be converted to an array
                                    stackFrame.obj[key] = [];
                                    arrayParent = stackFrame.obj;
                                    arrayKey = key;
                                    break;
                                } else if (Array.isArray(value)) {
                                    // Already an array
                                    arrayParent = stackFrame.obj;
                                    arrayKey = key;
                                    break;
                                }
                            }
                            
                            if (arrayKey) break;
                        }
                        
                        if (arrayKey && arrayParent && Array.isArray(arrayParent[arrayKey])) {
                            if (itemContent.includes(':')) {
                                // Object in array - parse key-value pairs
                                const obj: Record<string, unknown> = {};
                                const colonIndex = itemContent.indexOf(':');
                                const objKey = itemContent.substring(0, colonIndex).trim();
                                const objValue = itemContent.substring(colonIndex + 1).trim();

                                if (objValue !== '') {
                                    obj[objKey] = this.parseValue(objValue);
                                } else {
                                    obj[objKey] = '';
                                }

                                (arrayParent[arrayKey] as unknown[]).push(obj);
                                stack.push({ obj, indent });
                            } else {
                                // Simple value in array
                                (arrayParent[arrayKey] as unknown[]).push(itemContent);
                            }
                        }
                    } else if (trimmed.includes(':')) {
                        // Key-value pair
                        const colonIndex = trimmed.indexOf(':');
                        const key = trimmed.substring(0, colonIndex).trim();
                        const value = trimmed.substring(colonIndex + 1).trim();
                        
                        if (value === '') {
                            // Object or array
                            parent[key] = {};
                            stack.push({ obj: parent[key] as Record<string, unknown>, indent });
                        } else {
                            // Simple value
                            parent[key] = this.parseValue(value);
                        }
                    }
                }
                
                return result;
            },
            { lineCount: lines.length }
        );
    }

    private getLastArrayKey(obj: Record<string, unknown>): string | null {
        const keys = Object.keys(obj);
        for (let i = keys.length - 1; i >= 0; i--) {
            if (Array.isArray(obj[keys[i]])) {
                return keys[i];
            }
        }
        return null;
    }

    private parseValue(value: string): string | number | boolean | null {
        // Remove quotes
        const unquoted = value.replace(/^["']|["']$/g, '');
        
        // Try to parse as number
        const num = Number(unquoted);
        if (!isNaN(num)) {
            return num;
        }
        
        // Return as string
        return unquoted;
    }

    private validateFrontmatterData(data: Record<string, unknown>, errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {

        // Check for required fields
        this.validateRequiredFields(data, errors, document, startLine);
        
        // Validate each field
        for (const [fieldName, fieldValue] of Object.entries(data)) {
            this.validateField(fieldName, fieldValue, [], errors, document, startLine);
        }

        // Validate applies_to specifically
        if (data.applies_to) {
            this.validateAppliesTo(data.applies_to, errors, document, startLine);
        }

        // Validate products array
        if (data.products && Array.isArray(data.products)) {
            this.validateProducts(data.products, errors, document, startLine);
        }
    }

    private validateRequiredFields(data: Record<string, unknown>, errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {
        // applies_to is mandatory according to schema
        if (!data.applies_to) {
            const range = new vscode.Range(startLine, 0, startLine, 0);
            errors.push({
                range,
                message: 'Missing required field: applies_to',
                severity: vscode.DiagnosticSeverity.Error,
                code: 'missing_required_field'
            });
        }
    }

    private validateField(fieldName: string, fieldValue: unknown, path: string[], errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {

        const fieldSchema = this.getFieldSchema(fieldName, path);
        if (!fieldSchema) {
            // Unknown field warning
            const fieldRange = this.findFieldRange(fieldName, document, startLine);
            if (fieldRange) {
                errors.push({
                    range: fieldRange,
                    message: `Unknown field: ${fieldName}`,
                    severity: vscode.DiagnosticSeverity.Warning,
                    code: 'unknown_field'
                });
            }
            return;
        }

        // Validate based on field type
        if (fieldSchema.type === 'string') {
            if (typeof fieldValue !== 'string') {
                const valueRange = this.findValueRange(fieldName, document, startLine);
                if (valueRange) {
                    errors.push({
                        range: valueRange,
                        message: `Expected string value for field: ${fieldName}`,
                        severity: vscode.DiagnosticSeverity.Error,
                        code: 'type_error'
                    });
                }
            }
        } else if (fieldSchema.type === 'array') {
            if (!Array.isArray(fieldValue)) {
                const valueRange = this.findValueRange(fieldName, document, startLine);
                if (valueRange) {
                    errors.push({
                        range: valueRange,
                        message: `Expected array value for field: ${fieldName}`,
                        severity: vscode.DiagnosticSeverity.Error,
                        code: 'type_error'
                    });
                }
            }
        }

        // Validate enum values
        if (fieldSchema.enum && Array.isArray(fieldSchema.enum)) {
            if (!fieldSchema.enum.includes(fieldValue as string)) {
                const valueRange = this.findValueRange(fieldName, document, startLine);
                if (valueRange) {
                    errors.push({
                        range: valueRange,
                        message: `Invalid value '${fieldValue}' for field '${fieldName}'. Expected one of: ${fieldSchema.enum.join(', ')}`,
                        severity: vscode.DiagnosticSeverity.Error,
                        code: 'invalid_enum_value'
                    });
                }
            }
        }

        // Validate string length
        if (fieldSchema.maxLength && typeof fieldValue === 'string' && fieldValue.length > fieldSchema.maxLength) {
            const valueRange = this.findValueRange(fieldName, document, startLine);
            if (valueRange) {
                errors.push({
                    range: valueRange,
                    message: `Field '${fieldName}' exceeds maximum length of ${fieldSchema.maxLength} characters`,
                    severity: vscode.DiagnosticSeverity.Warning,
                    code: 'max_length_exceeded'
                });
            }
        }
    }

    private validateAppliesTo(appliesTo: unknown, errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {
        if (typeof appliesTo !== 'object' || appliesTo === null) {
            return;
        }

        const knownKeys = this.schema.metadata.knownKeys.keys;

        for (const [key, value] of Object.entries(appliesTo as Record<string, unknown>)) {
            // Validate known keys
            if (!knownKeys.includes(key)) {
                const keyRange = this.findFieldRange(key, document, startLine);
                if (keyRange) {
                    errors.push({
                        range: keyRange,
                        message: `Unknown applies_to key: ${key}. Valid keys: ${knownKeys.join(', ')}`,
                        severity: vscode.DiagnosticSeverity.Warning,
                        code: 'unknown_applies_key'
                    });
                }
            }

            // Validate lifecycle values
            if (typeof value === 'string') {
                this.validateLifecycleValue(key, value, errors, document, startLine);
            } else if (typeof value === 'object' && value !== null) {
                // Nested object (like deployment/serverless)
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    // Validate nested keys based on parent context
                    this.validateNestedAppliesKey(key, nestedKey, errors, document, startLine);
                    
                    if (typeof nestedValue === 'string') {
                        this.validateLifecycleValue(`${key}.${nestedKey}`, nestedValue, errors, document, startLine);
                    }
                }
            }
        }
    }

    private validateNestedAppliesKey(parentKey: string, nestedKey: string, errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {
        let validNestedKeys: string[] = [];
        
        switch (parentKey) {
            case 'deployment':
                // Get keys from deploymentApplicability definition in schema
                const deploymentDef = this.schema.definitions.deploymentApplicability;
                if (deploymentDef && deploymentDef.properties) {
                    validNestedKeys = Object.keys(deploymentDef.properties);
                }
                break;
            case 'serverless':
                // Get keys from serverlessProjectApplicability definition in schema
                const serverlessDef = this.schema.definitions.serverlessProjectApplicability;
                if (serverlessDef && serverlessDef.properties) {
                    validNestedKeys = Object.keys(serverlessDef.properties);
                }
                break;
            case 'product':
                // For product objects, validate against individual product keys from schema
                validNestedKeys = this.schema.metadata.knownKeys.keys.filter(key => 
                    !['stack', 'deployment', 'serverless', 'product'].includes(key)
                );
                break;
            default:
                return; // Don't validate other nested contexts
        }
        
        if (!validNestedKeys.includes(nestedKey)) {
            const keyRange = this.findFieldRange(nestedKey, document, startLine);
            if (keyRange) {
                errors.push({
                    range: keyRange,
                    message: `Unknown ${parentKey} key: ${nestedKey}. Valid keys: ${validNestedKeys.join(', ')}`,
                    severity: vscode.DiagnosticSeverity.Warning,
                    code: 'unknown_nested_key'
                });
            }
        }
    }

    private validateLifecycleValue(fieldPath: string, value: string, errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {
        // Check if it's a simple lifecycle state
        if (this.LIFECYCLE_STATES.includes(value)) {
            return;
        }

        // Check if it's just "all" by itself (invalid)
        if (value === 'all') {
            const valueRange = this.findValueRange(fieldPath.split('.').pop()!, document, startLine);
            if (valueRange) {
                errors.push({
                    range: valueRange,
                    message: `Invalid lifecycle value '${value}'. 'all' must be preceded by a lifecycle state (e.g., 'ga all', 'beta all')`,
                    severity: vscode.DiagnosticSeverity.Error,
                    code: 'invalid_lifecycle_value'
                });
            }
            return;
        }

        // Split by comma and validate each entry individually
        const entries = value.split(',').map(e => e.trim());
        let allEntriesValid = true;

        for (const entry of entries) {
            if (!this.SINGLE_ENTRY_PATTERN.test(entry)) {
                allEntriesValid = false;
                break;
            }
        }

        if (allEntriesValid) {
            // Valid syntax - now run semantic validations
            this.validateAppliesSemantics(fieldPath, value, errors, document, startLine);
            return;
        }

        // Invalid lifecycle value
        const valueRange = this.findValueRange(fieldPath.split('.').pop()!, document, startLine);
        if (valueRange) {
            errors.push({
                range: valueRange,
                message: `Invalid lifecycle value '${value}'. Expected format: 'state', 'state version', 'state version+', 'state =version', 'state x.x-y.y', or 'state all'`,
                severity: vscode.DiagnosticSeverity.Error,
                code: 'invalid_lifecycle_value'
            });
        }
    }

    /**
     * Semantic validation for applies_to values
     * Checks for: implicit versions (hint), multiple unbound values, overlapping ranges, invalid ranges
     */
    private validateAppliesSemantics(fieldPath: string, value: string, errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {
        const entries = value.split(',').map(e => e.trim());
        const parsedEntries: Array<{
            originalEntry: string;
            lifecycle: string;
            versionSpec: string | null;
            isRange: boolean;
            isExact: boolean;
            isUnbound: boolean;
            startVersion: number[] | null;
            endVersion: number[] | null;
        }> = [];

        for (const entry of entries) {
            const parsed = this.parseVersionEntry(entry);
            if (parsed) {
                parsedEntries.push({ ...parsed, originalEntry: entry });
            }
        }

        const valueRange = this.findValueRange(fieldPath.split('.').pop()!, document, startLine);
        if (!valueRange) return;

        // Check for implicit version syntax (hint)
        // Count how many entries use implicit syntax vs explicit syntax
        const implicitEntries = entries.filter(e => this.IMPLICIT_VERSION_PATTERN.test(e));
        const hasImplicitEntries = implicitEntries.length > 0;
        const allEntriesImplicit = implicitEntries.length === entries.filter(e => {
            // Count entries that have versions (not just lifecycle state alone)
            const parts = e.trim().split(/\s+/);
            return parts.length > 1 && parts[1] !== 'all';
        }).length;

        if (hasImplicitEntries) {
            if (allEntriesImplicit && entries.length > 1) {
                // All versioned entries are implicit - suggest using explicit ranges
                errors.push({
                    range: valueRange,
                    message: `Consider using explicit version ranges for clarity. Example: 'preview 9.4-10.9, ga 11.0-12.2, removed 12.3+' instead of inferring ranges.`,
                    severity: vscode.DiagnosticSeverity.Hint,
                    code: 'implicit_version_syntax'
                });
            } else {
                // Some entries are implicit, some explicit - suggest being consistent
                errors.push({
                    range: valueRange,
                    message: `Consider using explicit syntax: Use '+' for "and later" (e.g., 'ga 9.1+') or '=' for exact version (e.g., 'ga =9.1')`,
                    severity: vscode.DiagnosticSeverity.Hint,
                    code: 'implicit_version_syntax'
                });
            }
        }

        // Check for multiple unbound values (warning)
        // Skip this check if all entries use implicit syntax (the system will infer ranges)
        const unboundEntries = parsedEntries.filter(e => e.isUnbound && e.startVersion);
        if (unboundEntries.length > 1 && !allEntriesImplicit) {
            errors.push({
                range: valueRange,
                message: `Only one entry per key can use the greater-than syntax. Found ${unboundEntries.length} unbound entries.`,
                severity: vscode.DiagnosticSeverity.Warning,
                code: 'multiple_unbound_versions'
            });
        }

        // Check for invalid ranges (min > max)
        for (const entry of parsedEntries) {
            if (entry.isRange && entry.startVersion && entry.endVersion) {
                if (this.compareVersions(entry.startVersion, entry.endVersion) > 0) {
                    errors.push({
                        range: valueRange,
                        message: `Invalid version range: the first version must be less than or equal to the second version`,
                        severity: vscode.DiagnosticSeverity.Warning,
                        code: 'invalid_version_range'
                    });
                }
            }
        }

        // Check for 'removed' with exact version as the last state
        // This is usually a mistake - once removed, features typically stay removed
        const removedExactEntries = parsedEntries.filter(e => 
            e.lifecycle === 'removed' && e.isExact && e.startVersion
        );
        if (removedExactEntries.length > 0) {
            // Find the highest version among all entries
            const allVersions = parsedEntries
                .filter(e => e.startVersion)
                .map(e => ({ version: e.endVersion || e.startVersion, entry: e }))
                .filter(v => v.version !== null) as Array<{ version: number[]; entry: typeof parsedEntries[0] }>;
            
            if (allVersions.length > 0) {
                const highestEntry = allVersions.reduce((max, curr) => 
                    this.compareVersions(curr.version, max.version) > 0 ? curr : max
                );
                
                // If the highest version is a 'removed' with exact syntax
                if (highestEntry.entry.lifecycle === 'removed' && highestEntry.entry.isExact) {
                    const version = highestEntry.entry.startVersion!.join('.');
                    errors.push({
                        range: valueRange,
                        message: `'removed =${version}' means removed only in version ${version}. If the feature stays removed, use 'removed ${version}+' instead.`,
                        severity: vscode.DiagnosticSeverity.Hint,
                        code: 'removed_exact_version'
                    });
                }
            }
        }

        // Check for overlapping versions (warning)
        // Skip overlap check if all entries use implicit syntax (the system will infer ranges)
        if (parsedEntries.length > 1 && !allEntriesImplicit) {
            const overlap = this.findOverlappingEntries(parsedEntries);
            if (overlap) {
                const [entry1, entry2, overlapVersion] = overlap;
                errors.push({
                    range: valueRange,
                    message: `Overlapping versions: '${entry1}' and '${entry2}' both cover version ${overlapVersion}. A version cannot be in multiple lifecycle states.`,
                    severity: vscode.DiagnosticSeverity.Warning,
                    code: 'overlapping_versions'
                });
            }
        }
    }

    /**
     * Parse a single lifecycle entry into structured format
     */
    private parseVersionEntry(entry: string): {
        lifecycle: string;
        versionSpec: string | null;
        isRange: boolean;
        isExact: boolean;
        isUnbound: boolean;
        startVersion: number[] | null;
        endVersion: number[] | null;
    } | null {
        const parts = entry.trim().split(/\s+/);
        if (parts.length === 0) return null;

        const lifecycle = parts[0];
        if (!this.LIFECYCLE_STATES.includes(lifecycle)) return null;

        if (parts.length === 1) {
            // Just lifecycle, no version
            return {
                lifecycle,
                versionSpec: null,
                isRange: false,
                isExact: false,
                isUnbound: true, // No version means "all versions"
                startVersion: null,
                endVersion: null
            };
        }

        const versionSpec = parts[1];

        // Check for 'all'
        if (versionSpec === 'all') {
            return {
                lifecycle,
                versionSpec: 'all',
                isRange: false,
                isExact: false,
                isUnbound: true,
                startVersion: null,
                endVersion: null
            };
        }

        // Check for exact version (=x.x)
        if (versionSpec.startsWith('=')) {
            const version = this.parseVersion(versionSpec.substring(1));
            return {
                lifecycle,
                versionSpec,
                isRange: false,
                isExact: true,
                isUnbound: false,
                startVersion: version,
                endVersion: version
            };
        }

        // Check for range (x.x-y.y)
        if (versionSpec.includes('-')) {
            const rangeParts = versionSpec.split('-');
            if (rangeParts.length === 2) {
                const startVersion = this.parseVersion(rangeParts[0]);
                const endVersion = this.parseVersion(rangeParts[1]);
                return {
                    lifecycle,
                    versionSpec,
                    isRange: true,
                    isExact: false,
                    isUnbound: false,
                    startVersion,
                    endVersion
                };
            }
        }

        // Greater than or equal (x.x or x.x+)
        const versionStr = versionSpec.endsWith('+') ? versionSpec.slice(0, -1) : versionSpec;
        const version = this.parseVersion(versionStr);
        return {
            lifecycle,
            versionSpec,
            isRange: false,
            isExact: false,
            isUnbound: true, // Greater-than-or-equal is unbound
            startVersion: version,
            endVersion: null // Infinity
        };
    }

    /**
     * Parse a version string into an array of numbers
     */
    private parseVersion(versionStr: string): number[] | null {
        if (!versionStr) return null;
        const parts = versionStr.split('.').map(p => parseInt(p, 10));
        if (parts.some(isNaN)) return null;
        return parts;
    }

    /**
     * Compare two version arrays
     * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
     */
    private compareVersions(v1: number[], v2: number[]): number {
        const maxLen = Math.max(v1.length, v2.length);
        for (let i = 0; i < maxLen; i++) {
            const p1 = v1[i] || 0;
            const p2 = v2[i] || 0;
            if (p1 < p2) return -1;
            if (p1 > p2) return 1;
        }
        return 0;
    }

    /**
     * Find overlapping entries and return details about the overlap
     * Returns: [entry1, entry2, overlapping version] or null if no overlap
     */
    private findOverlappingEntries(entries: Array<{
        originalEntry: string;
        isRange: boolean;
        isExact: boolean;
        isUnbound: boolean;
        startVersion: number[] | null;
        endVersion: number[] | null;
    }>): [string, string, string] | null {
        for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
                const overlapVersion = this.getOverlapVersion(entries[i], entries[j]);
                if (overlapVersion) {
                    return [entries[i].originalEntry, entries[j].originalEntry, overlapVersion];
                }
            }
        }
        return null;
    }

    /**
     * Get the overlapping version between two entries, or null if no overlap
     */
    private getOverlapVersion(a: {
        isRange: boolean;
        isExact: boolean;
        isUnbound: boolean;
        startVersion: number[] | null;
        endVersion: number[] | null;
    }, b: {
        isRange: boolean;
        isExact: boolean;
        isUnbound: boolean;
        startVersion: number[] | null;
        endVersion: number[] | null;
    }): string | null {
        // If either has no version info, can't determine overlap
        if (!a.startVersion || !b.startVersion) return null;

        // For unbound entries (x.x+), they extend to infinity
        const aEnd = a.isUnbound ? [99999, 99999, 99999] : (a.endVersion || a.startVersion);
        const bEnd = b.isUnbound ? [99999, 99999, 99999] : (b.endVersion || b.startVersion);

        // Check if ranges overlap: a.start <= b.end AND b.start <= a.end
        const aStartLeBEnd = this.compareVersions(a.startVersion, bEnd) <= 0;
        const bStartLeAEnd = this.compareVersions(b.startVersion, aEnd) <= 0;

        if (aStartLeBEnd && bStartLeAEnd) {
            // Find the overlapping version - it's the maximum of the two start versions
            // (the point where both ranges begin to cover)
            const overlapStart = this.compareVersions(a.startVersion, b.startVersion) >= 0 
                ? a.startVersion 
                : b.startVersion;
            return overlapStart.join('.');
        }

        return null;
    }

    private validateProducts(products: unknown[], errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {
        // Get valid product IDs from schema
        const productsSchema = this.schema.properties.products;
        const validProductIds: string[] = [];
        
        if (productsSchema && productsSchema.items && productsSchema.items.properties && productsSchema.items.properties.id && productsSchema.items.properties.id.enum) {
            validProductIds.push(...productsSchema.items.properties.id.enum);
        }

        for (let i = 0; i < products.length; i++) {
            const product = products[i];

            if (typeof product !== 'object' || product === null || !('id' in product)) {
                const productRange = this.findArrayItemRange('products', i, document, startLine);
                if (productRange) {
                    errors.push({
                        range: productRange,
                        message: 'Product item must be an object with an "id" field',
                        severity: vscode.DiagnosticSeverity.Error,
                        code: 'invalid_product_format'
                    });
                }
                continue;
            }

            const productObj = product as Record<string, unknown>;
            const productId = productObj.id as string;

            if (!validProductIds.includes(productId)) {
                // Find the specific id value in the array item
                const idRange = this.findProductIdRange(productId, i, document, startLine);
                if (idRange) {
                    errors.push({
                        range: idRange,
                        message: `Invalid product ID '${productId}'. Valid IDs: ${validProductIds.join(', ')}`,
                        severity: vscode.DiagnosticSeverity.Error,
                        code: 'invalid_product_id'
                    });
                }
            }
        }
    }

    private getFieldSchema(fieldName: string, path: string[]): SchemaProperty | undefined {

        let currentSchema = this.schema.properties;

        for (const segment of path) {
            if (currentSchema[segment] && currentSchema[segment].properties) {
                currentSchema = currentSchema[segment].properties!;
            }
        }

        return currentSchema[fieldName];
    }

    private findFieldRange(fieldName: string, document: vscode.TextDocument, startLine: number): vscode.Range | null {
        // Find the field name in the document
        for (let i = startLine; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const fieldMatch = line.text.match(new RegExp(`^(\\s*)(${fieldName})\\s*:`));
            if (fieldMatch) {
                const startChar = fieldMatch[1].length;
                const endChar = startChar + fieldMatch[2].length;
                return new vscode.Range(i, startChar, i, endChar);
            }
        }
        return null;
    }

    private findValueRange(fieldName: string, document: vscode.TextDocument, startLine: number): vscode.Range | null {
        // Find the value for a field in the document
        // Escape special regex characters in fieldName
        const escapedFieldName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        for (let i = startLine; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text;
            
            // Simple approach: find the field name followed by colon
            const fieldPattern = new RegExp(`(^|\\s)${escapedFieldName}\\s*:`);
            const fieldMatch = lineText.match(fieldPattern);
            
            if (fieldMatch) {
                // Find the colon position
                const colonIndex = lineText.indexOf(':', fieldMatch.index);
                if (colonIndex !== -1) {
                    // Value starts after the colon and any whitespace
                    let valueStart = colonIndex + 1;
                    while (valueStart < lineText.length && lineText[valueStart] === ' ') {
                        valueStart++;
                    }
                    // Value ends at end of line (trimming trailing whitespace)
                    let valueEnd = lineText.length;
                    while (valueEnd > valueStart && lineText[valueEnd - 1] === ' ') {
                        valueEnd--;
                    }
                    
                    if (valueEnd > valueStart) {
                        return new vscode.Range(i, valueStart, i, valueEnd);
                    }
                }
            }
        }
        return null;
    }

    private findProductIdRange(productId: string, itemIndex: number, document: vscode.TextDocument, startLine: number): vscode.Range | null {
        // Find the specific product ID value in the array
        let productsFound = 0;
        let inProductsArray = false;
        
        for (let i = startLine; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text;
            
            // Check if we've entered the products array
            if (text.match(/^\s*products\s*:/)) {
                inProductsArray = true;
                continue;
            }
            
            // Exit if we're no longer in products array (reached another top-level field)
            if (inProductsArray && text.match(/^[a-zA-Z_]/)) {
                break;
            }
            
            // Look for array items with id field
            if (inProductsArray && text.match(/^\s*-\s+id\s*:\s*(.+)$/)) {
                if (productsFound === itemIndex) {
                    // This is our target item, find the id value
                    const valueMatch = text.match(/^\s*-\s+id\s*:\s*(.+)$/);
                    if (valueMatch) {
                        const valueStart = text.indexOf(valueMatch[1]);
                        const valueEnd = valueStart + valueMatch[1].length;
                        return new vscode.Range(i, valueStart, i, valueEnd);
                    }
                }
                productsFound++;
            }
        }
        
        return null;
    }

    private findArrayItemRange(_arrayName: string, _itemIndex: number, _document: vscode.TextDocument, _startLine: number): vscode.Range | null {
        // This is a simplified implementation
        // In practice, you'd need more sophisticated YAML parsing to find exact array item positions
        return null;
    }
}