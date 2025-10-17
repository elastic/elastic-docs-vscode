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
import { getMutationCompletionItems } from './mutations';


interface SubstitutionVariables {
    [key: string]: string;
}

export class SubstitutionCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        try {
            const lineText = document.lineAt(position).text;
            const textBefore = lineText.substring(0, position.character);

            // Check if we're typing {{ for substitution
            const substitutionMatch = textBefore.match(/\{\{([^}]*)$/);
            if (!substitutionMatch) {
                return [];
            }

            const content = substitutionMatch[1];

            // Check if we're after a pipe (mutation operator context)
            const pipeMatch = content.match(/^([a-zA-Z0-9_.-]+)\s*\|\s*([a-zA-Z0-9+.]*)$/);
            if (pipeMatch) {
                // We're typing a mutation operator after a pipe
                const partialOperator = pipeMatch[2];
                return this.createMutationCompletionItems(partialOperator);
            }

            // Check if we're after multiple pipes (chained mutations)
            const chainedMatch = content.match(/^([a-zA-Z0-9_.-]+)(?:\s*\|\s*[a-zA-Z0-9+.]+)*\s*\|\s*([a-zA-Z0-9+.]*)$/);
            if (chainedMatch) {
                const partialOperator = chainedMatch[2];
                return this.createMutationCompletionItems(partialOperator);
            }

            // Otherwise, suggest variable names
            const partialVariable = content;
            const substitutions = getSubstitutions(document.uri);

            return this.createCompletionItems(substitutions, partialVariable);
        } catch (error) {
            outputChannel.appendLine(`Error in substitution completion: ${error}`);
            return [];
        }
    }

    private createCompletionItems(
        substitutions: SubstitutionVariables,
        partialVariable: string
    ): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];

        for (const [key, value] of Object.entries(substitutions)) {
            // Filter by partial match if user has started typing
            if (partialVariable && !key.toLowerCase().includes(partialVariable.toLowerCase())) {
                continue;
            }

            const item = new vscode.CompletionItem(
                key,
                vscode.CompletionItemKind.Variable
            );

            item.insertText = key;

            // Show the full value in the detail field for the dropdown
            item.detail = `${value}`;

            // Enhanced documentation with better formatting for hover tooltips
            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`**Substitution Variable:** \`${key}\`\n\n`);
            markdown.appendMarkdown(`**Value:** ${value}\n\n`);
            markdown.appendMarkdown(`**Usage:** \`{{${key}}}\``);

            // Add additional context if the value is long
            if (value.length > 100) {
                markdown.appendMarkdown(`\n\n**Preview:** ${value.substring(0, 100)}...`);
            }

            item.documentation = markdown;

            // Add filter text to help with fuzzy matching
            item.filterText = key;

            items.push(item);
        }

        return items;
    }

    private createMutationCompletionItems(partialOperator: string): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        const mutationOperators = getMutationCompletionItems();

        for (const operator of mutationOperators) {
            // Filter by partial match if user has started typing
            if (partialOperator && !operator.operator.toLowerCase().includes(partialOperator.toLowerCase())) {
                continue;
            }

            const item = new vscode.CompletionItem(
                operator.operator,
                vscode.CompletionItemKind.Function
            );

            item.insertText = operator.operator;
            item.detail = operator.description;

            // Enhanced documentation with examples
            const markdown = new vscode.MarkdownString();
            markdown.appendMarkdown(`**Mutation Operator:** \`${operator.operator}\`\n\n`);
            markdown.appendMarkdown(`${operator.description}\n\n`);
            if (operator.example) {
                markdown.appendMarkdown(`**Example:** \`${operator.example}\`\n\n`);
            }
            markdown.appendMarkdown(`**Usage:** \`{{variable | ${operator.operator}}}\``);

            item.documentation = markdown;
            item.filterText = operator.operator;

            items.push(item);
        }

        return items;
    }
}