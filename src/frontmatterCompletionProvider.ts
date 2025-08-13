import * as vscode from 'vscode';
import { frontmatterSchema } from './frontmatterSchema';

interface FrontmatterSchema {
    properties: { [key: string]: any };
    definitions: { [key: string]: any };
    metadata: {
        lifecycleStates: {
            values: Array<{ key: string; description: string }>;
        };
        knownKeys: {
            keys: string[];
        };
    };
}

interface FrontmatterContext {
    type: 'field_name' | 'field_value' | 'list_item' | 'object_key' | 'object_value';
    path: string[];
    currentField?: string;
    parentType?: string;
    yamlStructure?: any;
}

export class FrontmatterCompletionProvider implements vscode.CompletionItemProvider {
    private schema: FrontmatterSchema;
    private readonly FRONTMATTER_START = /^---\s*$/;
    private readonly FRONTMATTER_END = /^---\s*$/;

    constructor() {
        this.schema = frontmatterSchema as any;
    }

    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {

        // Check if we're in frontmatter
        const frontmatterRange = this.getFrontmatterRange(document);
        if (!frontmatterRange || !frontmatterRange.contains(position)) {
            return [];
        }

        // Analyze the current context
        const context = this.analyzeContext(document, position, frontmatterRange);
        if (!context) {
            return [];
        }

        // Provide completions based on context
        return this.getCompletionsForContext(context);
    }

    private getFrontmatterRange(document: vscode.TextDocument): vscode.Range | null {
        if (document.lineCount < 2) return null;

        // Check if document starts with frontmatter
        if (!this.FRONTMATTER_START.test(document.lineAt(0).text)) {
            return null;
        }

        // Find the end of frontmatter
        for (let i = 1; i < document.lineCount; i++) {
            if (this.FRONTMATTER_END.test(document.lineAt(i).text)) {
                return new vscode.Range(0, 0, i, 0);
            }
        }

        return null;
    }

    private analyzeContext(document: vscode.TextDocument, position: vscode.Position, frontmatterRange: vscode.Range): FrontmatterContext | null {
        const frontmatterText = document.getText(frontmatterRange);
        const lines = frontmatterText.split('\n').slice(1, -1); // Remove --- markers
        
        const currentLine = document.lineAt(position).text;
        const textBefore = currentLine.substring(0, position.character);
        const textAfter = currentLine.substring(position.character);
        
        // Parse YAML structure up to current position
        const yamlStructure = this.parsePartialYaml(lines, position.line - 1);
        const path = this.getCurrentPath(lines, position.line - 1, position.character);

        // Determine completion type
        if (this.isFieldName(textBefore, textAfter)) {
            return {
                type: 'field_name',
                path,
                yamlStructure
            };
        } else if (this.isFieldValue(textBefore)) {
            const fieldName = this.extractFieldName(textBefore);
            return {
                type: 'field_value',
                path,
                currentField: fieldName,
                yamlStructure
            };
        } else if (this.isListItem(textBefore)) {
            return {
                type: 'list_item',
                path,
                yamlStructure
            };
        } else if (this.isObjectKey(textBefore, path)) {
            return {
                type: 'object_key',
                path,
                yamlStructure
            };
        } else if (this.isObjectValue(textBefore, path)) {
            const fieldName = path[path.length - 1];
            return {
                type: 'object_value',
                path,
                currentField: fieldName,
                yamlStructure
            };
        }

        return null;
    }

    private isFieldName(textBefore: string, textAfter: string): boolean {
        // Field name if we're at start of line or after proper indentation and not after ':'
        // Also includes empty lines where we should suggest field names
        return (/^(\s*)([a-zA-Z_][a-zA-Z0-9_]*)?$/.test(textBefore) || /^\s*$/.test(textBefore)) && !textAfter.includes(':');
    }

