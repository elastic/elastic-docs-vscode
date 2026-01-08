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
import { outputChannel } from './logger';
import { frontmatterSchema } from './frontmatterSchema';

interface SchemaProperty {
    type?: string;
    description?: string;
    properties?: { [key: string]: SchemaProperty };
    items?: SchemaProperty;
    enum?: readonly string[] | string[];
    $ref?: string;
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

interface FrontmatterContext {
    type: 'field_name' | 'field_value' | 'list_item' | 'object_key' | 'object_value';
    path: string[];
    currentField?: string;
    parentType?: string;
    yamlStructure?: Record<string, unknown>;
}

export class FrontmatterCompletionProvider implements vscode.CompletionItemProvider {
    private schema: FrontmatterSchema;
    private readonly FRONTMATTER_START = /^---\s*$/;
    private readonly FRONTMATTER_END = /^---\s*$/;

    constructor() {
        this.schema = frontmatterSchema as unknown as FrontmatterSchema;
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        outputChannel.appendLine(`[FrontmatterCompletion] Called at ${document.fileName}:${position.line}:${position.character}`);

        // Check if we're in frontmatter
        const frontmatterRange = this.getFrontmatterRange(document);
        if (!frontmatterRange || !frontmatterRange.contains(position)) {
            outputChannel.appendLine(`[FrontmatterCompletion] Not in frontmatter. Range: ${frontmatterRange ? `${frontmatterRange.start.line}-${frontmatterRange.end.line}` : 'null'}, Position: ${position.line}`);
            return [];
        }

        outputChannel.appendLine(`[FrontmatterCompletion] In frontmatter range ${frontmatterRange.start.line}-${frontmatterRange.end.line}`);

        // Analyze the current context
        const context = this.analyzeContext(document, position, frontmatterRange);
        if (!context) {
            outputChannel.appendLine(`[FrontmatterCompletion] No context detected`);
            return [];
        }

        outputChannel.appendLine(`[FrontmatterCompletion] Context: type=${context.type}, path=[${context.path.join(',')}], currentField=${context.currentField || 'none'}`);

        // Provide completions based on context
        const completions = this.getCompletionsForContext(context);
        outputChannel.appendLine(`[FrontmatterCompletion] Returning ${Array.isArray(completions) ? completions.length : 0} completions`);
        return completions;
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

    private analyzeContext(document: vscode.TextDocument, position: vscode.Position, frontmatterRange: vscode.Range): FrontmatterContext | null {
        const frontmatterText = document.getText(frontmatterRange);
        const lines = frontmatterText.split('\n').slice(1, -1); // Remove --- markers
        
        const currentLine = document.lineAt(position).text;
        const textBefore = currentLine.substring(0, position.character);
        const textAfter = currentLine.substring(position.character);
        
        outputChannel.appendLine(`[FrontmatterCompletion] Line text: "${currentLine}"`);
        outputChannel.appendLine(`[FrontmatterCompletion] Text before: "${textBefore}"`);
        outputChannel.appendLine(`[FrontmatterCompletion] Text after: "${textAfter}"`);
        
        // Parse YAML structure up to current position
        // const yamlStructure = this.parsePartialYaml(lines, position.line - 1);
        const path = this.getCurrentPath(lines, position.line - 1, position.character);
        
        outputChannel.appendLine(`[FrontmatterCompletion] Detected path: [${path.join(',')}]`);
        outputChannel.appendLine(`[FrontmatterCompletion] Current line index: ${position.line - frontmatterRange.start.line - 1}`);
        outputChannel.appendLine(`[FrontmatterCompletion] Lines array: ${JSON.stringify(lines)}`);

        // Determine context based on indentation and schema
        const context = this.determineSchemaContext(textBefore, textAfter, path, position.line - frontmatterRange.start.line - 1, lines);
        
        outputChannel.appendLine(`[FrontmatterCompletion] Determined context: ${JSON.stringify(context)}`);
        
        return context;
    }

    private determineSchemaContext(textBefore: string, textAfter: string, path: string[], currentLineIndex: number, lines: string[]): FrontmatterContext | null {
        const currentIndent = textBefore.length - textBefore.trimStart().length;
        const trimmedBefore = textBefore.trim();
        
        outputChannel.appendLine(`[FrontmatterCompletion] Schema context analysis: indent=${currentIndent}, trimmed="${trimmedBefore}"`);
        outputChannel.appendLine(`[FrontmatterCompletion] isFieldValue check: ${this.isFieldValue(textBefore)}`);
        outputChannel.appendLine(`[FrontmatterCompletion] isIndentedNewField check: ${this.isIndentedNewField(textBefore, currentIndent, lines, currentLineIndex)}`);
        
        // Case 1: Array item context "- " or "- field:"
        if (trimmedBefore.startsWith('-')) {
            outputChannel.appendLine(`[FrontmatterCompletion] Detected array item context: "${trimmedBefore}"`);
            // Check if this is "- field:" (array item with field value)
            if (trimmedBefore.includes(':')) {
                const fieldName = this.extractFieldName(textBefore);
                outputChannel.appendLine(`[FrontmatterCompletion] Array field value context for: ${fieldName}`);
                return {
                    type: 'field_value',
                    path,
                    currentField: fieldName,
                    yamlStructure: {}
                };
            } else {
                // Regular array item like "- " 
                outputChannel.appendLine(`[FrontmatterCompletion] Regular array item context`);
                return {
                    type: 'list_item',
                    path,
                    yamlStructure: {}
                };
            }
        }
        
        // Case 2: Typing field value after ":" (including right after typing the colon)
        if (this.isFieldValue(textBefore)) {
            const fieldName = this.extractFieldName(textBefore);
            outputChannel.appendLine(`[FrontmatterCompletion] Field value context for: ${fieldName}`);
            return {
                type: 'field_value',
                path,
                currentField: fieldName,
                yamlStructure: {}
            };
        }
        
        // Case 3: Typing after "field:" with proper indentation - suggest child fields
        if (this.isIndentedNewField(textBefore, currentIndent, lines, currentLineIndex)) {
            const parentPath = this.getParentPathFromIndentation(currentIndent, lines, currentLineIndex);
            outputChannel.appendLine(`[FrontmatterCompletion] Indented field context, parent path: [${parentPath.join(',')}]`);
            
            return {
                type: 'field_name',
                path: parentPath,
                yamlStructure: {}
            };
        }
        
        // Case 4: Root level field (no indentation)
        if (currentIndent === 0 && !textAfter.includes(':')) {
            return {
                type: 'field_name',
                path: [],
                yamlStructure: {}
            };
        }
        
        return null;
    }

    private isIndentedNewField(textBefore: string, currentIndent: number, lines: string[], currentLineIndex: number): boolean {
        // Must have some indentation
        if (currentIndent === 0) return false;
        
        // Look back to find the parent field
        for (let i = currentLineIndex - 1; i >= 0; i--) {
            const line = lines[i];
            if (!line || !line.trim()) continue;
            
            const lineIndent = line.length - line.trimStart().length;
            
            // Found a parent field with less indentation that ends with ":"
            if (lineIndent < currentIndent && line.trim().endsWith(':')) {
                return true;
            }
        }
        
        return false;
    }

    private getParentPathFromIndentation(currentIndent: number, lines: string[], currentLineIndex: number): string[] {
        const path: string[] = [];
        
        // Walk backwards to build the path based on indentation
        for (let i = currentLineIndex - 1; i >= 0; i--) {
            const line = lines[i];
            if (!line || !line.trim()) continue;
            
            const lineIndent = line.length - line.trimStart().length;
            const trimmed = line.trim();
            
            // If this line has less indentation and is a field, add it to path
            if (lineIndent < currentIndent && trimmed.includes(':') && !trimmed.startsWith('-')) {
                const fieldName = trimmed.split(':')[0].trim();
                path.unshift(fieldName);
                
                // Continue looking for more parents
                currentIndent = lineIndent;
            }
        }
        
        return path;
    }

    private isFieldName(textBefore: string, textAfter: string): boolean {
        // Field name if we're at start of line or after proper indentation and not after ':'
        // This includes empty lines, indented lines, and partial field names
        return /^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)?$/.test(textBefore) && !textAfter.includes(':');
    }

