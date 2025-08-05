import * as vscode from 'vscode';
import { DirectiveCompletionProvider } from './directiveCompletionProvider';
import { ParameterCompletionProvider } from './parameterCompletionProvider';
import { RoleCompletionProvider } from './roleCompletionProvider';
import { DirectiveDiagnosticProvider } from './directiveDiagnosticProvider';

/**
 * Activates the extension when a markdown file is opened
 * @param context The extension context provided by VS Code
 */
export function activate(context: vscode.ExtensionContext): void {
    // Initialize providers
    const directiveProvider = new DirectiveCompletionProvider();
    const parameterProvider = new ParameterCompletionProvider();
    const roleProvider = new RoleCompletionProvider();
    const diagnosticProvider = new DirectiveDiagnosticProvider();

    // Set up completion for directive syntax
    registerMarkdownCompletionProviders(context, directiveProvider, parameterProvider, roleProvider);
    
    // Set up diagnostics for directive validation
    setupDirectiveDiagnostics(context, diagnosticProvider);
    
    // Register utility commands
    registerUtilityCommands(context);
}

/**
 * Registers all completion providers for markdown files
 * @param context Extension context
 * @param directiveProvider Provider for directive completion
 * @param parameterProvider Provider for parameter completion
 * @param roleProvider Provider for role completion
 */
function registerMarkdownCompletionProviders(
    context: vscode.ExtensionContext,
    directiveProvider: DirectiveCompletionProvider,
    parameterProvider: ParameterCompletionProvider,
    roleProvider: RoleCompletionProvider
): void {
    // Register directive completion (triggered by ':' or '{')
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'markdown' },
            directiveProvider,
            ':', '{'
        )
    );

    // Register parameter completion (triggered by ':')
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'markdown' },
            parameterProvider,
            ':'
        )
    );

    // Register role completion (triggered by '{' or '`')
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'markdown' },
            roleProvider,
            '{', '`'
        )
    );
}

/**
 * Sets up diagnostics for directive validation
 * @param context Extension context
 * @param diagnosticProvider Provider for directive diagnostics
 */
function setupDirectiveDiagnostics(
    context: vscode.ExtensionContext,
    diagnosticProvider: DirectiveDiagnosticProvider
): void {
    // Create diagnostic collection
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('elastic-directives');
    context.subscriptions.push(diagnosticCollection);
    
    // Function to update diagnostics for a document
    const updateDiagnostics = (document: vscode.TextDocument): void => {
        if (document.languageId === 'markdown') {
            const diagnostics = diagnosticProvider.provideDiagnostics(document);
            diagnosticCollection.set(document.uri, diagnostics);
        }
    };
    
    // Update diagnostics for active editor when extension activates
    if (vscode.window.activeTextEditor) {
        updateDiagnostics(vscode.window.activeTextEditor.document);
    }
    
    // Update diagnostics when document content changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            updateDiagnostics(event.document);
        })
    );
    
    // Update diagnostics when a new document is opened
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(document => {
            updateDiagnostics(document);
        })
    );
}

/**
 * Registers utility commands for the extension
 * @param context Extension context
 */
function registerUtilityCommands(context: vscode.ExtensionContext): void {
    // Register command to replace entire line with a template
    context.subscriptions.push(
        vscode.commands.registerCommand('elastic-docs-v3.replaceEntireLine', (template: string) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const position = editor.selection.active;
            const line = editor.document.lineAt(position.line);
            
            // Create a range that covers the entire line
            const lineRange = new vscode.Range(
                new vscode.Position(position.line, 0),
                new vscode.Position(position.line, line.text.length)
            );
            
            // Apply the edit operation
            editor.edit(editBuilder => {
                editBuilder.replace(lineRange, template);
            });
        })
    );
}

export function deactivate(): void {}