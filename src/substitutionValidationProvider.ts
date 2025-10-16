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
import { getSubstitutions } from './substitutions';

interface ValidationError {
    range: vscode.Range;
    message: string;
    severity: vscode.DiagnosticSeverity;
    code?: string;
}

export class SubstitutionValidationProvider {
    public validateDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
        outputChannel.appendLine(`[SubstitutionValidation] Validating document: ${document.fileName}`);
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
        const lines = document.getText().split('\n');
        const substitutions = getSubstitutions(document.uri);
        const escapeRegExp = (text: string): string => {
            return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };
        for (const [i, line] of lines.entries()) {
          for (const [key, value] of Object.entries(substitutions)) {
            const regex = new RegExp(`(\\W|^)${escapeRegExp(value)}(\\W|$)`, 'gm');
            let match;
            while ((match = regex.exec(line)) !== null) {
              const lineNumber = i;
              const startChar = match.index + (match[1] ? match[1].length : 0);
              const endChar = startChar + value.length;
              const range = new vscode.Range(lineNumber, startChar, lineNumber, endChar);
              if (!errors.find(err => err.range.contains(range))) {
                errors.push({
                  range,
                  message: `Use substitute \`{{${key}}}\` instead of \`${value}\``,
                  severity: vscode.DiagnosticSeverity.Warning,
                  code: 'use_sub'
                });
              }
            }
          }
        }
    }
}