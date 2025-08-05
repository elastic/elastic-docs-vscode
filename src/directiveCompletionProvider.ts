import * as vscode from 'vscode';
import { DIRECTIVES } from './directives';

/**
 * Provides intelligent completion for Elastic Docs directives
 */
export class DirectiveCompletionProvider implements vscode.CompletionItemProvider {
    /**
     * Main completion provider method - analyzes the context and suggests appropriate completions
     * @param document Current text document
     * @param position Current cursor position
     * @param _token Cancellation token
     * @param _context Completion context
     * @returns CompletionItems or null
     */
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        try {
            // Get text up to cursor position for analysis
            const lineText = document.lineAt(position).text;
            const textBeforeCursor = lineText.substring(0, position.character);
            
            // Determine if we're in a directive context
            return this.analyzeCompletionContext(textBeforeCursor);
        } catch (error) {
            // Graceful error handling to prevent editor disruption
            console.error('Error in directive completion:', error);
            return [];
        }
    }

    /**
     * Analyzes the text before cursor to determine completion context
     * @param textBeforeCursor Text of the current line up to cursor position
     * @returns Array of completion items based on context
     */
    private analyzeCompletionContext(textBeforeCursor: string): vscode.CompletionItem[] {
        // Check for directive start pattern with colons
        const colonMatch = textBeforeCursor.match(/^(:+)/);
        if (!colonMatch || colonMatch[1].length < 3) {
            return [];
        }

        const colonCount = colonMatch[1].length;
        const textAfterColons = textBeforeCursor.substring(colonCount);
        
        // Determine which completion scenario we're in
        if (textAfterColons === '') {
            // Case: ::: (bare colons) - show all directives
            return this.generateAllDirectiveCompletions();
        } else if (textAfterColons === '{') {
            // Case: :::{  - show directives that accept arguments
            return this.generateArgumentDirectiveCompletions();
        } else if (textAfterColons.startsWith('{') && !textAfterColons.includes('}')) {
            // Case: :::{dir - partial directive name, filter suggestions
            const partialName = textAfterColons.substring(1);
            return this.generateFilteredDirectiveCompletions(partialName);
        } else if (textAfterColons.startsWith('{') && textAfterColons.endsWith('}')) {
            // Case: :::{dir} - complete directive with closing brace
            const partialName = textAfterColons.substring(1, textAfterColons.length - 1);
            return this.generateFilteredDirectiveCompletions(partialName);
        }
        
        return [];
    }
    
    /**
     * Creates completions for all available directives
     * @returns Array of CompletionItems for all directives
     */
    private generateAllDirectiveCompletions(): vscode.CompletionItem[] {
        return DIRECTIVES.map(directive => {
            // Create basic completion item
            const item = new vscode.CompletionItem(
                `{${directive.name}}`,
                this.selectDirectiveIcon(directive.name)
            );
            
            // Add command to replace the current line with template when selected
            item.command = {
                command: 'elastic-docs-v3.replaceEntireLine',
                title: 'Replace entire line',
                arguments: [directive.template]
            };
            
            // Add helpful details
            item.detail = directive.description;
            item.documentation = new vscode.MarkdownString(`Insert complete ${directive.name} directive structure`);
            
            return item;
        });
    }
    
    /**
     * Creates completions for directives that accept arguments
     * @returns Array of CompletionItems for directives with arguments
     */
    private generateArgumentDirectiveCompletions(): vscode.CompletionItem[] {
        return DIRECTIVES
            .filter(directive => directive.hasArgument)
            .map(directive => {
                // Create basic completion item
                const item = new vscode.CompletionItem(
                    directive.name,
                    this.selectDirectiveIcon(directive.name)
                );
                
                // Prepare template with placeholder for the argument
                let modifiedTemplate = directive.template;
                modifiedTemplate = modifiedTemplate.replace(
                    `{${directive.name}}`, 
                    `{${directive.name}} \${1:argument}`
                );
                
                // Add command to replace the current line with modified template
                item.command = {
                    command: 'elastic-docs-v3.replaceEntireLine',
                    title: 'Replace entire line',
                    arguments: [modifiedTemplate]
                };
                
                // Add helpful details
                item.detail = directive.description;
                item.documentation = new vscode.MarkdownString(
                    `Insert ${directive.name} directive with argument placeholder`
                );
                
                return item;
            });
    }
    
    /**
     * Creates filtered completions based on partial directive name
     * @param partialName Partial directive name to filter by
     * @returns Array of filtered CompletionItems
     */
    private generateFilteredDirectiveCompletions(partialName: string): vscode.CompletionItem[] {
        return DIRECTIVES
            .filter(directive => 
                directive.hasArgument && 
                directive.name.toLowerCase().includes(partialName.toLowerCase())
            )
            .map(directive => {
                // Create basic completion item
                const item = new vscode.CompletionItem(
                    directive.name,
                    this.selectDirectiveIcon(directive.name)
                );
                
                // Prepare template with placeholder for the argument
                let modifiedTemplate = directive.template;
                modifiedTemplate = modifiedTemplate.replace(
                    `{${directive.name}}`, 
                    `{${directive.name}} \${1:argument}`
                );
                
                // Add command to replace the current line with modified template
                item.command = {
                    command: 'elastic-docs-v3.replaceEntireLine',
                    title: 'Replace entire line',
                    arguments: [modifiedTemplate]
                };
                
                // Add helpful details
                item.detail = directive.description;
                item.documentation = new vscode.MarkdownString(
                    `Insert ${directive.name} directive with argument placeholder`
                );
                
                return item;
            });
    }
    
    /**
     * Selects an appropriate icon for each directive type
     * @param directiveName Name of the directive
     * @returns CompletionItemKind representing an appropriate icon
     */
    private selectDirectiveIcon(directiveName: string): vscode.CompletionItemKind {
        // Semantic grouping of directives by function
        const admonitions = ['note', 'warning', 'tip', 'important', 'admonition'];
        const containers = ['dropdown', 'tab-set', 'stepper', 'tab-item', 'step'];
        const media = ['image', 'carousel', 'diagram'];
        const includes = ['include'];
        
        // Select icon based on directive category
        if (admonitions.includes(directiveName)) {
            return directiveName === 'warning' || directiveName === 'important'
                ? vscode.CompletionItemKind.Issue 
                : vscode.CompletionItemKind.Reference;
        } else if (containers.includes(directiveName)) {
            return directiveName === 'dropdown' 
                ? vscode.CompletionItemKind.Folder 
                : vscode.CompletionItemKind.Class;
        } else if (media.includes(directiveName)) {
            return directiveName === 'diagram' 
                ? vscode.CompletionItemKind.Struct 
                : vscode.CompletionItemKind.File;
        } else if (includes.includes(directiveName)) {
            return vscode.CompletionItemKind.Module;
        } 
        
        // Default fallback
        return vscode.CompletionItemKind.Snippet;
    }
}