    private isFieldValue(textBefore: string): boolean {
        // Field value if we're after ':' and optional whitespace
        // This includes immediately after typing the colon: "ecctl:"
        const result = /:\s*([^"'\n]*)?$/.test(textBefore);
        outputChannel.appendLine(`[FrontmatterCompletion] isFieldValue("${textBefore}") = ${result}`);
        return result;
    }

    private isListItem(textBefore: string): boolean {
        // List item if we're after '- ' 
        return /^\s*-\s*([^:\n]*)?$/.test(textBefore);
    }

    private isObjectKey(textBefore: string, _path: string[]): boolean {
        // Object key if we're inside an object context
        const indent = textBefore.match(/^\s*/)?.[0].length || 0;
        return indent > 0 && /^\s*([a-zA-Z_][a-zA-Z0-9_]*)?$/.test(textBefore);
    }

    private isObjectValue(textBefore: string, _path: string[]): boolean {
        // Object value if we're after ':' inside an object
        return this.isFieldValue(textBefore);
    }

    private extractFieldName(textBefore: string): string {
        // Handle both "fieldname: value" and "fieldname:" (right after colon)
        const match = textBefore.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*[^:\n]*$/);
        if (match) {
            outputChannel.appendLine(`[FrontmatterCompletion] extractFieldName: Regular match for "${textBefore}" -> "${match[1]}"`);
            return match[1];
        }
        
        // Also handle array items like "- fieldname:" 
        const arrayMatch = textBefore.match(/^\s*-\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*[^:\n]*$/);
        if (arrayMatch) {
            outputChannel.appendLine(`[FrontmatterCompletion] extractFieldName: Array match for "${textBefore}" -> "${arrayMatch[1]}"`);
            return arrayMatch[1];
        }
        
        outputChannel.appendLine(`[FrontmatterCompletion] extractFieldName: No match for "${textBefore}"`);
        return '';
    }

    private getCurrentPath(lines: string[], currentLine: number, _currentChar: number): string[] {
        const path: string[] = [];
        let currentIndent = 0;
        const currentLineText = lines[currentLine];

        outputChannel.appendLine(`[FrontmatterCompletion] getCurrentPath called for line ${currentLine}: "${currentLineText}"`);

        // Check if current line is an array item (starts with -)
        const isArrayItem = currentLineText && /^\s*-\s/.test(currentLineText);
        outputChannel.appendLine(`[FrontmatterCompletion] Is array item: ${isArrayItem}`);
        
        // If we're in an array item, we need to find the parent array field
        if (isArrayItem) {
            const arrayIndent = currentLineText.length - currentLineText.trimStart().length;
            outputChannel.appendLine(`[FrontmatterCompletion] Array indent: ${arrayIndent}`);
            
            // Look backwards for the parent field that owns this array
            for (let i = currentLine - 1; i >= 0; i--) {
                const line = lines[i];
                if (!line || line.trim() === '') continue;
                
                const indent = line.length - line.trimStart().length;
                outputChannel.appendLine(`[FrontmatterCompletion] Checking line ${i}: "${line}" (indent: ${indent})`);
                
                // Found a field at a lesser indentation level - this is our parent
                if (indent < arrayIndent) {
                    const fieldMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
                    if (fieldMatch) {
                        const fieldName = fieldMatch[1];
                        outputChannel.appendLine(`[FrontmatterCompletion] Found parent field: ${fieldName} at indent ${indent}`);
                        path.unshift(fieldName);
                        currentIndent = indent;
                        
                        // Continue looking for more parents at higher levels
                        let searchIndent = indent;
                        for (let j = i - 1; j >= 0; j--) {
                            const parentLine = lines[j];
                            if (!parentLine || parentLine.trim() === '') continue;
                            
                            const parentIndent = parentLine.length - parentLine.trimStart().length;
                            
                            if (parentIndent < searchIndent) {
                                const parentFieldMatch = parentLine.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
                                if (parentFieldMatch) {
                                    const parentFieldName = parentFieldMatch[1];
                                    outputChannel.appendLine(`[FrontmatterCompletion] Found higher parent field: ${parentFieldName} at indent ${parentIndent}`);
                                    path.unshift(parentFieldName);
                                    searchIndent = parentIndent;
                                }
                            }
                        }
                        break;
                    }
                }
            }
        } else {
            // Regular path detection for non-array items
            for (let i = currentLine; i >= 0; i--) {
                const line = lines[i];
                if (!line || line.trim() === '') continue;

                const indent = line.length - line.trimStart().length;
                
                if (i === currentLine) {
                    currentIndent = indent;
                } else if (indent < currentIndent) {
                    // Found parent level
                    const fieldMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
                    if (fieldMatch) {
                        path.unshift(fieldMatch[1]);
                        currentIndent = indent;
                    }
                }
            }
        }

        outputChannel.appendLine(`[FrontmatterCompletion] Final path: [${path.join(',')}]`);
        return path;
    }

    private parsePartialYaml(_lines: string[], _upToLine: number): Record<string, unknown> {
        // Simple YAML parser for structure analysis
        const result: Record<string, unknown> = {};
        // This would need a more sophisticated implementation
        // For now, returning empty object
        return result;
    }

    private getCompletionsForContext(context: FrontmatterContext): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];

