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

export class DirectiveCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        try {
            const lineText = document.lineAt(position).text;
            const textBefore = lineText.substring(0, position.character);
        
        // Count colons at the start of the line
        const colonMatch = textBefore.match(/^(:+)/);
        const colonCount = colonMatch ? colonMatch[1].length : 0;
        
        // Check if we're at the start of a directive
        if (colonCount >= 3) {
            const afterColons = textBefore.substring(colonCount);
            
            // Case 1: ::: (show all directives)
            if (afterColons === '') {
                return this.getAllDirectiveCompletions();
            }
            
            // Case 2: :::{  (show directives with arguments)
            if (afterColons === '{') {
                return this.getDirectivesWithArgumentsCompletions();
            }
            
            // Case 3: :::{partial (filter directives with arguments)
            if (afterColons.startsWith('{') && !afterColons.includes('}')) {
                const partialName = afterColons.substring(1);
                return this.getFilteredDirectivesWithArguments(partialName);
            }
            
            // Case 4: :::{partial} (autoclosed bracket scenario)
            if (afterColons.startsWith('{') && afterColons.endsWith('}')) {
                const partialName = afterColons.substring(1, afterColons.length - 1);
                return this.getFilteredDirectivesWithArguments(partialName);
            }
        }
            
            return [];
        } catch (error) {
            // If there's an error during completion, return empty array to avoid breaking the editor
            return [];
        }
    }
    
    private getAllDirectiveCompletions(): vscode.CompletionItem[] {
        return DIRECTIVES.map(directive => {
            const item = new vscode.CompletionItem(
                `{${directive.name}}`,
                this.getDirectiveIcon(directive.name)
            );
            
            item.command = {
                command: 'elastic-docs-v3.replaceEntireLine',
                title: 'Replace entire line',
                arguments: [directive.template]
            };
            
            item.detail = directive.description;
            item.documentation = new vscode.MarkdownString(`Insert ${directive.name} directive`);
            
            return item;
        });
    }
    
    private getDirectivesWithArgumentsCompletions(): vscode.CompletionItem[] {
        return DIRECTIVES
            .filter(directive => directive.hasArgument)
            .map(directive => {
                const item = new vscode.CompletionItem(
                    directive.name,
                    this.getDirectiveIcon(directive.name)
                );
                
                let template = directive.template;
                
                // Replace the directive name with a snippet placeholder
                template = template.replace(`{${directive.name}}`, `{${directive.name}} \${1:argument}`);
                
                item.command = {
                    command: 'elastic-docs-v3.replaceEntireLine',
                    title: 'Replace entire line',
                    arguments: [template]
                };
                
                item.detail = directive.description;
                item.documentation = new vscode.MarkdownString(`Insert ${directive.name} directive with argument`);
                
                return item;
            });
    }
    
    private getFilteredDirectivesWithArguments(partialName: string): vscode.CompletionItem[] {
        return DIRECTIVES
            .filter(directive => 
                directive.hasArgument && 
                directive.name.toLowerCase().startsWith(partialName.toLowerCase())
            )
            .map(directive => {
                const item = new vscode.CompletionItem(
                    directive.name,
                    this.getDirectiveIcon(directive.name)
                );
                
                let template = directive.template;
                
                // Replace the directive name with a snippet placeholder
                template = template.replace(`{${directive.name}}`, `{${directive.name}} \${1:argument}`);
                
                item.command = {
                    command: 'elastic-docs-v3.replaceEntireLine',
                    title: 'Replace entire line',
                    arguments: [template]
                };
                
                item.detail = directive.description;
                item.documentation = new vscode.MarkdownString(`Insert ${directive.name} directive with argument`);
                
                return item;
            });
    }
    
    private getDirectiveIcon(directiveName: string): vscode.CompletionItemKind {
        // Map directive names to appropriate VS Code icons
        switch (directiveName) {
            // Admonitions (info/warning icons)
            case 'note':
                return vscode.CompletionItemKind.Snippet;
            case 'warning':
                return vscode.CompletionItemKind.Snippet;
            case 'tip':
                return vscode.CompletionItemKind.Snippet;
            case 'important':
                return vscode.CompletionItemKind.Snippet;
            case 'admonition':
                return vscode.CompletionItemKind.Snippet;
            
            // Content organization (folder/document icons)
            case 'dropdown':
                return vscode.CompletionItemKind.Snippet;
            case 'tab-set':
                return vscode.CompletionItemKind.Snippet;
            case 'stepper':
                return vscode.CompletionItemKind.Snippet;
            
            // Media and visuals (image/video icons)
            case 'image':
                return vscode.CompletionItemKind.Snippet;
            case 'carousel':
                return vscode.CompletionItemKind.Snippet;
            case 'diagram':
                return vscode.CompletionItemKind.Snippet;
            
            // Content inclusion (link icons)
            case 'include':
                return vscode.CompletionItemKind.Snippet;
            
            // Default
            default:
                return vscode.CompletionItemKind.Snippet;
        }
    }
}