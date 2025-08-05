import * as vscode from 'vscode';
import { DIRECTIVES } from './directives';

/**
 * Represents a directive block in the document
 */
interface DirectiveBlock {
    /** The full text of the opening line */
    opening: string;
    
    /** Range in the document where the opening line appears */
    openingRange: vscode.Range;
    
    /** The directive name */
    name: string;
    
    /** Range of the directive name */
    nameRange: vscode.Range;
    
    /** Optional argument after the directive name */
    argument?: string;
    
    /** Range of the argument if present */
    argumentRange?: vscode.Range;
    
    /** The full text of the closing line */
    closing?: string;
    
    /** Range in the document where the closing line appears */
    closingRange?: vscode.Range;
    
    /** Number of colons in the opening directive */
    openingColons: number;
    
    /** Number of colons in the closing directive */
    closingColons?: number;
    
    /** Parameters within the directive */
    parameters: Parameter[];
    
    /** Line numbers of content lines within the directive */
    contentLines: number[];
    
    /** Indicates if the directive syntax is malformed */
    isMalformed?: boolean;
    
    /** Indicates a specific malformation: missing closing brace */
    missingClosingBrace?: boolean;
}

/**
 * Represents a parameter within a directive
 */
interface Parameter {
    /** Parameter name */
    name: string;
    
    /** Parameter value (if any) */
    value?: string;
    
    /** Range in the document where the parameter appears */
    range: vscode.Range;
}

/**
 * Provides diagnostics for Elastic Docs directives
 * Identifies syntax errors and provides validation warnings
 */
export class DirectiveDiagnosticProvider {
    /**
     * Analyzes a document and returns diagnostics for directive issues
     * @param document The document to analyze
     * @returns Array of diagnostic objects for the document
     */
    provideDiagnostics(document: vscode.TextDocument): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        
        try {
            // Parse the entire document for directive blocks
            const directiveBlocks = this.analyzeDocumentStructure(document);
            
            // Validate each block and collect diagnostics
            for (const block of directiveBlocks) {
                const blockDiagnostics = this.validateDirectiveBlock(block);
                diagnostics.push(...blockDiagnostics);
            }
        } catch (error) {
            console.error('Error in directive diagnostics:', error);
        }
        
