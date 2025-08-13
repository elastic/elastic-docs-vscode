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

interface ValidationError {
    range: vscode.Range;
    message: string;
    severity: vscode.DiagnosticSeverity;
    code?: string;
}

export class FrontmatterValidationProvider {
    private schema: FrontmatterSchema;
    private readonly FRONTMATTER_START = /^---\s*$/;
    private readonly FRONTMATTER_END = /^---\s*$/;
    
    // Lifecycle states for validation
    private readonly LIFECYCLE_STATES = [
        'all', 'ga', 'preview', 'beta', 'deprecated', 'removed', 
        'unavailable', 'planned', 'development', 'discontinued'
    ];
    
    // Version pattern for lifecycle states
    private readonly VERSION_PATTERN = /^(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)(\s+[0-9]+(\.[0-9]+)*)?$/;
    private readonly COMMA_SEPARATED_PATTERN = /^(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)(\s+[0-9]+(\.[0-9]+)*)?,\s*(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)(\s+[0-9]+(\.[0-9]+)*)?$/;

    constructor() {
        this.schema = frontmatterSchema as any;
    }

    public validateDocument(document: vscode.TextDocument): vscode.Diagnostic[] {

        const frontmatterRange = this.getFrontmatterRange(document);
        if (!frontmatterRange) {
            return [];
        }

        const errors: ValidationError[] = [];
        
        try {
            const frontmatterText = document.getText(frontmatterRange);
            const lines = frontmatterText.split('\n').slice(1, -1); // Remove --- markers
            
            // Parse YAML and validate structure
            const yamlData = this.parseYamlForValidation(lines, frontmatterRange.start.line + 1);
            
            // Validate against schema
            this.validateFrontmatterData(yamlData, errors, document, frontmatterRange.start.line + 1);
            
        } catch (error) {
            // YAML parsing error
            errors.push({
                range: frontmatterRange,
                message: `Invalid YAML syntax: ${error}`,
                severity: vscode.DiagnosticSeverity.Error,
                code: 'yaml_syntax_error'
            });
        }

        // Convert validation errors to diagnostics
        return errors.map(error => {
            const diagnostic = new vscode.Diagnostic(error.range, error.message, error.severity);
            if (error.code) {
                diagnostic.code = error.code;
            }
            diagnostic.source = 'Elastic Docs Frontmatter';
            return diagnostic;
        });
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

    private parseYamlForValidation(lines: string[], _startLine: number): any {
        const result: any = {};
        const stack: Array<{ obj: any; indent: number }> = [{ obj: result, indent: -1 }];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (!line.trim()) continue;
            
            const indent = line.length - line.trimStart().length;
            const trimmed = line.trim();
            
            // Pop stack until we find the right parent
            while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
                stack.pop();
            }
            
            const parent = stack[stack.length - 1].obj;
            
            if (trimmed.startsWith('- ')) {
                // Array item
                const itemContent = trimmed.substring(2).trim();
                if (!Array.isArray(parent)) {
                    // Convert to array if needed
                    const keys = Object.keys(parent);
                    if (keys.length > 0) {
                        const lastKey = keys[keys.length - 1];
                        parent[lastKey] = [];
                    }
                }
                
                if (itemContent.includes(':')) {
                    // Object in array
                    const obj = {};
                    const lastKey = this.getLastArrayKey(parent);
                    if (lastKey && Array.isArray(parent[lastKey])) {
                        parent[lastKey].push(obj);
                        stack.push({ obj, indent });
                    }
                } else {
                    // Simple value in array
                    const lastKey = this.getLastArrayKey(parent);
                    if (lastKey && Array.isArray(parent[lastKey])) {
                        parent[lastKey].push(itemContent);
                    }
                }
            } else if (trimmed.includes(':')) {
                // Key-value pair
                const colonIndex = trimmed.indexOf(':');
                const key = trimmed.substring(0, colonIndex).trim();
                const value = trimmed.substring(colonIndex + 1).trim();
                
                if (value === '') {
                    // Object or array
                    parent[key] = {};
                    stack.push({ obj: parent[key], indent });
                } else {
                    // Simple value
                    parent[key] = this.parseValue(value);
                }
            }
        }
        
