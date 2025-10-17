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
import { parseSubstitution, describeMutationChain } from './mutations';

interface SubstitutionVariables {
    [key: string]: string;
}

export class SubstitutionHoverProvider implements vscode.HoverProvider {
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
                const substitutions = getSubstitutions(document.uri);

                // Get the full text inside {{ }}
                const fullText = beforeMatch[1] + word + afterMatch[1];
                const { variableName, mutations } = parseSubstitution(fullText);

                // Only show hover if the variable is defined
                if (substitutions[variableName]) {
                    const value = substitutions[variableName];
                    const markdown = new vscode.MarkdownString();

                    markdown.appendMarkdown(`**Substitution Variable:** \`${variableName}\`\n\n`);
                    markdown.appendMarkdown(`**Value:** ${value}\n\n`);

                    // If there are mutations, describe them
                    if (mutations.length > 0) {
                        markdown.appendMarkdown(`**Mutations Applied:**\n\n`);
                        const mutationDescription = describeMutationChain(mutations);
                        markdown.appendMarkdown(mutationDescription + '\n\n');
                        markdown.appendMarkdown(`**Usage:** \`{{${variableName} | ${mutations.join(' | ')}}}\``);
                    } else {
                        markdown.appendMarkdown(`**Usage:** \`{{${variableName}}}\``);
                    }

                    return new vscode.Hover(markdown, wordRange);
                }

                // If variable is not defined, return null (no hover)
                return null;
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

        // Check if we're inside a {{variable}} pattern (with possible mutations)
        const beforeText = lineText.substring(0, char);
        const afterText = lineText.substring(char);

        // Look for {{ before the cursor (including dots, pipes, and spaces for mutations)
        const beforeMatch = beforeText.match(/\{\{([a-zA-Z0-9_.\-|+\s]*)$/);
        if (!beforeMatch) {
            return null;
        }

        // Look for }} after the cursor (including dots, pipes, and spaces for mutations)
        const afterMatch = afterText.match(/^([a-zA-Z0-9_.\-|+\s]*)\}\}/);
        if (!afterMatch) {
            return null;
        }

        // Calculate the full content range (variable + mutations)
        const contentStart = char - beforeMatch[1].length;
        const contentEnd = char + afterMatch[1].length;

        // Ensure we're within the line bounds
        if (contentStart < 0 || contentEnd > lineText.length) {
            return null;
        }

        // Verify the full pattern is {{variable [| mutations]}}
        const fullPattern = lineText.substring(contentStart - 2, contentEnd + 2);
        if (!fullPattern.match(/^\{\{[a-zA-Z0-9_.\-|+\s]*\}\}$/)) {
            return null;
        }

        return new vscode.Range(
            new vscode.Position(position.line, contentStart),
            new vscode.Position(position.line, contentEnd)
        );
    }
}