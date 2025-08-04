import * as vscode from 'vscode';
import { DIRECTIVES, PARAMETER_VALUES } from './directives';

export class ParameterCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        // Only trigger on colon at the beginning of a line
        if (context.triggerCharacter !== ':') {
            return [];
        }
        
        const lineText = document.lineAt(position).text;
        const textBefore = lineText.substring(0, position.character);
        
        // Check if we're at the start of a line with a colon
        if (!textBefore.match(/^:$/)) {
            return [];
        }
        
        // Find the directive this parameter belongs to
        const directiveInfo = this.findContainingDirective(document, position);
        if (!directiveInfo) {
            return [];
        }
        
        const directive = DIRECTIVES.find(d => d.name === directiveInfo.name);
        if (!directive) {
            return [];
        }
        
        return directive.parameters.map(param => {
            const item = new vscode.CompletionItem(
                param,
                vscode.CompletionItemKind.Property
            );
            
            // Get suggested values for this parameter
            const suggestedValues = PARAMETER_VALUES[param] || ['value'];
            const sampleValue = suggestedValues[0];
            
            item.insertText = new vscode.SnippetString(`${param}: \${1:${sampleValue}}`);
            item.detail = `Parameter for ${directive.name} directive`;
            item.documentation = new vscode.MarkdownString(`Insert ${param} parameter with suggested value`);
            
            return item;
        });
    }
    
    private findContainingDirective(document: vscode.TextDocument, position: vscode.Position): { name: string; startLine: number } | null {
        try {
            // Look backwards to find the opening directive
            for (let lineNum = position.line - 1; lineNum >= 0; lineNum--) {
                const line = document.lineAt(lineNum).text;
                
                // Check for directive opening
                const directiveMatch = line.match(/^(:+)\{([^}]+)\}/);
                if (directiveMatch) {
                    const colonCount = directiveMatch[1].length;
                    const directiveName = directiveMatch[2];
                    
                    // Validate directive name format
                    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(directiveName)) {
                        continue;
                    }
                
                // Look forward to find the closing directive
                const closingPattern = new RegExp(`^${':'.repeat(colonCount)}$`);
                for (let endLine = lineNum + 1; endLine < document.lineCount; endLine++) {
                    const endLineText = document.lineAt(endLine).text;
                    if (closingPattern.test(endLineText)) {
                        // Check if our position is within this directive
                        if (position.line > lineNum && position.line < endLine) {
                            return { name: directiveName, startLine: lineNum };
                        }
                        break;
                    }
                }
            }
            }
        } catch (error) {
            // If there's an error during parsing, return null to avoid breaking completion
            return null;
        }
        
        return null;
    }
}