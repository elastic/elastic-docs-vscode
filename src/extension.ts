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
import { DirectiveCompletionProvider } from './directiveCompletionProvider';
import { ParameterCompletionProvider } from './parameterCompletionProvider';
import { RoleCompletionProvider } from './roleCompletionProvider';
import { DirectiveDiagnosticProvider } from './directiveDiagnosticProvider';
import { SubstitutionCompletionProvider } from './substitutionCompletionProvider';
import { SubstitutionHoverProvider } from './substitutionHoverProvider';
import { FrontmatterCompletionProvider } from './frontmatterCompletionProvider';
import { FrontmatterValidationProvider } from './frontmatterValidationProvider';

import { outputChannel } from './logger';

export function activate(context: vscode.ExtensionContext): void {
    // Debug logging
    outputChannel.appendLine('Elastic Docs V3 Utilities: Extension activated');
    outputChannel.appendLine('Registering completion providers...');
    
    // Apply color customizations programmatically
    applyColorCustomizations();
    
    // Test grammar loading
    testGrammarLoading();
    
    // Ensure we're working with markdown files and handle potential conflicts
    
    // Note: getLanguages() is async, but we'll proceed without this check
    // as the extension should work fine even if markdown support is loaded later

    const directiveProvider = new DirectiveCompletionProvider();
    const parameterProvider = new ParameterCompletionProvider();
    const roleProvider = new RoleCompletionProvider();
    const diagnosticProvider = new DirectiveDiagnosticProvider();
    const substitutionProvider = new SubstitutionCompletionProvider();
    const substitutionHoverProvider = new SubstitutionHoverProvider();
    const frontmatterProvider = new FrontmatterCompletionProvider();
    const frontmatterValidator = new FrontmatterValidationProvider();

    // Register completion providers for markdown files
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: '*', language: 'markdown', pattern: '**/*.md' },
            directiveProvider,
            ':', '{'
        )
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: '*', language: 'markdown', pattern: '**/*.md' },
            parameterProvider,
            ':'
        )
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: '*', language: 'markdown', pattern: '**/*.md' },
            roleProvider,
            '{', '`'
        )
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: '*', language: 'markdown', pattern: '**/*.md' },
            substitutionProvider,
            '{'
        )
    );
    outputChannel.appendLine('Substitution completion provider registered');

    // Register hover provider for substitution variables
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(
            { scheme: '*', language: 'markdown', pattern: '**/*.md' },
            substitutionHoverProvider
        )
    );
    outputChannel.appendLine('Substitution hover provider registered');

    // Register frontmatter completion provider
    // Trigger on colon for values, space after colon, and other key characters
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: '*', language: 'markdown', pattern: '**/*.md' },
            frontmatterProvider,
            ':', ' ', '-' // Colon triggers value completion, space triggers after colon, dash for arrays
        )
    );
    outputChannel.appendLine('Frontmatter completion provider registered');

    // Register diagnostic providers
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('elastic-directives');
    const frontmatterDiagnosticCollection = vscode.languages.createDiagnosticCollection('elastic-frontmatter');
    context.subscriptions.push(diagnosticCollection);
    context.subscriptions.push(frontmatterDiagnosticCollection);
    
    // Update diagnostics when document changes
    const updateDiagnostics = (document: vscode.TextDocument): void => {
        if (document.languageId === 'markdown') {
            // Directive diagnostics
            const diagnostics = diagnosticProvider.provideDiagnostics(document);
            diagnosticCollection.set(document.uri, diagnostics);
            
            // Frontmatter diagnostics
            const frontmatterDiagnostics = frontmatterValidator.validateDocument(document);
            frontmatterDiagnosticCollection.set(document.uri, frontmatterDiagnostics);
        }
    };
    
    // Initial diagnostics
    if (vscode.window.activeTextEditor) {
        updateDiagnostics(vscode.window.activeTextEditor.document);
    }
    
    // Listen for document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            updateDiagnostics(event.document);
        })
    );
    
    // Listen for document opens
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            updateDiagnostics(document);
        })
    );

    // Listen for document saves (for frontmatter validation)
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => {
            if (document.languageId === 'markdown') {
                // Re-run frontmatter validation on save
                const frontmatterDiagnostics = frontmatterValidator.validateDocument(document);
                frontmatterDiagnosticCollection.set(document.uri, frontmatterDiagnostics);
            }
        })
    );

    // Listen for workspace changes to clear substitution cache
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.fileName.endsWith('docset.yml') || event.document.fileName.endsWith('_docset.yml')) {
                substitutionProvider.clearCache();
                substitutionHoverProvider.clearCache();
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => {
            if (document.fileName.endsWith('docset.yml') || document.fileName.endsWith('_docset.yml')) {
                substitutionProvider.clearCache();
                substitutionHoverProvider.clearCache();
            }
        })
    );

    // Register command to replace entire line
    context.subscriptions.push(
        vscode.commands.registerCommand('elastic-docs-v3.replaceEntireLine', (template: string) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const position = editor.selection.active;
            const line = editor.document.lineAt(position.line);
            
            // Replace the entire line with the template
            const range = new vscode.Range(
                new vscode.Position(position.line, 0),
                new vscode.Position(position.line, line.text.length)
            );
            
            editor.edit(editBuilder => {
                editBuilder.replace(range, template);
            });
        })
    );

    // Debug: Check grammar loading
    setTimeout(() => {
        outputChannel.appendLine('Elastic Docs V3: Checking grammar loading...');
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.languageId === 'markdown') {
            outputChannel.appendLine('Elastic Docs V3: Active document is markdown');
            outputChannel.appendLine(`Elastic Docs V3: Document URI: ${activeEditor.document.uri.toString()}`);
        }
    }, 2000);
}