        return diagnostics;
    }
    
    /**
     * Analyzes the document and identifies all directive blocks
     * @param document The document to analyze
     * @returns Array of DirectiveBlock objects representing the structure
     */
    private analyzeDocumentStructure(document: vscode.TextDocument): DirectiveBlock[] {
        const blocks: DirectiveBlock[] = [];
        const blockStack: DirectiveBlock[] = [];
        
        // Process each line in the document
        for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
            const line = document.lineAt(lineNum);
            const lineText = line.text;
            
            // Try to match different directive patterns
            if (this.processOpeningDirective(lineNum, lineText, blocks, blockStack)) {
                continue;
            }
            
            if (this.processMalformedDirective(lineNum, lineText, blocks, blockStack)) {
                continue;
            }
            
            if (this.processClosingDirective(lineNum, lineText, blockStack)) {
                continue;
            }
            
            // If none of the above, it might be a parameter or content line
            this.processContentOrParameter(lineNum, lineText, blockStack);
        }
        
        return blocks;
    }
    
    /**
     * Processes a line that looks like a properly formatted opening directive
     * @param lineNum Line number
     * @param lineText Text of the line
     * @param blocks Array of all blocks
     * @param blockStack Stack of currently open blocks
     * @returns True if the line was processed as an opening directive
     */
    private processOpeningDirective(
        lineNum: number, 
        lineText: string, 
        blocks: DirectiveBlock[], 
        blockStack: DirectiveBlock[]
    ): boolean {
        // Pattern: :::{directiveName} [argument]
        const openingMatch = lineText.match(/^(:{3,})\{([a-zA-Z][a-zA-Z0-9_-]*)\}(?:\s+(.*))?$/);
        if (!openingMatch) {
            return false;
        }
        
        const colonCount = openingMatch[1].length;
        const directiveName = openingMatch[2];
        const argument = openingMatch[3];
        
        // Create a new block for this directive
        const newBlock: DirectiveBlock = {
            opening: lineText,
            openingRange: new vscode.Range(lineNum, 0, lineNum, lineText.length),
            name: directiveName,
            nameRange: new vscode.Range(
                lineNum, 
                openingMatch[1].length + 1, 
                lineNum, 
                openingMatch[1].length + 1 + directiveName.length
            ),
            openingColons: colonCount,
            parameters: [],
            contentLines: [],
        };
        
        // Add argument details if present
        if (argument) {
            newBlock.argument = argument;
            newBlock.argumentRange = new vscode.Range(
                lineNum, 
                openingMatch[1].length + directiveName.length + 2, 
                lineNum, 
                lineText.length
            );
        }
        
        // Add to our collections
        blocks.push(newBlock);
        blockStack.push(newBlock);
        return true;
    }
    
    /**
     * Processes a line that looks like a malformed opening directive
     * @param lineNum Line number
     * @param lineText Text of the line
     * @param blocks Array of all blocks
     * @param blockStack Stack of currently open blocks
     * @returns True if the line was processed as a malformed directive
     */
    private processMalformedDirective(
        lineNum: number, 
        lineText: string, 
        blocks: DirectiveBlock[], 
        blockStack: DirectiveBlock[]
    ): boolean {
        // Case 1: Missing closing brace - :::{name
        const missingBraceMatch = lineText.match(/^(:{3,})\{([a-zA-Z][a-zA-Z0-9_-]*)(?:\s+(.*))?$/);
        if (missingBraceMatch) {
            const block = this.createMalformedBlock(
                lineNum, lineText, missingBraceMatch, true
            );
            blocks.push(block);
            blockStack.push(block);
            return true;
        }
        
        // Case 2: Missing braces entirely - :::name
        const noBracesMatch = lineText.match(/^(:{3,})([a-zA-Z][a-zA-Z0-9_-]*)(?:\s+(.*))?$/);
        if (noBracesMatch) {
            const block = this.createMalformedBlock(
                lineNum, lineText, noBracesMatch, false
            );
            blocks.push(block);
            blockStack.push(block);
            return true;
        }
        
        return false;
    }
    
    /**
     * Creates a block object for a malformed directive
     * @param lineNum Line number
     * @param lineText Text of the line
     * @param match RegExp match result
     * @param missingClosingBrace Whether this is missing a closing brace
     * @returns A DirectiveBlock object
     */
    private createMalformedBlock(
        lineNum: number, 
        lineText: string, 
        match: RegExpMatchArray,
        missingClosingBrace: boolean
    ): DirectiveBlock {
        const colonCount = match[1].length;
        const directiveName = match[2];
        const argument = match[3];
        
        const block: DirectiveBlock = {
            opening: lineText,
            openingRange: new vscode.Range(lineNum, 0, lineNum, lineText.length),
            name: directiveName,
            nameRange: new vscode.Range(
                lineNum, 
                match[1].length + (missingClosingBrace ? 1 : 0), 
                lineNum, 
                match[1].length + (missingClosingBrace ? 1 : 0) + directiveName.length
            ),
            openingColons: colonCount,
            parameters: [],
            contentLines: [],
            isMalformed: true,
            missingClosingBrace: missingClosingBrace
        };
        
        // Add argument details if present
        if (argument) {
            block.argument = argument;
            block.argumentRange = new vscode.Range(
                lineNum, 
                match[1].length + directiveName.length + (missingClosingBrace ? 2 : 1), 
                lineNum, 
                lineText.length
            );
        }
        
        return block;
    }
    
    /**
     * Processes a line that looks like a closing directive
     * @param lineNum Line number
     * @param lineText Text of the line
     * @param blockStack Stack of currently open blocks
     * @returns True if the line was processed as a closing directive
     */
    private processClosingDirective(
        lineNum: number, 
        lineText: string, 
        blockStack: DirectiveBlock[]
    ): boolean {
        // Pattern: ::: (just colons)
        const closingMatch = lineText.match(/^(:+)\s*$/);
        if (!closingMatch || blockStack.length === 0) {
            return false;
        }
        
        const colonCount = closingMatch[1].length;
        
        // Find the matching open block to close
        // Process from the end of the stack to handle nested directives correctly
        for (let i = blockStack.length - 1; i >= 0; i--) {
            const block = blockStack[i];
            
            // If this is a match for an unclosed block
            if (block.openingColons === colonCount && !block.closing) {
                // Update the block with closing details
                block.closing = lineText;
                block.closingRange = new vscode.Range(lineNum, 0, lineNum, lineText.length);
                block.closingColons = colonCount;
                
                // Remove this block and all blocks after it from the stack
                blockStack.splice(i);
                return true;
            }
        }
        
        // If we get here, it's a closing directive without a matching opening
        return true;
    }
    
    /**
     * Processes a line that might be content or a parameter
     * @param lineNum Line number
     * @param lineText Text of the line
     * @param blockStack Stack of currently open blocks
     */
    private processContentOrParameter(
        lineNum: number, 
        lineText: string, 
        blockStack: DirectiveBlock[]
    ): void {
        // Only process if we're inside at least one block
        if (blockStack.length === 0) {
            return;
        }
        
        // Get the innermost block
        const currentBlock = blockStack[blockStack.length - 1];
        
        // Check if this is a parameter line
        const paramMatch = lineText.match(/^:([a-zA-Z][a-zA-Z0-9_-]*):(?:\s+(.*))?$/);
        if (paramMatch) {
            // Add this as a parameter to the current block
            currentBlock.parameters.push({
                name: paramMatch[1],
                value: paramMatch[2],
                range: new vscode.Range(lineNum, 0, lineNum, lineText.length)
            });
        } else {
            // Otherwise it's just content
            currentBlock.contentLines.push(lineNum);
        }
    }
    
    /**
     * Validates a directive block and returns diagnostics for any issues
     * @param block The directive block to validate
     * @returns Array of diagnostics for issues with this block
     */
    private validateDirectiveBlock(block: DirectiveBlock): vscode.Diagnostic[] {
        const diagnostics: vscode.Diagnostic[] = [];
        
        // 1. Check for missing closing directive
        if (!block.closing) {
            diagnostics.push(new vscode.Diagnostic(
                block.openingRange,
                `Missing closing directive. Expected ${':'.repeat(block.openingColons)}`,
                vscode.DiagnosticSeverity.Error
            ));
            return diagnostics; // Don't continue validation if no closing
        }
        
        // 2. Check for mismatched colon counts
        if (block.openingColons !== block.closingColons) {
            diagnostics.push(new vscode.Diagnostic(
                block.closingRange!,
                `Mismatched colon count. Opening has ${block.openingColons} colons, closing has ${block.closingColons}`,
                vscode.DiagnosticSeverity.Error
            ));
        }
        
        // 3. Check if directive name is valid
        const directive = DIRECTIVES.find(d => d.name === block.name);
        if (!directive) {
            diagnostics.push(new vscode.Diagnostic(
                block.nameRange,
                `Unknown directive '${block.name}'`,
                vscode.DiagnosticSeverity.Warning
            ));
        }
        
        // 4. Check required arguments
        if (directive?.hasArgument && !block.argument) {
            diagnostics.push(new vscode.Diagnostic(
                block.openingRange,
                `Directive '${block.name}' requires an argument`,
                vscode.DiagnosticSeverity.Error
            ));
        }
        
        // 5. Validate parameters
        for (const param of block.parameters) {
            if (directive && !directive.parameters.includes(param.name)) {
                diagnostics.push(new vscode.Diagnostic(
                    param.range,
                    `Unknown parameter '${param.name}' for directive '${block.name}'`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        }
        
        // 6. Check for malformed opening (missing braces)
        if (block.isMalformed) {
            if (block.missingClosingBrace) {
                diagnostics.push(new vscode.Diagnostic(
                    block.openingRange,
                    'Malformed directive opening. Missing closing brace }',
                    vscode.DiagnosticSeverity.Error
                ));
            } else {
                diagnostics.push(new vscode.Diagnostic(
                    block.openingRange,
                    'Malformed directive opening. Expected ::::{name} format with braces',
                    vscode.DiagnosticSeverity.Error
                ));
            }
        }
        
        return diagnostics;
    }
}