    private isFieldValue(textBefore: string): boolean {
        // Field value if we're after ':' and optional whitespace
        return /:\s*([^"'\n]*)?$/.test(textBefore);
    }

    private isListItem(textBefore: string): boolean {
        // List item if we're after '- ' 
        return /^\s*-\s*([^:\n]*)?$/.test(textBefore);
    }

    private isObjectKey(textBefore: string, _path: string[]): boolean {
        // Object key if we're inside an object context
        const indent = textBefore.match(/^\s*/)?.[0].length || 0;
        return indent > 0 && /^\s*([a-zA-Z_][a-zA-Z0-9_]*)?$/.test(textBefore);
    }

    private isObjectValue(textBefore: string, _path: string[]): boolean {
        // Object value if we're after ':' inside an object
        return this.isFieldValue(textBefore);
    }

    private extractFieldName(textBefore: string): string {
        const match = textBefore.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*[^:\n]*$/);
        return match ? match[1] : '';
    }

    private getCurrentPath(lines: string[], currentLine: number, _currentChar: number): string[] {
        const path: string[] = [];
        let currentIndent = 0;

        // Walk backwards through lines to build context path
        for (let i = currentLine; i >= 0; i--) {
            const line = lines[i];
            if (!line || line.trim() === '') continue;

            const indent = line.length - line.trimStart().length;
            
            if (i === currentLine) {
                currentIndent = indent;
            } else if (indent < currentIndent) {
                // Found parent level
                const fieldMatch = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
                if (fieldMatch) {
                    path.unshift(fieldMatch[1]);
                    currentIndent = indent;
                }
            }
        }

        return path;
    }

    private parsePartialYaml(_lines: string[], _upToLine: number): any {
        // Simple YAML parser for structure analysis
        const result: any = {};
        // This would need a more sophisticated implementation
        // For now, returning empty object
        return result;
    }

    private getCompletionsForContext(context: FrontmatterContext): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];

        switch (context.type) {
            case 'field_name':
                return this.getFieldNameCompletions(context.path);
            case 'field_value':
                return this.getFieldValueCompletions(context.currentField!, context.path);
            case 'list_item':
                return this.getListItemCompletions(context.path);
            case 'object_key':
                return this.getObjectKeyCompletions(context.path);
            case 'object_value':
                return this.getObjectValueCompletions(context.currentField!, context.path);
        }

