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
import { DIRECTIVES } from './directives';
import { outputChannel } from './logger';
import { APPLIES_TO_KEYS, LIFECYCLE_STATES } from './roleCompletionProvider';

interface DirectiveBlock {
    opening: string;
    openingRange: vscode.Range;
    name: string;
    nameRange: vscode.Range;
    argument?: string;
    argumentRange?: vscode.Range;
    closing?: string;
    closingRange?: vscode.Range;
    openingColons: number;
    closingColons?: number;
    parameters: Parameter[];
    contentLines: number[];
    isMalformed?: boolean;
    missingClosingBrace?: boolean;
}

interface Parameter {
    name: string;
    value?: string;
    range: vscode.Range;
}

export class DirectiveDiagnosticProvider {
    // Single entry pattern for applies_to validation
    private readonly SINGLE_ENTRY_PATTERN = /^(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)(\s+(all|=[0-9]+(\.[0-9]+)*|[0-9]+(\.[0-9]+)*-[0-9]+(\.[0-9]+)*|[0-9]+(\.[0-9]+)*\+?))?$/;
    
    // Pattern to detect implicit version (x.x without + or =) for hint
    private readonly IMPLICIT_VERSION_PATTERN = /^(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)\s+[0-9]+(\.[0-9]+)*$/;

    provideDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        
        // Parse the entire document for directive blocks
        const directiveBlocks = this.parseDirectiveBlocks(document);
        
        // Validate each block
        for (const block of directiveBlocks) {
            const errors = this.validateDirectiveBlock(block, document);
            diagnostics.push(...errors);
        }
        
        // Validate inline {applies_to} roles
        const inlineAppliesTo = this.validateInlineAppliesToRoles(document);
        diagnostics.push(...inlineAppliesTo);
        
        // Validate section-level {applies_to} directives
        const sectionAppliesTo = this.validateSectionAppliesToDirectives(document);
        diagnostics.push(...sectionAppliesTo);
        
