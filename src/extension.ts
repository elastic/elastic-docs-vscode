import * as vscode from 'vscode';
import { DirectiveCompletionProvider } from './directiveCompletionProvider';
import { ParameterCompletionProvider } from './parameterCompletionProvider';
import { RoleCompletionProvider } from './roleCompletionProvider';
import { DirectiveDiagnosticProvider } from './directiveDiagnosticProvider';

export function activate(context: vscode.ExtensionContext): void {
    const directiveProvider = new DirectiveCompletionProvider();
    const parameterProvider = new ParameterCompletionProvider();
    const roleProvider = new RoleCompletionProvider();
    const diagnosticProvider = new DirectiveDiagnosticProvider();

    // Register completion providers for markdown files
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'markdown' },
            directiveProvider,
            ':', '{'
        )
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'markdown' },
            parameterProvider,
            ':'
        )
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'markdown' },
            roleProvider,
            '{', '`'
        )
    );

    // Register diagnostic provider for directive validation
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('elastic-directives');
    context.subscriptions.push(diagnosticCollection);
    
    // Update diagnostics when document changes
    const updateDiagnostics = (document: vscode.TextDocument): void => {
        if (document.languageId === 'markdown') {
            const diagnostics = diagnosticProvider.provideDiagnostics(document);
            diagnosticCollection.set(document.uri, diagnostics);
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
}

export function deactivate(): void {}