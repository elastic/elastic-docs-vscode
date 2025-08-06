import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface SubstitutionVariables {
    [key: string]: string;
}

export class SubstitutionHoverProvider implements vscode.HoverProvider {
    private cachedSubstitutions: Map<string, SubstitutionVariables> = new Map();
    private lastCacheUpdate: number = 0;
    private readonly CACHE_DURATION = 30000; // 30 seconds

    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.Hover> {
        try {
            const lineText = document.lineAt(position).text;
            const wordRange = document.getWordRangeAtPosition(position);
            
            if (!wordRange) {
                return null;
            }

            const word = document.getText(wordRange);
            
            // Check if we're hovering over a substitution variable (inside {{}})
            const textBefore = lineText.substring(0, wordRange.start.character);
            const textAfter = lineText.substring(wordRange.end.character);
            
            // Look for {{ before the word and }} after the word
            const beforeMatch = textBefore.match(/\{\{([^}]*)$/);
            const afterMatch = textAfter.match(/^([^}]*)\}\}/);
            
            if (beforeMatch && afterMatch) {
                // We're inside a substitution variable
                const substitutions = this.getSubstitutionsFromWorkspace(document.uri);
                const variableName = word;
                
                if (substitutions[variableName]) {
                    const value = substitutions[variableName];
                    const markdown = new vscode.MarkdownString();
                    
                    markdown.appendMarkdown(`**Substitution Variable:** \`${variableName}\`\n\n`);
                    markdown.appendMarkdown(`**Value:** ${value}\n\n`);
                    markdown.appendMarkdown(`**Usage:** \`{{${variableName}}}\``);
                    
                    return new vscode.Hover(markdown, wordRange);
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error in substitution hover:', error);
            return null;
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
            console.error('Error reading docset files:', error);
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
                return subs as SubstitutionVariables;
            }
            
            return {};
        } catch (error) {
            console.error(`Error parsing docset file ${filePath}:`, error);
            return {};
        }
    }

    private parseYaml(content: string): any {
        // Simple YAML parser for the specific structure we need
        const lines = content.split('\n');
        const result: any = {};
        let currentSection: any = null;
        let currentIndent = 0;
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            const indent = line.length - line.trimStart().length;
            
            if (trimmed === 'subs:') {
                result.subs = {};
                currentSection = result.subs;
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
        
        return result;
    }

    private flattenObject(obj: any, prefix: string, result: SubstitutionVariables): void {
        for (const [key, value] of Object.entries(obj)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                this.flattenObject(value, newKey, result);
            } else {
                result[newKey] = String(value);
            }
        }
    }

    // Method to clear cache when workspace changes
    public clearCache(): void {
        this.cachedSubstitutions.clear();
        this.lastCacheUpdate = 0;
    }
} 