        return items;
    }

    private getFieldNameCompletions(path: string[]): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        

        // Root level field names
        if (path.length === 0) {
            for (const [fieldName, fieldSchema] of Object.entries(this.schema.properties)) {
                const item = new vscode.CompletionItem(fieldName, vscode.CompletionItemKind.Field);
                item.detail = fieldSchema.description || `${fieldSchema.type} field`;
                item.documentation = new vscode.MarkdownString(fieldSchema.description);
                item.insertText = `${fieldName}: `;
                items.push(item);
            }
        } else {
            // Nested field completions based on path
            const parentSchema = this.getSchemaAtPath(path);
            if (parentSchema && parentSchema.properties) {
                for (const [fieldName, fieldSchema] of Object.entries(parentSchema.properties)) {
                    const schema = fieldSchema as { description?: string; type?: string };
                    const item = new vscode.CompletionItem(fieldName, vscode.CompletionItemKind.Field);
                    item.detail = schema.description || `${schema.type} field`;
                    item.documentation = new vscode.MarkdownString(schema.description);
                    item.insertText = `${fieldName}: `;
                    items.push(item);
                }
            }
        }

        return items;
    }

    private getFieldValueCompletions(fieldName: string, path: string[]): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        

        const fieldSchema = this.getFieldSchema(fieldName, path);
        if (!fieldSchema) return items;

        // Handle enum values
        if (fieldSchema.enum) {
            for (const value of fieldSchema.enum) {
                const item = new vscode.CompletionItem(value, vscode.CompletionItemKind.Value);
                item.insertText = `"${value}"`;
                items.push(item);
            }
        }

        // Handle special field types
        if (fieldName === 'layout') {
            const layouts = ['landing-page', 'not-found', 'archive'];
            for (const layout of layouts) {
                const item = new vscode.CompletionItem(layout, vscode.CompletionItemKind.Value);
                item.insertText = `"${layout}"`;
                items.push(item);
            }
        }

        // Handle applies_to values
        if (this.isAppliesField(fieldName, path)) {
            return this.getAppliesValueCompletions();
        }

        return items;
    }

    private getListItemCompletions(path: string[]): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        
        // Handle products array
        if (path.includes('products')) {
            const item = new vscode.CompletionItem('id', vscode.CompletionItemKind.Field);
            item.insertText = 'id: ';
            item.detail = 'Product identifier';
            items.push(item);
        }

        // Handle mapped_pages array
        if (path.includes('mapped_pages')) {
            const item = new vscode.CompletionItem('"/path/to/page"', vscode.CompletionItemKind.Value);
            item.insertText = '"/path/to/page"';
            item.detail = 'Page path for mapping';
            items.push(item);
        }

        return items;
    }

    private getObjectKeyCompletions(path: string[]): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        

        // Handle applies_to object keys
        if (path.includes('applies_to')) {
            const knownKeys = this.schema.metadata.knownKeys.keys;
            for (const key of knownKeys) {
                const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field);
                item.insertText = `${key}: `;
                item.detail = this.getAppliesKeyDescription(key);
                items.push(item);
            }
        }

        // Handle deployment/serverless object keys
        if (path.includes('deployment')) {
            const deploymentDef = this.schema.definitions.deploymentApplicability;
            if (deploymentDef && deploymentDef.properties) {
                for (const key of Object.keys(deploymentDef.properties)) {
                    const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field);
                    item.insertText = `${key}: `;
                    item.detail = this.getAppliesKeyDescription(key);
                    items.push(item);
                }
            }
        }

        if (path.includes('serverless')) {
            const serverlessDef = this.schema.definitions.serverlessProjectApplicability;
            if (serverlessDef && serverlessDef.properties) {
                for (const key of Object.keys(serverlessDef.properties)) {
                    const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field);
                    item.insertText = `${key}: `;
                    item.detail = this.getAppliesKeyDescription(key);
                    items.push(item);
                }
            }
        }

        return items;
    }

    private getObjectValueCompletions(fieldName: string, path: string[]): vscode.CompletionItem[] {
        // Handle product ID completions
        if (fieldName === 'id' && path.includes('products')) {
            return this.getProductIdCompletions();
        }

        // Handle applies_to value completions
        if (this.isAppliesField(fieldName, path)) {
            return this.getAppliesValueCompletions();
        }

        return [];
    }

    private getAppliesValueCompletions(): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        

        const lifecycleStates = this.schema.metadata.lifecycleStates.values;
        
        // Simple lifecycle states
        for (const state of lifecycleStates) {
            const item = new vscode.CompletionItem(state.key, vscode.CompletionItemKind.Value);
            item.insertText = `"${state.key}"`;
            item.detail = state.description;
            item.documentation = new vscode.MarkdownString(state.description);
            items.push(item);
        }

        // Common patterns with versions
        const commonPatterns = [
            'ga 9.0',
            'ga 10.0',
            'beta 9.1',
            'preview 1.0.0',
            'deprecated 8.0',
            'all'
        ];

        for (const pattern of commonPatterns) {
            const item = new vscode.CompletionItem(pattern, vscode.CompletionItemKind.Value);
            item.insertText = `"${pattern}"`;
            item.detail = 'Lifecycle state with version';
            items.push(item);
        }

        return items;
    }

    private getProductIdCompletions(): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        
        const productIds = [
            "apm", "apm-agent", "auditbeat", "beats", "cloud-control-ecctl", "cloud-enterprise", 
            "cloud-hosted", "cloud-kubernetes", "cloud-serverless", "cloud-terraform", "ecs", 
            "ecs-logging", "edot-cf", "edot-sdk", "edot-collector", "elastic-agent", 
            "elastic-serverless-forwarder", "elastic-stack", "elasticsearch", "elasticsearch-client", 
            "filebeat", "fleet", "heartbeat", "integrations", "kibana", "logstash", 
            "machine-learning", "metricbeat", "observability", "packetbeat", "painless", 
            "search-ui", "security", "winlogbeat"
        ];

        for (const productId of productIds) {
            const item = new vscode.CompletionItem(productId, vscode.CompletionItemKind.Value);
            item.insertText = `"${productId}"`;
            item.detail = 'Product identifier';
            items.push(item);
        }

        return items;
    }

    private getFieldSchema(fieldName: string, path: string[]): any {
        
        // Navigate to the correct schema based on path
        let currentSchema = this.schema.properties;
        
        for (const segment of path) {
            if (currentSchema[segment] && currentSchema[segment].properties) {
                currentSchema = currentSchema[segment].properties;
            }
        }
        
        return currentSchema[fieldName];
    }

    private getSchemaAtPath(path: string[]): any {
        
        let currentSchema = this.schema;
        
        for (const segment of path) {
            if (currentSchema.properties && currentSchema.properties[segment]) {
                currentSchema = currentSchema.properties[segment];
            } else {
                return null;
            }
        }
        
        return currentSchema;
    }

    private isAppliesField(fieldName: string, path: string[]): boolean {
        return path.includes('applies_to') || 
               ['stack', 'deployment', 'serverless', 'product'].includes(fieldName) ||
               fieldName.startsWith('apm_agent_') ||
               fieldName.startsWith('edot_');
    }

    private getAppliesKeyDescription(key: string): string {
        const descriptions: { [key: string]: string } = {
            'stack': 'Elastic Stack applicability',
            'deployment': 'Deployment model applicability',
            'serverless': 'Serverless project applicability',
            'product': 'General product applicability',
            'self': 'Self-managed deployment',
            'ece': 'Elastic Cloud Enterprise',
            'eck': 'Elastic Cloud on Kubernetes',
            'ess': 'Elastic Cloud (ESS)',
            'elasticsearch': 'Elasticsearch Serverless',
            'observability': 'Observability Serverless',
            'security': 'Security Serverless'
        };
        
        return descriptions[key] || `${key} applicability`;
    }
}