        outputChannel.appendLine(`[FrontmatterCompletion] getCompletionsForContext called with type: ${context.type}, field: ${context.currentField}, path: [${context.path.join(',')}]`);

        switch (context.type) {
            case 'field_name':
                return this.getFieldNameCompletions(context.path);
            case 'field_value':
                // Special handling for product ID fields in products array
                if (context.currentField === 'id' && context.path.includes('products')) {
                    outputChannel.appendLine(`[FrontmatterCompletion] Special handling for product ID field in products array`);
                    return this.getObjectValueCompletions(context.currentField, context.path);
                }
                return this.getFieldValueCompletions(context.currentField!, context.path);
            case 'list_item':
                return this.getListItemCompletions(context.path);
            case 'object_key':
                return this.getObjectKeyCompletions(context.path);
            case 'object_value':
                return this.getObjectValueCompletions(context.currentField!, context.path);
        }

        return items;
    }

    private getFieldNameCompletions(path: string[]): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        
        outputChannel.appendLine(`[FrontmatterCompletion] Getting field completions for path: [${path.join(',')}]`);

        // Root level field names
        if (path.length === 0) {
            outputChannel.appendLine(`[FrontmatterCompletion] Root level completions`);
            for (const [fieldName, fieldSchema] of Object.entries(this.schema.properties)) {
                const item = new vscode.CompletionItem(fieldName, vscode.CompletionItemKind.Field);
                item.detail = fieldSchema.description || `${fieldSchema.type || 'unknown'} field`;
                item.documentation = new vscode.MarkdownString(fieldSchema.description || '');
                item.insertText = `${fieldName}: `;
                items.push(item);
                outputChannel.appendLine(`[FrontmatterCompletion] Added root field: ${fieldName}`);
            }
        } else {
            // Handle special schema paths
            const completions = this.getSchemaBasedCompletions(path);
            items.push(...completions);
        }

