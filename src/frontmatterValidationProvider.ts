import * as vscode from 'vscode';
import { outputChannel } from './logger';
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
    
    // Lifecycle states for validation (excluding 'all' which is only valid with a lifecycle state)
    private readonly LIFECYCLE_STATES = [
        'ga', 'preview', 'beta', 'deprecated', 'removed', 
        'unavailable', 'planned', 'development', 'discontinued'
    ];
    
    // Version pattern for lifecycle states
    private readonly VERSION_PATTERN = /^(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)(\s+[0-9]+(\.[0-9]+)*)?$/;
    private readonly COMMA_SEPARATED_PATTERN = /^(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)(\s+[0-9]+(\.[0-9]+)*)?,\s*(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)(\s+[0-9]+(\.[0-9]+)*)?$/;
    
    // Patterns for "all" validation - only allowed with lifecycle states
    private readonly LIFECYCLE_ALL_PATTERN = /^(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)\s+all$/;
    private readonly COMMA_SEPARATED_WITH_ALL_PATTERN = /^(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)(\s+[0-9]+(\.[0-9]+)*|\s+all)?,\s*(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)(\s+[0-9]+(\.[0-9]+)*|\s+all)?$/;

    constructor() {
        this.schema = frontmatterSchema as any;
    }

    public validateDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
        outputChannel.appendLine(`[FrontmatterValidation] Validating document: ${document.fileName}`);

        const frontmatterRange = this.getFrontmatterRange(document);
        if (!frontmatterRange) {
            outputChannel.appendLine(`[FrontmatterValidation] No frontmatter found`);
            return [];
        }

        outputChannel.appendLine(`[FrontmatterValidation] Found frontmatter at lines ${frontmatterRange.start.line}-${frontmatterRange.end.line}`);

        const errors: ValidationError[] = [];
        
        try {
            const frontmatterText = document.getText(frontmatterRange);
            const lines = frontmatterText.split('\n').slice(1, -1); // Remove --- markers
            
            outputChannel.appendLine(`[FrontmatterValidation] Raw frontmatter text:`);
            outputChannel.appendLine(frontmatterText);
            outputChannel.appendLine(`[FrontmatterValidation] Lines after splitting and removing markers:`);
            lines.forEach((line, index) => {
                outputChannel.appendLine(`  ${index}: "${line}"`);
            });
            
            // Parse YAML and validate structure
            const yamlData = this.parseYamlForValidation(lines, frontmatterRange.start.line + 1);
            
            outputChannel.appendLine(`[FrontmatterValidation] Parsed YAML data: ${JSON.stringify(yamlData, null, 2)}`);
            
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
        
        outputChannel.appendLine(`[FrontmatterValidation] Starting YAML parsing with ${lines.length} lines`);
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (!line.trim()) {
                outputChannel.appendLine(`  Line ${i}: Empty line, skipping`);
                continue;
            }
            
            const indent = line.length - line.trimStart().length;
            const trimmed = line.trim();
            
            outputChannel.appendLine(`  Line ${i}: indent=${indent}, trimmed="${trimmed}"`);
            
            // Pop stack until we find the right parent
            while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
                stack.pop();
            }
            
            const parent = stack[stack.length - 1].obj;
            
            if (trimmed.startsWith('- ')) {
                // Array item - need to find the parent field and ensure it's an array
                const itemContent = trimmed.substring(2).trim();
                
                outputChannel.appendLine(`    Array item: content="${itemContent}"`);
                
                // We need to look in the parent of the current stack frame
                // The array items should be added to the parent that contains the field name
                let arrayParent = null;
                let arrayKey = null;
                
                // Walk up the stack to find where to put this array item
                for (let stackIdx = stack.length - 1; stackIdx >= 0; stackIdx--) {
                    const stackFrame = stack[stackIdx];
                    const keys = Object.keys(stackFrame.obj);
                    
                    outputChannel.appendLine(`    Checking stack level ${stackIdx}: ${JSON.stringify(keys)}`);
                    
                    for (let j = keys.length - 1; j >= 0; j--) {
                        const key = keys[j];
                        const value = stackFrame.obj[key];
                        
                        if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
                            // This empty object should be converted to an array
                            outputChannel.appendLine(`    Converting empty object "${key}" to array`);
                            stackFrame.obj[key] = [];
                            arrayParent = stackFrame.obj;
                            arrayKey = key;
                            break;
                        } else if (Array.isArray(value)) {
                            // Already an array
                            outputChannel.appendLine(`    Found existing array "${key}"`);
                            arrayParent = stackFrame.obj;
                            arrayKey = key;
                            break;
                        }
                    }
                    
                    if (arrayKey) break;
                }
                
                outputChannel.appendLine(`    Selected array key: "${arrayKey}"`);
                
                if (arrayKey && Array.isArray(arrayParent[arrayKey])) {
                    if (itemContent.includes(':')) {
                        // Object in array - parse key-value pairs
                        const obj: any = {};
                        const colonIndex = itemContent.indexOf(':');
                        const objKey = itemContent.substring(0, colonIndex).trim();
                        const objValue = itemContent.substring(colonIndex + 1).trim();
                        
                        if (objValue !== '') {
                            obj[objKey] = this.parseValue(objValue);
                        } else {
                            obj[objKey] = '';
                        }
                        
                        arrayParent[arrayKey].push(obj);
                        stack.push({ obj, indent });
                    } else {
                        // Simple value in array
                        arrayParent[arrayKey].push(itemContent);
                    }
                }
            } else if (trimmed.includes(':')) {
                // Key-value pair
                const colonIndex = trimmed.indexOf(':');
                const key = trimmed.substring(0, colonIndex).trim();
                const value = trimmed.substring(colonIndex + 1).trim();
                
                outputChannel.appendLine(`    Key-value: key="${key}", value="${value}"`);
                
                if (value === '') {
                    // Object or array
                    outputChannel.appendLine(`    Creating empty object for key "${key}"`);
                    parent[key] = {};
                    stack.push({ obj: parent[key], indent });
                } else {
                    // Simple value
                    outputChannel.appendLine(`    Setting "${key}" = "${value}"`);
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

        // Check if it matches lifecycle + "all" pattern
        if (this.LIFECYCLE_ALL_PATTERN.test(value) || this.COMMA_SEPARATED_WITH_ALL_PATTERN.test(value)) {
            return;
        }

        // Check if it's just "all" by itself (invalid)
        if (value === 'all') {
            const valueRange = this.findValueRange(fieldPath.split('.').pop()!, document, startLine);
            if (valueRange) {
                errors.push({
                    range: valueRange,
                    message: `Invalid lifecycle value '${value}'. 'all' must be preceded by a lifecycle state (e.g., 'ga all', 'beta all')`,
                    severity: vscode.DiagnosticSeverity.Error,
                    code: 'invalid_lifecycle_value'
                });
            }
            return;
        }

        // Invalid lifecycle value
        const valueRange = this.findValueRange(fieldPath.split('.').pop()!, document, startLine);
        if (valueRange) {
            errors.push({
                range: valueRange,
                message: `Invalid lifecycle value '${value}'. Expected format: 'state', 'state version', or 'state all' (e.g., 'ga', 'beta 9.1', 'ga all')`,
                severity: vscode.DiagnosticSeverity.Error,
                code: 'invalid_lifecycle_value'
            });
        }
    }

    private validateProducts(products: any[], errors: ValidationError[], document: vscode.TextDocument, startLine: number): void {
        outputChannel.appendLine(`[FrontmatterValidation] Validating ${products.length} products`);
        
        // Get valid product IDs from schema
        const productsSchema = this.schema.properties.products;
        const validProductIds: string[] = [];
        
        if (productsSchema && productsSchema.items && productsSchema.items.properties && productsSchema.items.properties.id && productsSchema.items.properties.id.enum) {
            validProductIds.push(...productsSchema.items.properties.id.enum);
        }
        
        outputChannel.appendLine(`[FrontmatterValidation] Valid product IDs: ${validProductIds.join(', ')}`);
        outputChannel.appendLine(`[FrontmatterValidation] Products to validate: ${JSON.stringify(products)}`);

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
                outputChannel.appendLine(`[FrontmatterValidation] Invalid product ID found: '${product.id}' at index ${i}`);
                
                // Find the specific id value in the array item
                const idRange = this.findProductIdRange(product.id, i, document, startLine);
                if (idRange) {
                    outputChannel.appendLine(`[FrontmatterValidation] Found range for invalid product ID: line ${idRange.start.line}, chars ${idRange.start.character}-${idRange.end.character}`);
                    errors.push({
                        range: idRange,
                        message: `Invalid product ID '${product.id}'. Valid IDs: ${validProductIds.join(', ')}`,
                        severity: vscode.DiagnosticSeverity.Error,
                        code: 'invalid_product_id'
                    });
                } else {
                    outputChannel.appendLine(`[FrontmatterValidation] Could not find range for invalid product ID: '${product.id}'`);
                }
            } else {
                outputChannel.appendLine(`[FrontmatterValidation] Valid product ID: '${product.id}'`);
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

    private findProductIdRange(productId: string, itemIndex: number, document: vscode.TextDocument, startLine: number): vscode.Range | null {
        // Find the specific product ID value in the array
        let productsFound = 0;
        let inProductsArray = false;
        
        for (let i = startLine; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text;
            
            // Check if we've entered the products array
            if (text.match(/^\s*products\s*:/)) {
                inProductsArray = true;
                continue;
            }
            
            // Exit if we're no longer in products array (reached another top-level field)
            if (inProductsArray && text.match(/^[a-zA-Z_]/)) {
                break;
            }
            
            // Look for array items with id field
            if (inProductsArray && text.match(/^\s*-\s+id\s*:\s*(.+)$/)) {
                if (productsFound === itemIndex) {
                    // This is our target item, find the id value
                    const valueMatch = text.match(/^\s*-\s+id\s*:\s*(.+)$/);
                    if (valueMatch) {
                        const valueStart = text.indexOf(valueMatch[1]);
                        const valueEnd = valueStart + valueMatch[1].length;
                        return new vscode.Range(i, valueStart, i, valueEnd);
                    }
                }
                productsFound++;
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