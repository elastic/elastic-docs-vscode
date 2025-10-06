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

interface SubstitutionVariables {
    [key: string]: string;
}

export class SubstitutionHoverProvider implements vscode.HoverProvider {
    private cachedSubstitutions: Map<string, SubstitutionVariables> = new Map();
    private lastCacheUpdate: number = 0;

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        try {
            const lineText = document.lineAt(position).text;

            // Custom word range detection for substitution variables
            const wordRange = this.getSubstitutionVariableRange(document, position);

            if (!wordRange) {
                return null;
            }

            const word = document.getText(wordRange);

            // Check if we're hovering over a substitution variable (inside {{}})
            const textBefore = lineText.substring(0, wordRange.start.character);
            const textAfter = lineText.substring(wordRange.end.character);

            // Look for {{ before the word and }} after the word
            const beforeMatch = textBefore.match(/\{\{([^}]*)$/);
            const afterMatch = textAfter.match(/^([^}]*)\}\}/);

            if (beforeMatch && afterMatch) {
                // We're inside a substitution variable
                const substitutions = getSubstitutions(document.uri, this.cachedSubstitutions, this.lastCacheUpdate);
                const variableName = word;

                if (substitutions[variableName]) {
                    const value = substitutions[variableName];
                    const markdown = new vscode.MarkdownString();

                    markdown.appendMarkdown(`**Substitution Variable:** \`${variableName}\`\n\n`);
                    markdown.appendMarkdown(`**Value:** ${value}\n\n`);
                    markdown.appendMarkdown(`**Usage:** \`{{${variableName}}}\``);

                    return new vscode.Hover(markdown, wordRange);
                }
            }

            return null;
        } catch (error) {
            outputChannel.appendLine(`Error in substitution hover: ${error}`);
            return null;
        }
    }

    private getSubstitutionVariableRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range | null {
        const lineText = document.lineAt(position).text;
        const char = position.character;

        // Check if we're inside a {{variable}} pattern
        const beforeText = lineText.substring(0, char);
        const afterText = lineText.substring(char);

        // Look for {{ before the cursor
        const beforeMatch = beforeText.match(/\{\{([a-zA-Z0-9_-]*)$/);
        if (!beforeMatch) {
            return null;
        }

        // Look for }} after the cursor
        const afterMatch = afterText.match(/^([a-zA-Z0-9_-]*)\}\}/);
        if (!afterMatch) {
            return null;
        }

        // Calculate the full variable name and range
        const variableStart = char - beforeMatch[1].length;
        const variableEnd = char + afterMatch[1].length;

        // Ensure we're within the line bounds
        if (variableStart < 0 || variableEnd > lineText.length) {
            return null;
        }

        // Verify the full pattern is {{variable}}
        const fullPattern = lineText.substring(variableStart - 2, variableEnd + 2);
        if (!fullPattern.match(/^\{\{[a-zA-Z0-9_-]*\}\}$/)) {
            return null;
        }


        return new vscode.Range(
            new vscode.Position(position.line, variableStart),
            new vscode.Position(position.line, variableEnd)
        );
    }

    // Method to clear cache when workspace changes
    public clearCache(): void {
        this.cachedSubstitutions.clear();
        this.lastCacheUpdate = 0;
    }
}