        outputChannel.appendLine(`[FrontmatterCompletion] Returning ${items.length} field completions`);
        return items;
    }

    private getSchemaBasedCompletions(path: string[]): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        const pathString = path.join('.');
        
        outputChannel.appendLine(`[FrontmatterCompletion] Schema-based completions for path: ${pathString}`);
        
        // Special handling for applies_to paths
        if (path[0] === 'applies_to') {
            if (path.length === 1) {
                // Direct children of applies_to
                // const knownKeys = this.schema.metadata.knownKeys.keys;
                const topLevelKeys = ['stack', 'deployment', 'serverless', 'product'];
                
                for (const key of topLevelKeys) {
                    const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field);
                    item.detail = this.getAppliesKeyDescription(key);
                    item.insertText = `${key}: `;
                    items.push(item);
                    outputChannel.appendLine(`[FrontmatterCompletion] Added applies_to field: ${key}`);
                }
            } else if (path.length === 2) {
                // Children of specific applies_to fields
                const parentKey = path[1];
                if (parentKey === 'deployment') {
                    const deploymentDef = this.schema.definitions.deploymentApplicability;
                    if (deploymentDef && deploymentDef.properties) {
                        for (const key of Object.keys(deploymentDef.properties)) {
                            const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field);
                            item.detail = this.getAppliesKeyDescription(key);
                            item.insertText = `${key}: `;
                            items.push(item);
                            outputChannel.appendLine(`[FrontmatterCompletion] Added deployment field: ${key}`);
                        }
                    }
                } else if (parentKey === 'serverless') {
                    const serverlessDef = this.schema.definitions.serverlessProjectApplicability;
                    if (serverlessDef && serverlessDef.properties) {
                        for (const key of Object.keys(serverlessDef.properties)) {
                            const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field);
                            item.detail = this.getAppliesKeyDescription(key);
                            item.insertText = `${key}: `;
                            items.push(item);
                            outputChannel.appendLine(`[FrontmatterCompletion] Added serverless field: ${key}`);
                        }
                    }
                } else if (parentKey === 'product') {
                    // Individual product keys
                    const knownKeys = this.schema.metadata.knownKeys.keys.filter(key => 
                        !['stack', 'deployment', 'serverless', 'product'].includes(key)
                    );
                    for (const key of knownKeys) {
                        const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field);
                        item.detail = this.getAppliesKeyDescription(key);
                        item.insertText = `${key}: `;
                        items.push(item);
                        outputChannel.appendLine(`[FrontmatterCompletion] Added product field: ${key}`);
                    }
                }
            }
        }
        
        return items;
    }

    private getFieldValueCompletions(fieldName: string, path: string[]): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        
        outputChannel.appendLine(`[FrontmatterCompletion] Getting value completions for field: ${fieldName}, path: [${path.join(',')}]`);

        // Handle applies_to lifecycle values (most common case)
        if (this.isAppliesField(fieldName, path)) {
            outputChannel.appendLine(`[FrontmatterCompletion] Field is applies_to related, providing lifecycle completions`);
            return this.getLifecycleStateCompletions();
        }

        const fieldSchema = this.getFieldSchema(fieldName, path);
        if (!fieldSchema) {
            outputChannel.appendLine(`[FrontmatterCompletion] No schema found for field: ${fieldName}`);
            return items;
        }

        // Handle enum values from schema
        if (fieldSchema.enum) {
            outputChannel.appendLine(`[FrontmatterCompletion] Found enum values: ${fieldSchema.enum.join(', ')}`);
            for (const value of fieldSchema.enum) {
                const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
                item.insertText = `"${value}"`;
                items.push(item);
            }
        }

        // Handle special field types
        if (fieldName === 'layout') {
            const layouts = ['landing-page', 'not-found', 'archive'];
            for (const layout of layouts) {
                const item = new vscode.CompletionItem(layout, vscode.CompletionItemKind.Value);
                item.insertText = `"${layout}"`;
                items.push(item);
            }
        }

        outputChannel.appendLine(`[FrontmatterCompletion] Returning ${items.length} value completions`);
        return items;
    }

    private getListItemCompletions(path: string[]): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        
        // Handle products array
        if (path.includes('products')) {
            const item = new vscode.CompletionItem('id', vscode.CompletionItemKind.Field);
            item.insertText = 'id: ';
            item.detail = 'Product identifier';
            items.push(item);
        }

        // Handle mapped_pages array
        if (path.includes('mapped_pages')) {
            const item = new vscode.CompletionItem('"/path/to/page"', vscode.CompletionItemKind.Value);
            item.insertText = '"/path/to/page"';
            item.detail = 'Page path for mapping';
            items.push(item);
        }

        return items;
    }

    private getObjectKeyCompletions(path: string[]): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        

        // Handle applies_to object keys
        if (path.includes('applies_to')) {
            const knownKeys = this.schema.metadata.knownKeys.keys;
            for (const key of knownKeys) {
                const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field);
                item.insertText = `${key}: `;
                item.detail = this.getAppliesKeyDescription(key);
                items.push(item);
            }
        }

        // Handle deployment/serverless object keys
        if (path.includes('deployment')) {
            const deploymentDef = this.schema.definitions.deploymentApplicability;
            if (deploymentDef && deploymentDef.properties) {
                for (const key of Object.keys(deploymentDef.properties)) {
                    const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field);
                    item.insertText = `${key}: `;
                    item.detail = this.getAppliesKeyDescription(key);
                    items.push(item);
                }
            }
        }

        if (path.includes('serverless')) {
            const serverlessDef = this.schema.definitions.serverlessProjectApplicability;
            if (serverlessDef && serverlessDef.properties) {
                for (const key of Object.keys(serverlessDef.properties)) {
                    const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field);
                    item.insertText = `${key}: `;
                    item.detail = this.getAppliesKeyDescription(key);
                    items.push(item);
                }
            }
        }

        return items;
    }

    private getObjectValueCompletions(fieldName: string, path: string[]): vscode.CompletionItem[] {
        outputChannel.appendLine(`[FrontmatterCompletion] getObjectValueCompletions called for field: ${fieldName}, path: [${path.join(',')}]`);
        
        // Handle product ID completions
        if (fieldName === 'id' && path.includes('products')) {
            outputChannel.appendLine(`[FrontmatterCompletion] Field is 'id' in products path, calling getProductIdCompletions`);
            return this.getProductIdCompletions();
        }

        // Handle applies_to value completions
        if (this.isAppliesField(fieldName, path)) {
            outputChannel.appendLine(`[FrontmatterCompletion] Field is applies_to related, calling getAppliesValueCompletions`);
            return this.getAppliesValueCompletions();
        }

        outputChannel.appendLine(`[FrontmatterCompletion] No specific handling for field: ${fieldName}`);
        return [];
    }

    private getLifecycleStateCompletions(): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        
        outputChannel.appendLine(`[FrontmatterCompletion] Providing lifecycle state completions`);

        const lifecycleStates = this.schema.metadata.lifecycleStates.values;
        
        // Simple lifecycle states
        for (const state of lifecycleStates) {
            const item = new vscode.CompletionItem(state.key, vscode.CompletionItemKind.Value);
            item.insertText = state.key; // No quotes for simple completion
            item.detail = state.description;
            item.documentation = new vscode.MarkdownString(state.description);
            item.sortText = `0${state.key}`; // Priority sort
            items.push(item);
        }

        // Special "all" value
        const allItem = new vscode.CompletionItem('all', vscode.CompletionItemKind.Value);
        allItem.insertText = 'all';
        allItem.detail = 'Generally available in all versions';
        allItem.sortText = '0all';
        items.push(allItem);

        // Common patterns with versions (lower priority)
        const commonPatterns = [
            // Greater than or equal (explicit)
            { pattern: 'ga 9.1+', description: 'Generally available from version 9.1 and later' },
            { pattern: 'preview 9.0+', description: 'Preview from version 9.0 and later' },
            { pattern: 'beta 9.1+', description: 'Beta from version 9.1 and later' },
            { pattern: 'deprecated 8.0+', description: 'Deprecated since version 8.0 and later' },
            // Version ranges
            { pattern: 'preview 9.0-9.1', description: 'Preview from version 9.0 to 9.1' },
            { pattern: 'beta 9.0-9.2', description: 'Beta from version 9.0 to 9.2' },
            // Exact versions
            { pattern: 'ga =9.1', description: 'Generally available in exactly version 9.1' },
            { pattern: 'beta =9.0', description: 'Beta in exactly version 9.0' },
            // Comma-separated patterns
            { pattern: 'ga 9.2+, preview 9.0-9.1', description: 'GA from 9.2+, Preview from 9.0 to 9.1' },
            { pattern: 'ga 9.1+, beta =9.0', description: 'GA from 9.1+, Beta in exactly 9.0' }
        ];

        for (const {pattern, description} of commonPatterns) {
            const item = new vscode.CompletionItem(pattern, vscode.CompletionItemKind.Value);
            item.insertText = pattern;
            item.detail = description;
            item.sortText = `1${pattern}`; // Lower priority
            items.push(item);
        }

        outputChannel.appendLine(`[FrontmatterCompletion] Created ${items.length} lifecycle completions`);
        return items;
    }

    // Keep the old method name for backward compatibility
    private getAppliesValueCompletions(): vscode.CompletionItem[] {
        return this.getLifecycleStateCompletions();
    }

    private getProductIdCompletions(): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        
        outputChannel.appendLine(`[FrontmatterCompletion] Getting product ID completions`);
        
        // Get product IDs from schema
        const productsSchema = this.schema.properties.products;
        let productIds: string[] = [];

        if (productsSchema && productsSchema.items && productsSchema.items.properties && productsSchema.items.properties.id && productsSchema.items.properties.id.enum) {
            productIds = [...productsSchema.items.properties.id.enum];
            outputChannel.appendLine(`[FrontmatterCompletion] Found ${productIds.length} product IDs in schema: ${productIds.join(', ')}`);
        } else {
            outputChannel.appendLine(`[FrontmatterCompletion] No product IDs found in schema. Schema structure: ${JSON.stringify(productsSchema)}`);
        }

        for (const productId of productIds) {
            const item = new vscode.CompletionItem(productId, vscode.CompletionItemKind.Value);
            item.insertText = `"${productId}"`;
            item.detail = 'Product identifier';
            items.push(item);
            outputChannel.appendLine(`[FrontmatterCompletion] Added product ID completion: ${productId}`);
        }

        outputChannel.appendLine(`[FrontmatterCompletion] Returning ${items.length} product ID completions`);
        return items;
    }

    private getFieldSchema(fieldName: string, path: string[]): SchemaProperty | undefined {

        // Navigate to the correct schema based on path
        let currentSchema = this.schema.properties;

        for (const segment of path) {
            if (currentSchema[segment] && currentSchema[segment].properties) {
                currentSchema = currentSchema[segment].properties!;
            }
        }

        return currentSchema[fieldName];
    }

    private getSchemaAtPath(path: string[]): SchemaProperty | FrontmatterSchema | null {

        let currentSchema: SchemaProperty | FrontmatterSchema = this.schema;

        for (const segment of path) {
            if (currentSchema.properties && currentSchema.properties[segment]) {
                currentSchema = currentSchema.properties[segment];
            } else {
                return null;
            }
        }
        
        return currentSchema;
    }

    private isAppliesField(fieldName: string, path: string[]): boolean {
        // If we're anywhere in the applies_to hierarchy, this is a lifecycle field
        if (path.includes('applies_to')) {
            outputChannel.appendLine(`[FrontmatterCompletion] Field ${fieldName} is in applies_to path`);
            return true;
        }
        
        // Check if this is a known applies_to key
        const knownKeys = this.schema.metadata.knownKeys.keys;
        const isKnownKey = knownKeys.includes(fieldName);
        
        outputChannel.appendLine(`[FrontmatterCompletion] Field ${fieldName} known key check: ${isKnownKey}`);
        
        return isKnownKey;
    }

    private getAppliesKeyDescription(key: string): string {
        const descriptions: { [key: string]: string } = {
            'stack': 'Elastic Stack applicability',
            'deployment': 'Deployment model applicability',
            'serverless': 'Serverless project applicability',
            'product': 'General product applicability',
            'self': 'Self-managed deployment',
            'ece': 'Elastic Cloud Enterprise',
            'eck': 'Elastic Cloud on Kubernetes',
            'ess': 'Elastic Cloud (ESS)',
            'elasticsearch': 'Elasticsearch Serverless',
            'observability': 'Observability Serverless',
            'security': 'Security Serverless'
        };
        
        return descriptions[key] || `${key} applicability`;
    }
}