import * as vscode from 'vscode';
import { DIRECTIVES, PARAMETER_VALUES } from './directives';

/**
 * Provides intelligent completion for directive parameters
 */
export class ParameterCompletionProvider implements vscode.CompletionItemProvider {
    /**
     * Main entry point for providing parameter completion items
     * @param document The current text document
     * @param position The cursor position
     * @param token A cancellation token
     * @param context The completion context
     * @returns An array of completion items or null
     */
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        // Verify we're in a parameter completion context
        if (!this.isInParameterContext(context, document, position)) {
            return [];
        }
        
        // Find which directive we're inside of
        const directiveContext = this.detectEnclosingDirective(document, position);
        if (!directiveContext) {
            return [];
        }
        
        // Find the directive definition and generate parameter completions
        return this.generateParameterCompletions(directiveContext.name);
    }
    
    /**
     * Determines if we're in a context where parameter completion makes sense
     * @param context Completion context from VS Code
     * @param document The current document
     * @param position The cursor position
     * @returns Boolean indicating if we should show parameter completions
     */
    private isInParameterContext(
        context: vscode.CompletionContext,
        document: vscode.TextDocument, 
        position: vscode.Position
    ): boolean {
        // Only trigger on colon character
        if (context.triggerCharacter !== ':') {
            return false;
        }
        
        // Verify colon is at the start of the line
        const lineText = document.lineAt(position).text;
        const textBeforeCursor = lineText.substring(0, position.character);
        
        // We want exactly one colon at the start of the line
        return textBeforeCursor === ':';
    }
    
    /**
     * Finds the directive that contains the current cursor position
     * @param document The current document
     * @param position The cursor position
     * @returns Object with directive name and start line, or null if not found
     */
    private detectEnclosingDirective(
        document: vscode.TextDocument, 
        position: vscode.Position
    ): { name: string; startLine: number } | null {
        try {
            // Look backwards to find an opening directive
            for (let lineNum = position.line - 1; lineNum >= 0; lineNum--) {
                const line = document.lineAt(lineNum).text;
                
                // Regex to match directive opening format
                const directiveMatch = line.match(/^(:+)\{([a-zA-Z][a-zA-Z0-9_-]*)\}/);
                if (!directiveMatch) {
                    continue;
                }
                
                const colonCount = directiveMatch[1].length;
                const directiveName = directiveMatch[2];
                
                // Verify directive name is valid
                if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(directiveName)) {
                    continue;
                }
                
                // Look forward to find the closing directive
                const closingMarker = ':'.repeat(colonCount);
                const closingPattern = new RegExp(`^${closingMarker}$`);
                
                for (let endLine = lineNum + 1; endLine < document.lineCount; endLine++) {
                    const endLineText = document.lineAt(endLine).text;
                    
                    if (closingPattern.test(endLineText)) {
                        // Verify our position is within this directive block
                        if (position.line > lineNum && position.line < endLine) {
                            return { name: directiveName, startLine: lineNum };
                        }
                        break;
                    }
                }
            }
        } catch (error) {
            console.error('Error in parameter directive detection:', error);
            return null;
        }
        
        return null;
    }
    
    /**
     * Generates completion items for parameters of the given directive
     * @param directiveName The name of the directive we're in
     * @returns Array of CompletionItem objects for the directive's parameters
     */
    private generateParameterCompletions(directiveName: string): vscode.CompletionItem[] {
        // Find the directive in our definitions
        const directive = DIRECTIVES.find(d => d.name === directiveName);
        if (!directive) {
            return [];
        }
        
        // Create a completion item for each parameter
        return directive.parameters.map(paramName => {
            const item = new vscode.CompletionItem(
                paramName,
                vscode.CompletionItemKind.Property
            );
            
            // Get suggested values for this parameter from our predefined list
            const suggestedValues = PARAMETER_VALUES[paramName] || ['value'];
            const exampleValue = suggestedValues[0];
            
            // Create a snippet with parameter name and placeholder for the value
            item.insertText = new vscode.SnippetString(`${paramName}: \${1:${exampleValue}}`);
            
            // Add helpful details
            item.detail = `Parameter for ${directive.name} directive`;
            item.documentation = new vscode.MarkdownString(
                `Adds the \`${paramName}\` parameter with a suggested value of "${exampleValue}"`
            );
            
            return item;
        });
    }
}