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
    provideDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        
        // Parse the entire document for directive blocks
        const directiveBlocks = this.parseDirectiveBlocks(document);
        
        // Validate each block
        for (const block of directiveBlocks) {
            const errors = this.validateDirectiveBlock(block, document);
            diagnostics.push(...errors);
        }
        
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
} 