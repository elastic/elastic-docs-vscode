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
import { getSubstitutions } from './substitutions';
import { performanceLogger } from './performanceLogger';

interface ValidationError {
    range: vscode.Range;
    message: string;
    severity: vscode.DiagnosticSeverity;
    code?: string;
}

export class SubstitutionValidationProvider {
    public validateDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
        return performanceLogger.measureSync(
            'SubstitutionValidation.validateDocument',
            () => {
                const errors: ValidationError[] = [];
                this.validateContent(errors, document);

                return errors.map(error => {
                    const diagnostic = new vscode.Diagnostic(error.range, error.message, error.severity);
                    if (error.code) {
                        diagnostic.code = error.code;
                    }
                    diagnostic.source = 'Elastic Docs Substitutions';
                    return diagnostic;
                });
            },
            { fileName: document.fileName, lineCount: document.lineCount }
        );
    }

    private validateContent(errors: ValidationError[], document: vscode.TextDocument): void {
        return performanceLogger.measureSync(
            'SubstitutionValidation.validateContent',
            () => {
                const text = document.getText();
                const substitutions = getSubstitutions(document.uri);

                // Find frontmatter range to exclude it from validation
                const frontmatterMatch = text.match(/^---\s*\n[\s\S]*?\n---/);
                const frontmatterEnd = frontmatterMatch ? frontmatterMatch[0].length : 0;

                // Only validate content after frontmatter
                const contentToValidate = text.substring(frontmatterEnd);
                const lines = contentToValidate.split('\n');
                const lineOffset = text.substring(0, frontmatterEnd).split('\n').length - 1;

                // PERFORMANCE OPTIMIZATION: Pre-compile all regex patterns
                const compiledPatterns = new Map<string, RegExp>();
                for (const [key, value] of Object.entries(substitutions)) {
                    if (value.length > 0) { // Skip empty values
                        const escapedValue = this.escapeRegExp(value);
                        compiledPatterns.set(key, new RegExp(`(\\W|^)${escapedValue}(\\W|$)`, 'gm'));
                    }
                }

                // PERFORMANCE OPTIMIZATION: Process lines in batches to avoid blocking
                const BATCH_SIZE = 10;
                for (let batchStart = 0; batchStart < lines.length; batchStart += BATCH_SIZE) {
                    const batchEnd = Math.min(batchStart + BATCH_SIZE, lines.length);
                    const batch = lines.slice(batchStart, batchEnd);

                    for (const [i, line] of batch.entries()) {
                        const actualLineIndex = batchStart + i;
                        this.validateLine(line, actualLineIndex + lineOffset, compiledPatterns, substitutions, errors);
                    }
                }
            },
            {
                fileName: document.fileName,
                substitutionCount: Object.keys(getSubstitutions(document.uri)).length
            }
        );
    }

    private validateLine(
        line: string, 
        lineNumber: number, 
        compiledPatterns: Map<string, RegExp>, 
        substitutions: Record<string, string>,
        errors: ValidationError[]
    ): void {
        for (const [key, pattern] of compiledPatterns) {
            const value = substitutions[key];
            let match;
            
            // Reset regex lastIndex to ensure consistent behavior
            pattern.lastIndex = 0;
            
            while ((match = pattern.exec(line)) !== null) {
                const startChar = match.index + (match[1] ? match[1].length : 0);
                const endChar = startChar + value.length;
                const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar);
                
                // Check for overlapping errors to avoid duplicates
                if (!errors.some(err => err.range.intersection(range))) {
                    errors.push({
                        range,
                        message: `Use substitute \`{{${key}}}\` instead of \`${value}\``,
                        severity: vscode.DiagnosticSeverity.Warning,
                        code: 'use_sub'
                    });
                }
                
                // Prevent infinite loops with zero-width matches
                if (match.index === pattern.lastIndex) {
                    pattern.lastIndex++;
                }
            }
        }
    }

    private escapeRegExp(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}