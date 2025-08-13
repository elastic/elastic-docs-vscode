import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { outputChannel } from './extension';

interface SubstitutionVariables {
    [key: string]: string;
}

interface ParsedYaml {
    [key: string]: unknown;
}

export class SubstitutionCompletionProvider implements vscode.CompletionItemProvider {
    private cachedSubstitutions: Map<string, SubstitutionVariables> = new Map();
    private lastCacheUpdate: number = 0;
    private readonly CACHE_DURATION = 30000; // 30 seconds

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

            const partialVariable = substitutionMatch[1];
            const substitutions = this.getSubstitutionsFromWorkspace(document.uri);
            
            return this.createCompletionItems(substitutions, partialVariable);
        } catch (error) {
            outputChannel.appendLine(`Error in substitution completion: ${error}`);
            return [];
        }
    }

    private getSubstitutionsFromWorkspace(documentUri: vscode.Uri): SubstitutionVariables {
        const now = Date.now();
        
        // Return cached results if still valid
        if (now - this.lastCacheUpdate < this.CACHE_DURATION) {
            const cached = this.cachedSubstitutions.get(documentUri.fsPath);
            if (cached) {
                return cached;
            }
        }

        const substitutions: SubstitutionVariables = {};
        
        try {
            // Find all docset.yml files in the workspace
            const docsetFiles = this.findDocsetFiles(documentUri);
            
            for (const docsetFile of docsetFiles) {
                const fileSubstitutions = this.parseDocsetFile(docsetFile);
                Object.assign(substitutions, fileSubstitutions);
            }
            
            // Cache the results
            this.cachedSubstitutions.set(documentUri.fsPath, substitutions);
            this.lastCacheUpdate = now;
            
        } catch (error) {
            outputChannel.appendLine(`Error reading docset files: ${error}`);
        }
        
        return substitutions;
    }

    private findDocsetFiles(documentUri: vscode.Uri): string[] {
        const docsetFiles: string[] = [];
        const documentPath = documentUri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
        
        if (!workspaceFolder) {
            return docsetFiles;
        }
        
        const workspaceRoot = workspaceFolder.uri.fsPath;
        
        // Define possible docset file names
        const docsetFileNames = ['docset.yml', '_docset.yml'];
        
        // Check workspace root
        for (const fileName of docsetFileNames) {
            const rootDocsetPath = path.join(workspaceRoot, fileName);
            if (fs.existsSync(rootDocsetPath)) {
                docsetFiles.push(rootDocsetPath);
            }
        }
        
        // Check /docs folder in workspace root
        const docsFolderPath = path.join(workspaceRoot, 'docs');
        if (fs.existsSync(docsFolderPath) && fs.statSync(docsFolderPath).isDirectory()) {
            for (const fileName of docsetFileNames) {
                const docsDocsetPath = path.join(docsFolderPath, fileName);
                if (fs.existsSync(docsDocsetPath)) {
                    docsetFiles.push(docsDocsetPath);
                }
            }
        }
        
        // Also search upwards from the document location for backward compatibility
        let currentDir = path.dirname(documentPath);
        while (currentDir && currentDir.startsWith(workspaceRoot)) {
            for (const fileName of docsetFileNames) {
                const docsetPath = path.join(currentDir, fileName);
                if (fs.existsSync(docsetPath)) {
                    docsetFiles.push(docsetPath);
                }
            }
            
            const parentDir = path.dirname(currentDir);
            if (parentDir === currentDir) {
                break; // Reached root
            }
            currentDir = parentDir;
        }
        
        // Remove duplicates while preserving order
        return [...new Set(docsetFiles)];
    }

    private parseDocsetFile(filePath: string): SubstitutionVariables {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const parsed = this.parseYaml(content);
            
            if (parsed && typeof parsed === 'object' && 'subs' in parsed) {
                const subs = parsed.subs;
                // Handle both flat key-value pairs and nested objects
                if (typeof subs === 'object') {
                    // Flatten nested objects if they exist
                    const flattened: SubstitutionVariables = {};
                    this.flattenObject(subs, '', flattened);
                    return flattened;
                }
                return subs as unknown as SubstitutionVariables;
            }
            
            return {};
        } catch (error) {
            outputChannel.appendLine(`Error parsing docset file ${filePath}: ${error}`);
            return {};
        }
    }

    private parseYaml(content: string): SubstitutionVariables {
        // Simple YAML parser for the specific structure we need
        const lines = content.split('\n');
        const result: ParsedYaml = {};
        let currentSection: ParsedYaml | null = null;
        let currentIndent = 0;
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            const indent = line.length - line.trimStart().length;
            
            if (trimmed === 'subs:') {
                result.subs = {};
                currentSection = result.subs as ParsedYaml;
                currentIndent = indent;
                continue;
            }
            
            if (currentSection && indent > currentIndent) {
                // This is a key-value pair in the subs section
                const colonIndex = trimmed.indexOf(':');
                if (colonIndex > 0) {
                    const key = trimmed.substring(0, colonIndex).trim();
                    const value = trimmed.substring(colonIndex + 1).trim();
                    
                    // Remove quotes if present
                    const cleanValue = value.replace(/^["']|["']$/g, '');
                    currentSection[key] = cleanValue;
                }
            }
        }
        
        // Flatten the result to create proper substitution variables
        const flattened: SubstitutionVariables = {};
        this.flattenObject(result, '', flattened);
        return flattened;
    }

    private flattenObject(obj: Record<string, unknown>, prefix: string, result: SubstitutionVariables): void {
        for (const [key, value] of Object.entries(obj)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                this.flattenObject(value as Record<string, unknown>, newKey, result);
            } else {
                result[newKey] = String(value);
            }
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

    // Method to clear cache when workspace changes
    public clearCache(): void {
        this.cachedSubstitutions.clear();
        this.lastCacheUpdate = 0;
    }
} 