function applyColorCustomizations(): void {
    const config = vscode.workspace.getConfiguration('editor');
    const currentCustomizations = config.get('tokenColorCustomizations') as Record<string, unknown> || {};
    
    // Define our custom color rules
    const elasticRules = [
        {
            "scope": "markup.directive.punctuation.elastic",
            "settings": {
                "foreground": "#569cd6",
                "fontStyle": "bold"
            }
        },
        {
            "scope": "markup.directive.punctuation.brace.elastic",
            "settings": {
                "foreground": "#569cd6",
                "fontStyle": "bold"
            }
        },
        {
            "scope": "markup.directive.name.elastic",
            "settings": {
                "foreground": "#4ec9b0",
                "fontStyle": "bold"
            }
        },
        {
            "scope": "markup.directive.argument.elastic",
            "settings": {
                "foreground": "#ce9178",
                "fontStyle": "italic"
            }
        },
        {
            "scope": "markup.role.name.elastic",
            "settings": {
                "foreground": "#c586c0",
                "fontStyle": "bold"
            }
        },
        {
            "scope": "markup.role.punctuation.elastic",
            "settings": {
                "foreground": "#c586c0"
            }
        },
        {
            "scope": "markup.role.content.elastic",
            "settings": {
                "foreground": "#d7ba7d"
            }
        },
        {
            "scope": "markup.substitution.punctuation.elastic",
            "settings": {
                "foreground": "#569cd6",
                "fontStyle": "bold"
            }
        },
        {
            "scope": "markup.substitution.variable.elastic",
            "settings": {
                "foreground": "#4ec9b0",
                "fontStyle": "bold"
            }
        }
    ];
    
    // Merge with existing rules
    const existingRules = (currentCustomizations.textMateRules as unknown[]) || [];
    const newRules = [...existingRules, ...elasticRules];
    
    // Apply the customizations
    config.update('tokenColorCustomizations', {
        ...currentCustomizations,
        textMateRules: newRules
    }, vscode.ConfigurationTarget.Global);
}

function testGrammarLoading(): void {
    // Test if our grammar is loaded
    setTimeout(() => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor && activeEditor.document.languageId === 'markdown') {
            outputChannel.appendLine('Elastic Docs V3: Testing grammar on active markdown file');
            
            // Check if our scopes are being applied
            const document = activeEditor.document;
            const position = new vscode.Position(0, 0);
            const token = document.getWordRangeAtPosition(position);
            
            if (token) {
                const tokens = document.getText(token);
                outputChannel.appendLine(`Elastic Docs V3: Found tokens at start: ${tokens}`);
            }
        }
    }, 2000);
}

export function deactivate(): void {}