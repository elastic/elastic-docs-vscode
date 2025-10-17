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

/**
 * Provides code actions (quick fixes) for substitution validation warnings
 */
export class SubstitutionCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix
    ];

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const codeActions: vscode.CodeAction[] = [];

        // Look for substitution diagnostics
        for (const diagnostic of context.diagnostics) {
            if (diagnostic.source === 'Elastic Docs Substitutions' && diagnostic.code === 'use_sub') {
                const codeAction = this.createSubstitutionFixAction(document, diagnostic);
                if (codeAction) {
                    codeActions.push(codeAction);
                }
            }
        }

        return codeActions;
    }

    private createSubstitutionFixAction(
        document: vscode.TextDocument,
        diagnostic: vscode.Diagnostic
    ): vscode.CodeAction | undefined {
        // Extract the substitution key from the diagnostic message
        // Message format: "Use substitute `{{key}}` instead of `value`"
        const messageMatch = diagnostic.message.match(/Use substitute `\{\{([^}]+)\}\}` instead of `([^`]+)`/);
        
        if (!messageMatch) {
            outputChannel.appendLine(`[SubstitutionCodeAction] Could not parse diagnostic message: ${diagnostic.message}`);
            return undefined;
        }

        const substitutionKey = messageMatch[1];
        const originalValue = messageMatch[2];

        // Create a code action
        const fix = new vscode.CodeAction(
            `Replace with {{${substitutionKey}}}`,
            vscode.CodeActionKind.QuickFix
        );
        
        fix.diagnostics = [diagnostic];
        fix.isPreferred = true;

        // Create the edit that replaces the text
        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            document.uri,
            diagnostic.range,
            `{{${substitutionKey}}}`
        );
        
        fix.edit = edit;

        outputChannel.appendLine(
            `[SubstitutionCodeAction] Created fix: Replace "${originalValue}" with "{{${substitutionKey}}}" at ${diagnostic.range.start.line}:${diagnostic.range.start.character}`
        );

        return fix;
    }
}
