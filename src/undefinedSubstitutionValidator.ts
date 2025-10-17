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
import { getSubstitutions, resolveShorthand } from './substitutions';
import { parseSubstitution } from './mutations';

interface ValidationError {
    range: vscode.Range;
    message: string;
    severity: vscode.DiagnosticSeverity;
    code?: string;
}

export class UndefinedSubstitutionValidator {
    public validateDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
        outputChannel.appendLine(`[UndefinedSubstitutionValidator] Validating document: ${document.fileName}`);
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
    }

    private validateContent(errors: ValidationError[], document: vscode.TextDocument): void {
        const text = document.getText();
        const substitutions = getSubstitutions(document.uri);

        // Match all {{...}} patterns
        const subRegex = /\{\{([^}]+)\}\}/g;
        let match;

        while ((match = subRegex.exec(text)) !== null) {
            const fullMatch = match[0];
            const content = match[1];
            const startOffset = match.index;
            const endOffset = startOffset + fullMatch.length;

            // Parse to get variable name (without mutations)
            const { variableName } = parseSubstitution(content);

            // Check if this substitution is defined (including shorthand resolution)
            const resolved = resolveShorthand(variableName, substitutions);
            if (!resolved) {
                const startPos = document.positionAt(startOffset);
                const endPos = document.positionAt(endOffset);
                const range = new vscode.Range(startPos, endPos);

                errors.push({
                    range,
                    message: `Undefined substitution variable: '${variableName}'`,
                    severity: vscode.DiagnosticSeverity.Information,
                    code: 'undefined_sub'
                });
            }
        }
    }
}