        return result;
    }

    private getLastArrayKey(obj: any): string | null {
        const keys = Object.keys(obj);
        for (let i = keys.length - 1; i >= 0; i--) {
            if (Array.isArray(obj[keys[i]])) {
                return keys[i];
            }
        }
        return null;
    }

    private parseValue(value: string): any {
        // Remove quotes
        const unquoted = value.replace(/^["']|["']$/g, '');
        
        // Try to parse as number
        const num = Number(unquoted);
        if (!isNaN(num)) {
            return num;
        }
        
        // Return as string
        return unquoted;
    }

    private validateFrontmatterData(data: any, errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {

        // Check for required fields
        this.validateRequiredFields(data, errors, document, startLine);
        
        // Validate each field
        for (const [fieldName, fieldValue] of Object.entries(data)) {
            this.validateField(fieldName, fieldValue, [], errors, document, startLine);
        }

        // Validate applies_to specifically
        if (data.applies_to) {
            this.validateAppliesTo(data.applies_to, errors, document, startLine);
        }

        // Validate products array
        if (data.products) {
            this.validateProducts(data.products, errors, document, startLine);
        }
    }

    private validateRequiredFields(data: any, errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {
        // applies_to is mandatory according to schema
        if (!data.applies_to) {
            const range = new vscode.Range(startLine, 0, startLine, 0);
            errors.push({
                range,
                message: 'Missing required field: applies_to',
                severity: vscode.DiagnosticSeverity.Error,
                code: 'missing_required_field'
            });
        }
    }

    private validateField(fieldName: string, fieldValue: any, path: string[], errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {

        const fieldSchema = this.getFieldSchema(fieldName, path);
        if (!fieldSchema) {
            // Unknown field warning
            const fieldRange = this.findFieldRange(fieldName, document, startLine);
            if (fieldRange) {
                errors.push({
                    range: fieldRange,
                    message: `Unknown field: ${fieldName}`,
                    severity: vscode.DiagnosticSeverity.Warning,
                    code: 'unknown_field'
                });
            }
            return;
        }

        // Validate based on field type
        if (fieldSchema.type === 'string') {
            if (typeof fieldValue !== 'string') {
                const valueRange = this.findValueRange(fieldName, document, startLine);
                if (valueRange) {
                    errors.push({
                        range: valueRange,
                        message: `Expected string value for field: ${fieldName}`,
                        severity: vscode.DiagnosticSeverity.Error,
                        code: 'type_error'
                    });
                }
            }
        } else if (fieldSchema.type === 'array') {
            if (!Array.isArray(fieldValue)) {
                const valueRange = this.findValueRange(fieldName, document, startLine);
                if (valueRange) {
                    errors.push({
                        range: valueRange,
                        message: `Expected array value for field: ${fieldName}`,
                        severity: vscode.DiagnosticSeverity.Error,
                        code: 'type_error'
                    });
                }
            }
        }

        // Validate enum values
        if (fieldSchema.enum && Array.isArray(fieldSchema.enum)) {
            if (!fieldSchema.enum.includes(fieldValue)) {
                const valueRange = this.findValueRange(fieldName, document, startLine);
                if (valueRange) {
                    errors.push({
                        range: valueRange,
                        message: `Invalid value '${fieldValue}' for field '${fieldName}'. Expected one of: ${fieldSchema.enum.join(', ')}`,
                        severity: vscode.DiagnosticSeverity.Error,
                        code: 'invalid_enum_value'
                    });
                }
            }
        }

        // Validate string length
        if (fieldSchema.maxLength && typeof fieldValue === 'string' && fieldValue.length > fieldSchema.maxLength) {
            const valueRange = this.findValueRange(fieldName, document, startLine);
            if (valueRange) {
                errors.push({
                    range: valueRange,
                    message: `Field '${fieldName}' exceeds maximum length of ${fieldSchema.maxLength} characters`,
                    severity: vscode.DiagnosticSeverity.Warning,
                    code: 'max_length_exceeded'
                });
            }
        }
    }

    private validateAppliesTo(appliesTo: any, errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {

        const knownKeys = this.schema.metadata.knownKeys.keys;

        for (const [key, value] of Object.entries(appliesTo)) {
            // Validate known keys
            if (!knownKeys.includes(key)) {
                const keyRange = this.findFieldRange(key, document, startLine);
                if (keyRange) {
                    errors.push({
                        range: keyRange,
                        message: `Unknown applies_to key: ${key}. Valid keys: ${knownKeys.join(', ')}`,
                        severity: vscode.DiagnosticSeverity.Warning,
                        code: 'unknown_applies_key'
                    });
                }
            }

            // Validate lifecycle values
            if (typeof value === 'string') {
                this.validateLifecycleValue(key, value, errors, document, startLine);
            } else if (typeof value === 'object' && value !== null) {
                // Nested object (like deployment/serverless)
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    // Validate nested keys based on parent context
                    this.validateNestedAppliesKey(key, nestedKey, errors, document, startLine);
                    
                    if (typeof nestedValue === 'string') {
                        this.validateLifecycleValue(`${key}.${nestedKey}`, nestedValue, errors, document, startLine);
                    }
                }
            }
        }
    }

    private validateNestedAppliesKey(parentKey: string, nestedKey: string, errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {
        let validNestedKeys: string[] = [];
        
        switch (parentKey) {
            case 'deployment':
                // Get keys from deploymentApplicability definition in schema
                const deploymentDef = this.schema.definitions.deploymentApplicability;
                if (deploymentDef && deploymentDef.properties) {
                    validNestedKeys = Object.keys(deploymentDef.properties);
                }
                break;
            case 'serverless':
                // Get keys from serverlessProjectApplicability definition in schema
                const serverlessDef = this.schema.definitions.serverlessProjectApplicability;
                if (serverlessDef && serverlessDef.properties) {
                    validNestedKeys = Object.keys(serverlessDef.properties);
                }
                break;
            case 'product':
                // For product objects, validate against individual product keys from schema
                validNestedKeys = this.schema.metadata.knownKeys.keys.filter(key => 
                    !['stack', 'deployment', 'serverless', 'product'].includes(key)
                );
                break;
            default:
                return; // Don't validate other nested contexts
        }
        
        if (!validNestedKeys.includes(nestedKey)) {
            const keyRange = this.findFieldRange(nestedKey, document, startLine);
            if (keyRange) {
                errors.push({
                    range: keyRange,
                    message: `Unknown ${parentKey} key: ${nestedKey}. Valid keys: ${validNestedKeys.join(', ')}`,
                    severity: vscode.DiagnosticSeverity.Warning,
                    code: 'unknown_nested_key'
                });
            }
        }
    }

    private validateLifecycleValue(fieldPath: string, value: string, errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {
        // Check if it's a simple lifecycle state
        if (this.LIFECYCLE_STATES.includes(value)) {
            return;
        }

        // Check if it matches lifecycle + version pattern
        if (this.VERSION_PATTERN.test(value) || this.COMMA_SEPARATED_PATTERN.test(value)) {
            return;
        }

        // Invalid lifecycle value
        const valueRange = this.findValueRange(fieldPath.split('.').pop()!, document, startLine);
        if (valueRange) {
            errors.push({
                range: valueRange,
                message: `Invalid lifecycle value '${value}'. Expected format: 'state' or 'state version' (e.g., 'ga', 'beta 9.1', 'deprecated 8.0')`,
                severity: vscode.DiagnosticSeverity.Error,
                code: 'invalid_lifecycle_value'
            });
        }
    }

    private validateProducts(products: any[], errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {
        const validProductIds = [
            "apm", "apm-agent", "auditbeat", "beats", "cloud-control-ecctl", "cloud-enterprise", 
            "cloud-hosted", "cloud-kubernetes", "cloud-serverless", "cloud-terraform", "ecs", 
            "ecs-logging", "edot-cf", "edot-sdk", "edot-collector", "elastic-agent", 
            "elastic-serverless-forwarder", "elastic-stack", "elasticsearch", "elasticsearch-client", 
            "filebeat", "fleet", "heartbeat", "integrations", "kibana", "logstash", 
            "machine-learning", "metricbeat", "observability", "packetbeat", "painless", 
            "search-ui", "security", "winlogbeat"
        ];

        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            
            if (typeof product !== 'object' || !product.id) {
                const productRange = this.findArrayItemRange('products', i, document, startLine);
                if (productRange) {
                    errors.push({
                        range: productRange,
                        message: 'Product item must be an object with an "id" field',
                        severity: vscode.DiagnosticSeverity.Error,
                        code: 'invalid_product_format'
                    });
                }
                continue;
            }

            if (!validProductIds.includes(product.id)) {
                const idRange = this.findValueRange('id', document, startLine);
                if (idRange) {
                    errors.push({
                        range: idRange,
                        message: `Invalid product ID '${product.id}'. Valid IDs: ${validProductIds.join(', ')}`,
                        severity: vscode.DiagnosticSeverity.Error,
                        code: 'invalid_product_id'
                    });
                }
            }
        }
    }

    private getFieldSchema(fieldName: string, path: string[]): any {
        
        let currentSchema = this.schema.properties;
        
        for (const segment of path) {
            if (currentSchema[segment] && currentSchema[segment].properties) {
                currentSchema = currentSchema[segment].properties;
            }
        }
        
        return currentSchema[fieldName];
    }

    private findFieldRange(fieldName: string, document: vscode.TextDocument, startLine: number): vscode.Range | null {
        // Find the field name in the document
        for (let i = startLine; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const fieldMatch = line.text.match(new RegExp(`^(\\s*)(${fieldName})\\s*:`));
            if (fieldMatch) {
                const startChar = fieldMatch[1].length;
                const endChar = startChar + fieldMatch[2].length;
                return new vscode.Range(i, startChar, i, endChar);
            }
        }
        return null;
    }

    private findValueRange(fieldName: string, document: vscode.TextDocument, startLine: number): vscode.Range | null {
        // Find the value for a field in the document
        for (let i = startLine; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            
            // Handle regular field: value pattern
            let valueMatch = line.text.match(new RegExp(`^\\s*${fieldName}\\s*:\\s*(.+)$`));
            if (valueMatch) {
                const valueStart = line.text.indexOf(valueMatch[1]);
                const valueEnd = valueStart + valueMatch[1].length;
                return new vscode.Range(i, valueStart, i, valueEnd);
            }
            
            // Handle array item pattern: - field: value
            valueMatch = line.text.match(new RegExp(`^\\s*-\\s+${fieldName}\\s*:\\s*(.+)$`));
            if (valueMatch) {
                const valueStart = line.text.indexOf(valueMatch[1]);
                const valueEnd = valueStart + valueMatch[1].length;
                return new vscode.Range(i, valueStart, i, valueEnd);
            }
        }
        return null;
    }

    private findArrayItemRange(_arrayName: string, _itemIndex: number, _document: vscode.TextDocument, _startLine: number): vscode.Range | null {
        // This is a simplified implementation
        // In practice, you'd need more sophisticated YAML parsing to find exact array item positions
        return null;
    }
}