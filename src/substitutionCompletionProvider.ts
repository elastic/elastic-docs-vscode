import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { outputChannel } from './logger';

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
        outputChannel.appendLine('[DEBUG] Substitution completion provider triggered');
        try {
            const lineText = document.lineAt(position).text;
            const textBefore = lineText.substring(0, position.character);
            
            outputChannel.appendLine(`[DEBUG] Line text: "${lineText}"`);
            outputChannel.appendLine(`[DEBUG] Text before cursor: "${textBefore}"`);
            
            // Check if we're typing {{ for substitution
            const substitutionMatch = textBefore.match(/\{\{([^}]*)$/);
            if (!substitutionMatch) {
                outputChannel.appendLine('[DEBUG] No {{ pattern found');
                return [];
            }

            outputChannel.appendLine(`[DEBUG] Found {{ pattern, partial: "${substitutionMatch[1]}"`);
            const partialVariable = substitutionMatch[1];
            const substitutions = this.getSubstitutionsFromWorkspace(document.uri);
            outputChannel.appendLine(`[DEBUG] Retrieved ${Object.keys(substitutions).length} substitutions`);
            
            return this.createCompletionItems(substitutions, partialVariable);
        } catch (error) {
            outputChannel.appendLine(`Error in substitution completion: ${error}`);
            return [];
        }
    }

    private getSubstitutionsFromWorkspace(documentUri: vscode.Uri): SubstitutionVariables {
        outputChannel.appendLine(`[DEBUG] Getting substitutions for document: ${documentUri.toString()}`);
        
        const now = Date.now();
        
        // Return cached results if still valid
        if (now - this.lastCacheUpdate < this.CACHE_DURATION) {
            const cached = this.cachedSubstitutions.get(documentUri.fsPath);
            if (cached) {
                outputChannel.appendLine(`[DEBUG] Using cached substitutions: ${Object.keys(cached).length} items`);
                return cached;
            }
        }

        outputChannel.appendLine('[DEBUG] Cache miss, searching for docset.yml files');
        const substitutions: SubstitutionVariables = {};
        
        try {
            // Find all docset.yml files in the workspace
            const docsetFiles = this.findDocsetFiles(documentUri);
            outputChannel.appendLine(`[DEBUG] Found ${docsetFiles.length} docset.yml files`);
            
            for (const docsetFile of docsetFiles) {
                outputChannel.appendLine(`[DEBUG] Parsing docset file: ${docsetFile}`);
                const fileSubstitutions = this.parseDocsetFile(docsetFile);
                outputChannel.appendLine(`[DEBUG] File ${docsetFile} contained ${Object.keys(fileSubstitutions).length} substitutions`);
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
        
        outputChannel.appendLine(`[DEBUG] Finding docset files for document: ${documentPath}`);
        
        if (!workspaceFolder) {
            outputChannel.appendLine('[DEBUG] No workspace folder found');
            return docsetFiles;
        }
        
        const workspaceRoot = workspaceFolder.uri.fsPath;
        outputChannel.appendLine(`[DEBUG] Workspace root: ${workspaceRoot}`);
        
        // Define possible docset file names
        const docsetFileNames = ['docset.yml', '_docset.yml'];
        
        // Check workspace root
        for (const fileName of docsetFileNames) {
            const rootDocsetPath = path.join(workspaceRoot, fileName);
            outputChannel.appendLine(`[DEBUG] Checking for: ${rootDocsetPath}`);
            if (fs.existsSync(rootDocsetPath)) {
                outputChannel.appendLine(`[DEBUG] Found docset file: ${rootDocsetPath}`);
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
            outputChannel.appendLine(`[DEBUG] File content length: ${content.length} characters`);
            outputChannel.appendLine(`[DEBUG] First 200 chars: ${content.substring(0, 200)}`);
            
            const parsed = this.parseYaml(content);
            outputChannel.appendLine(`[DEBUG] Parsed YAML has subs property: ${'subs' in parsed}`);
            
            if (parsed && typeof parsed === 'object' && 'subs' in parsed) {
                const subs = parsed.subs;
                outputChannel.appendLine(`[DEBUG] Found subs section, type: ${typeof subs}, keys: ${Object.keys(subs || {}).length}`);
                
                // The subs section is already properly parsed as key-value pairs
                if (typeof subs === 'object' && subs !== null) {
                    const result = subs as SubstitutionVariables;
                    outputChannel.appendLine(`[DEBUG] Returning ${Object.keys(result).length} substitutions`);
                    outputChannel.appendLine(`[DEBUG] First few keys: ${Object.keys(result).slice(0, 5).join(', ')}`);
                    return result;
                }
                return subs as unknown as SubstitutionVariables;
            } else {
                outputChannel.appendLine(`[DEBUG] No subs section found in parsed YAML`);
            }
            
            return {};
        } catch (error) {
            outputChannel.appendLine(`Error parsing docset file ${filePath}: ${error}`);
            return {};
        }
    }

    private parseYaml(content: string): ParsedYaml {
        // Simple YAML parser for the specific structure we need
        const lines = content.split('\n');
        const result: ParsedYaml = {};
        let currentSection: ParsedYaml | null = null;
        let currentIndent = 0;
        let parsedCount = 0;
        
        outputChannel.appendLine(`[DEBUG] Parsing YAML with ${lines.length} lines`);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            
            const indent = line.length - line.trimStart().length;
            
            if (trimmed === 'subs:') {
                outputChannel.appendLine(`[DEBUG] Found 'subs:' section at line ${i + 1}`);
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
                    parsedCount++;
                    
                    if (parsedCount <= 5) {
                        outputChannel.appendLine(`[DEBUG] Parsed: ${key} = ${cleanValue}`);
                    }
                }
            }
        }
        
        outputChannel.appendLine(`[DEBUG] YAML parsing complete, parsed ${parsedCount} key-value pairs`);
        return result;
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