        return diagnostics;
    }
    
    private parseDirectiveBlocks(document: vscode.TextDocument): DirectiveBlock[] {
        const blocks: DirectiveBlock[] = [];
        const blockStack: DirectiveBlock[] = [];
        
        outputChannel.appendLine(`[Elastic Docs] Starting to parse directive blocks for: ${document.uri.toString()}`);
        
        for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
            const line = document.lineAt(lineNum);
            const lineText = line.text;
            
            // Check for properly formatted opening directive
            const openingMatch = lineText.match(/^(:{3,})\{([a-zA-Z][a-zA-Z0-9_-]*)\}(?:\s+(.*))?$/);
            if (openingMatch) {
                outputChannel.appendLine(`[Elastic Docs] Line ${lineNum}: Found opening directive: ${openingMatch[2]} (${openingMatch[1].length} colons) - ${lineText}`);
                const newBlock = {
                    opening: lineText,
                    openingRange: new vscode.Range(lineNum, 0, lineNum, lineText.length),
                    name: openingMatch[2],
                    nameRange: new vscode.Range(lineNum, openingMatch[1].length + 1, lineNum, openingMatch[1].length + 1 + openingMatch[2].length),
                    argument: openingMatch[3],
                    argumentRange: openingMatch[3] ? new vscode.Range(lineNum, openingMatch[1].length + openingMatch[2].length + 2, lineNum, lineText.length) : undefined,
                    openingColons: openingMatch[1].length,
                    parameters: [],
                    contentLines: []
                };
                blocks.push(newBlock);
                blockStack.push(newBlock);
                outputChannel.appendLine(`[Elastic Docs] Stack after adding '${newBlock.name}': ${blockStack.map(b => `${b.name}(${b.openingColons})`).join(', ')}`);
                continue;
            }
            
            // Check for malformed opening directive (missing closing brace)
            const malformedMissingBraceMatch = lineText.match(/^(:{3,})\{([a-zA-Z][a-zA-Z0-9_-]*)(?:\s+(.*))?$/);
            if (malformedMissingBraceMatch) {
                const newBlock = {
                    opening: lineText,
                    openingRange: new vscode.Range(lineNum, 0, lineNum, lineText.length),
                    name: malformedMissingBraceMatch[2],
                    nameRange: new vscode.Range(lineNum, malformedMissingBraceMatch[1].length + 1, lineNum, malformedMissingBraceMatch[1].length + 1 + malformedMissingBraceMatch[2].length),
                    argument: malformedMissingBraceMatch[3],
                    argumentRange: malformedMissingBraceMatch[3] ? new vscode.Range(lineNum, malformedMissingBraceMatch[1].length + malformedMissingBraceMatch[2].length + 2, lineNum, lineText.length) : undefined,
                    openingColons: malformedMissingBraceMatch[1].length,
                    parameters: [],
                    contentLines: [],
                    isMalformed: true,
                    missingClosingBrace: true
                };
                blocks.push(newBlock);
                blockStack.push(newBlock);
                continue;
            }
            
            // Check for malformed opening directive (missing braces entirely)
            const malformedMatch = lineText.match(/^(:{3,})([a-zA-Z][a-zA-Z0-9_-]*)(?:\s+(.*))?$/);
            if (malformedMatch) {
                const newBlock = {
                    opening: lineText,
                    openingRange: new vscode.Range(lineNum, 0, lineNum, lineText.length),
                    name: malformedMatch[2],
                    nameRange: new vscode.Range(lineNum, malformedMatch[1].length, lineNum, malformedMatch[1].length + malformedMatch[2].length),
                    argument: malformedMatch[3],
                    argumentRange: malformedMatch[3] ? new vscode.Range(lineNum, malformedMatch[1].length + malformedMatch[2].length + 1, lineNum, lineText.length) : undefined,
                    openingColons: malformedMatch[1].length,
                    parameters: [],
                    contentLines: [],
                    isMalformed: true
                };
                blocks.push(newBlock);
                blockStack.push(newBlock);
                continue;
            }
            
            // Check for closing directive
            const closingMatch = lineText.match(/^(:+)\s*$/);
            if (closingMatch && blockStack.length > 0) {
                const colonCount = closingMatch[1].length;
                outputChannel.appendLine(`[Elastic Docs] Line ${lineNum}: Found closing with ${colonCount} colons`);
                outputChannel.appendLine(`[Elastic Docs] Current stack: ${blockStack.map(b => `${b.name}(${b.openingColons})`).join(', ')}`);
                
                // Find the most recent unmatched block with matching colon count
                // We search backwards through the stack to handle nested directives
                let matched = false;
                for (let i = blockStack.length - 1; i >= 0; i--) {
                    const block = blockStack[i];
                    outputChannel.appendLine(`[Elastic Docs] Checking block '${block.name}' with ${block.openingColons} colons, already closed: ${!!block.closing}`);
                    if (block.openingColons === colonCount && !block.closing) {
                        outputChannel.appendLine(`[Elastic Docs] MATCHED! Closing '${block.name}' with ${colonCount} colons`);
                        block.closing = lineText;
                        block.closingRange = new vscode.Range(lineNum, 0, lineNum, lineText.length);
                        block.closingColons = colonCount;
                        // Remove this block and all blocks after it from the stack
                        blockStack.splice(i);
                        matched = true;
                        break;
                    }
                }
                if (!matched) {
                    outputChannel.appendLine(`[Elastic Docs] WARNING: No matching opening found for ${colonCount} colons at line ${lineNum}`);
                }
                outputChannel.appendLine(`[Elastic Docs] Stack after closing: ${blockStack.map(b => `${b.name}(${b.openingColons})`).join(', ')}`);
                continue;
            }
            
            // Check for parameters - add to the most recent unclosed block
            if (blockStack.length > 0) {
                const currentBlock = blockStack[blockStack.length - 1];
                const paramMatch = lineText.match(/^:([a-zA-Z][a-zA-Z0-9_-]*):(?:\s+(.*))?$/);
                if (paramMatch) {
                    currentBlock.parameters.push({
                        name: paramMatch[1],
                        value: paramMatch[2],
                        range: new vscode.Range(lineNum, 0, lineNum, lineText.length)
                    });
                } else {
                    // Regular content line - add to the most recent block
                    currentBlock.contentLines.push(lineNum);
                }
            }
        }
        
        // Log any unclosed blocks
        if (blockStack.length > 0) {
            outputChannel.appendLine(`[Elastic Docs] WARNING: Unclosed blocks remaining: ${blockStack.map(b => `${b.name}(${b.openingColons}) at line ${b.openingRange.start.line}`).join(', ')}`);
        }
        
        outputChannel.appendLine(`[Elastic Docs] Parsing complete. Found ${blocks.length} total blocks`);
        blocks.forEach((block, i) => {
            outputChannel.appendLine(`[Elastic Docs] Block ${i}: ${block.name}(${block.openingColons}) - Closed: ${!!block.closing}`);
        });
        
        return blocks;
    }
    
    private validateDirectiveBlock(block: DirectiveBlock, document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        
        outputChannel.appendLine(`[Elastic Docs] Validating block '${block.name}' (${block.openingColons} colons) - Has closing: ${!!block.closing}`);
        
        // 1. Check for missing closing directive
        if (!block.closing) {
            outputChannel.appendLine(`[Elastic Docs] ERROR: Missing closing directive for '${block.name}' at line ${block.openingRange.start.line}`);
            diagnostics.push(new vscode.Diagnostic(
                block.openingRange,
                `Missing closing directive. Expected ${':'.repeat(block.openingColons)}`,
                vscode.DiagnosticSeverity.Error
            ));
            return diagnostics; // Don't continue validation if no closing
        }
        
        // 2. Check for mismatched colon counts
        if (block.openingColons !== block.closingColons) {
            diagnostics.push(new vscode.Diagnostic(
                block.closingRange!,
                `Mismatched colon count. Opening has ${block.openingColons} colons, closing has ${block.closingColons}`,
                vscode.DiagnosticSeverity.Error
            ));
        }
        
        // 3. Check if directive name is valid
        const directive = DIRECTIVES.find(d => d.name === block.name);
        if (!directive) {
            diagnostics.push(new vscode.Diagnostic(
                block.nameRange,
                `Unknown directive '${block.name}'`,
                vscode.DiagnosticSeverity.Warning
            ));
        }
        
        // 4. Check required arguments
        if (directive?.hasArgument && !block.argument) {
            diagnostics.push(new vscode.Diagnostic(
                block.openingRange,
                `Directive '${block.name}' requires an argument`,
                vscode.DiagnosticSeverity.Error
            ));
        }
        
        // 5. Validate parameters
        for (const param of block.parameters) {
            if (directive && !directive.parameters.includes(param.name)) {
                diagnostics.push(new vscode.Diagnostic(
                    param.range,
                    `Unknown parameter '${param.name}' for directive '${block.name}'`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }
        
        // 6. Validate button directive content (must be a markdown link)
        if (block.name === 'button' && block.contentLines.length > 0) {
            const contentLines = block.contentLines.map(lineNum => document.lineAt(lineNum).text);
            const content = contentLines.join('\n').trim();
            const markdownLinkPattern = /^\[([^\]]+)\]\(([^)]+)\)$/;
            
            if (!markdownLinkPattern.test(content)) {
                // Create a range covering all content lines
                const firstContentLine = block.contentLines[0];
                const lastContentLine = block.contentLines[block.contentLines.length - 1];
                const lastLine = document.lineAt(lastContentLine);
                const contentRange = new vscode.Range(
                    new vscode.Position(firstContentLine, 0),
                    new vscode.Position(lastContentLine, lastLine.text.length)
                );
                
                diagnostics.push(new vscode.Diagnostic(
                    contentRange,
                    "Button directive content must be a markdown link in the format [text](url)",
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }
        
        // 7. Check for malformed opening (missing braces)
        if (block.isMalformed) {
            if (block.missingClosingBrace) {
                diagnostics.push(new vscode.Diagnostic(
                    block.openingRange,
                    'Malformed directive opening. Missing closing brace }',
                    vscode.DiagnosticSeverity.Error
                ));
            } else {
                diagnostics.push(new vscode.Diagnostic(
                    block.openingRange,
                    'Malformed directive opening. Expected ::::{name} format with braces',
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }
        
        return diagnostics;
    }

    /**
     * Validate inline {applies_to}`...` roles
     */
    private validateInlineAppliesToRoles(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const inlinePattern = /\{applies_to\}`([^`]+)`/g;

        for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
            const line = document.lineAt(lineNum);
            let match;

            while ((match = inlinePattern.exec(line.text)) !== null) {
                const content = match[1];
                const contentStart = match.index + '{applies_to}`'.length;
                const contentRange = new vscode.Range(
                    lineNum, contentStart,
                    lineNum, contentStart + content.length
                );

                // Validate the applies_to content
                const errors = this.validateAppliesToContent(content, contentRange);
                diagnostics.push(...errors);
            }
        }

        return diagnostics;
    }

    /**
     * Validate section-level ```{applies_to} directives
     */
    private validateSectionAppliesToDirectives(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        
        // Match section-level applies_to blocks:
        // ```{applies_to} or ```yaml {applies_to}
        const sectionPattern = /```(?:yaml\s+)?\{applies_to\}\s*\n([\s\S]*?)```/g;
        let match;

        while ((match = sectionPattern.exec(text)) !== null) {
            const content = match[1];
            const contentStartOffset = match.index + match[0].indexOf(content);
            const contentStartPos = document.positionAt(contentStartOffset);
            
            // Parse each line of the YAML content
            const lines = content.split('\n');
            let currentLine = contentStartPos.line;

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    // Parse key: value
                    const kvMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
                    if (kvMatch) {
                        const key = kvMatch[1];
                        const value = kvMatch[2];
                        
                        // Find the actual position in the document
                        const docLine = document.lineAt(currentLine);
                        const keyStart = docLine.text.indexOf(key);
                        const valueStart = docLine.text.indexOf(value, keyStart + key.length);
                        
                        // Validate key
                        if (!APPLIES_TO_KEYS.includes(key)) {
                            const keyRange = new vscode.Range(
                                currentLine, keyStart,
                                currentLine, keyStart + key.length
                            );
                            diagnostics.push(new vscode.Diagnostic(
                                keyRange,
                                `Unknown applies_to key '${key}'. Valid keys: ${APPLIES_TO_KEYS.slice(0, 5).join(', ')}...`,
                                vscode.DiagnosticSeverity.Warning
                            ));
                        }
                        
                        // Validate value if present
                        if (value) {
                            const valueRange = new vscode.Range(
                                currentLine, valueStart,
                                currentLine, valueStart + value.length
                            );
                            const errors = this.validateAppliesToValue(value, valueRange);
                            diagnostics.push(...errors);
                        }
                    }
                }
                currentLine++;
            }
        }

        return diagnostics;
    }

    /**
     * Validate applies_to content (key: value format)
     */
    private validateAppliesToContent(content: string, range: vscode.Range): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        
        // Parse key: value format
        const kvMatch = content.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
        if (!kvMatch) {
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Invalid applies_to format. Expected 'key: value' format (e.g., 'stack: ga 9.1+')`,
                vscode.DiagnosticSeverity.Error
            ));
            return diagnostics;
        }

        const key = kvMatch[1];
        const value = kvMatch[2];

        // Validate key
        if (!APPLIES_TO_KEYS.includes(key)) {
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Unknown applies_to key '${key}'. Valid keys: ${APPLIES_TO_KEYS.slice(0, 5).join(', ')}...`,
                vscode.DiagnosticSeverity.Warning
            ));
        }

        // Validate value
        if (value) {
            const errors = this.validateAppliesToValue(value, range);
            diagnostics.push(...errors);
        }

        return diagnostics;
    }

    /**
     * Validate applies_to value (lifecycle and version syntax)
     */
    private validateAppliesToValue(value: string, range: vscode.Range): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];

        // Handle empty value
        if (!value.trim()) {
            return diagnostics;
        }

        // Split by comma and validate each entry
        const entries = value.split(',').map(e => e.trim());
        let allEntriesValid = true;

        for (const entry of entries) {
            if (!entry) continue;
            
            // Check if it's a simple lifecycle state
            if (LIFECYCLE_STATES.includes(entry)) {
                continue;
            }

            // Check if it matches the single entry pattern
            if (!this.SINGLE_ENTRY_PATTERN.test(entry)) {
                allEntriesValid = false;
                break;
            }
        }

        if (!allEntriesValid) {
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Invalid lifecycle value. Expected format: 'state', 'state version+', 'state =version', 'state x.x-y.y', or 'state all'`,
                vscode.DiagnosticSeverity.Error
            ));
            return diagnostics;
        }

        // Run semantic validations
        const semanticErrors = this.validateAppliesToSemantics(entries, range);
        diagnostics.push(...semanticErrors);

        return diagnostics;
    }

    /**
     * Semantic validation for applies_to values
     */
    private validateAppliesToSemantics(entries: string[], range: vscode.Range): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        const parsedEntries: Array<{
            originalEntry: string;
            lifecycle: string;
            isUnbound: boolean;
            isRange: boolean;
            isExact: boolean;
            startVersion: number[] | null;
            endVersion: number[] | null;
        }> = [];

        for (const entry of entries) {
            if (!entry) continue;
            const parsed = this.parseVersionEntry(entry);
            if (parsed) {
                parsedEntries.push({ ...parsed, originalEntry: entry });
            }
        }

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
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Consider using explicit version ranges for clarity. Example: 'preview 9.4-10.9, ga 11.0-12.2, removed 12.3+' instead of inferring ranges.`,
                    vscode.DiagnosticSeverity.Hint
                ));
            } else {
                // Some entries are implicit, some explicit - suggest being consistent
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Consider using explicit syntax: Use '+' for "and later" (e.g., 'ga 9.1+') or '=' for exact version (e.g., 'ga =9.1')`,
                    vscode.DiagnosticSeverity.Hint
                ));
            }
        }

        // Check for multiple unbound values
        // Skip this check if all entries use implicit syntax (the system will infer ranges)
        const unboundEntries = parsedEntries.filter(e => e.isUnbound && e.startVersion);
        if (unboundEntries.length > 1 && !allEntriesImplicit) {
            diagnostics.push(new vscode.Diagnostic(
                range,
                `Only one entry per key can use the greater-than syntax. Found ${unboundEntries.length} unbound entries.`,
                vscode.DiagnosticSeverity.Warning
            ));
        }

        // Check for invalid ranges (min > max)
        for (const entry of parsedEntries) {
            if (entry.isRange && entry.startVersion && entry.endVersion) {
                if (this.compareVersions(entry.startVersion, entry.endVersion) > 0) {
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `Invalid version range: the first version must be less than or equal to the second version`,
                        vscode.DiagnosticSeverity.Warning
                    ));
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
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `'removed =${version}' means removed only in version ${version}. If the feature stays removed, use 'removed ${version}+' instead.`,
                        vscode.DiagnosticSeverity.Hint
                    ));
                }
            }
        }

        // Check for overlapping versions
        // Skip overlap check if all entries use implicit syntax (the system will infer ranges)
        if (parsedEntries.length > 1 && !allEntriesImplicit) {
            const overlap = this.findOverlappingEntries(parsedEntries);
            if (overlap) {
                const [entry1, entry2, overlapVersion] = overlap;
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Overlapping versions: '${entry1}' and '${entry2}' both cover version ${overlapVersion}. A version cannot be in multiple lifecycle states.`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }

        return diagnostics;
    }

    /**
     * Parse a single lifecycle entry into structured format
     */
    private parseVersionEntry(entry: string): {
        lifecycle: string;
        isRange: boolean;
        isExact: boolean;
        isUnbound: boolean;
        startVersion: number[] | null;
        endVersion: number[] | null;
    } | null {
        const parts = entry.trim().split(/\s+/);
        if (parts.length === 0) return null;

        const lifecycle = parts[0];
        if (!LIFECYCLE_STATES.includes(lifecycle)) return null;

        if (parts.length === 1) {
            return {
                lifecycle,
                isRange: false,
                isExact: false,
                isUnbound: true,
                startVersion: null,
                endVersion: null
            };
        }

        const versionSpec = parts[1];

        if (versionSpec === 'all') {
            return {
                lifecycle,
                isRange: false,
                isExact: false,
                isUnbound: true,
                startVersion: null,
                endVersion: null
            };
        }

        if (versionSpec.startsWith('=')) {
            const version = this.parseVersion(versionSpec.substring(1));
            return {
                lifecycle,
                isRange: false,
                isExact: true,
                isUnbound: false,
                startVersion: version,
                endVersion: version
            };
        }

        if (versionSpec.includes('-')) {
            const rangeParts = versionSpec.split('-');
            if (rangeParts.length === 2) {
                return {
                    lifecycle,
                    isRange: true,
                    isExact: false,
                    isUnbound: false,
                    startVersion: this.parseVersion(rangeParts[0]),
                    endVersion: this.parseVersion(rangeParts[1])
                };
            }
        }

        const versionStr = versionSpec.endsWith('+') ? versionSpec.slice(0, -1) : versionSpec;
        return {
            lifecycle,
            isRange: false,
            isExact: false,
            isUnbound: true,
            startVersion: this.parseVersion(versionStr),
            endVersion: null
        };
    }

    private parseVersion(versionStr: string): number[] | null {
        if (!versionStr) return null;
        const parts = versionStr.split('.').map(p => parseInt(p, 10));
        if (parts.some(isNaN)) return null;
        return parts;
    }

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
        isUnbound: boolean;
        startVersion: number[] | null;
        endVersion: number[] | null;
    }, b: {
        isUnbound: boolean;
        startVersion: number[] | null;
        endVersion: number[] | null;
    }): string | null {
        if (!a.startVersion || !b.startVersion) return null;

        const aEnd = a.isUnbound ? [99999, 99999, 99999] : (a.endVersion || a.startVersion);
        const bEnd = b.isUnbound ? [99999, 99999, 99999] : (b.endVersion || b.startVersion);

        const aStartLeBEnd = this.compareVersions(a.startVersion, bEnd) <= 0;
        const bStartLeAEnd = this.compareVersions(b.startVersion, aEnd) <= 0;

        if (aStartLeBEnd && bStartLeAEnd) {
            // Find the overlapping version - it's the maximum of the two start versions
            const overlapStart = this.compareVersions(a.startVersion, b.startVersion) >= 0 
                ? a.startVersion 
                : b.startVersion;
            return overlapStart.join('.');
        }

        return null;
    }
} 