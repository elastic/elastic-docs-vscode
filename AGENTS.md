# Agent development guide for Elastic Docs V3 VS Code Extension

This document provides comprehensive instructions for AI agents to understand, develop, and extend this VS Code extension for Elastic Documentation V3 authoring.

## Extension overview

**Name**: Elastic Docs V3 Utilities  
**Purpose**: VS Code extension providing intelligent autocompletion, validation, and syntax highlighting for Elastic Documentation V3 Markdown authoring  
**Language**: TypeScript  
**Target**: VS Code 1.74.0+  

### Core functionality

The extension provides 10 primary features:
1. **Directive autocompletion** - `:::{directive}` blocks
2. **Parameter autocompletion** - Parameters within directives  
3. **Role autocompletion** - `{icon}`, `{kbd}`, and `{applies_to}` inline roles
4. **Substitution autocompletion** - `{{variable}}` from docset.yml files
5. **Frontmatter autocompletion** - YAML frontmatter field completion
6. **Validation & diagnostics** - Real-time error detection for directives, frontmatter, and substitutions
7. **Hover tooltips** - Variable value previews
8. **Syntax highlighting** - Enhanced highlighting via grammar injection
9. **Substitution validation** - Warns when literal values should be replaced with substitution variables
10. **Substitution quick fixes** - One-click code actions to replace literal values with substitution variables

## Architecture & file structure

### Core structure
```
src/
├── extension.ts                        # Main entry point & provider registration
├── directives.ts                       # Directive definitions & templates
├── directiveCompletionProvider.ts      # Handles :::{directive} completion
├── parameterCompletionProvider.ts      # Handles :parameter completion inside directives
├── roleCompletionProvider.ts           # Handles {icon}, {kbd}, {applies_to}, and {subs} role completion
├── substitutionCompletionProvider.ts   # Handles {{variable}} completion with mutations
├── substitutionHoverProvider.ts        # Provides hover tooltips with mutation previews
├── substitutionValidationProvider.ts   # Validates substitution usage and suggests improvements
├── substitutionCodeActionProvider.ts   # Provides quick fixes for substitution warnings
├── undefinedSubstitutionValidator.ts   # Validates undefined substitution references
├── mutations.ts                        # Mutation operator definitions and parsing
├── mutationEngine.ts                   # Mutation transformation engine
├── frontmatterCompletionProvider.ts    # Handles YAML frontmatter completion
├── frontmatterValidationProvider.ts    # Validates frontmatter against schema
├── directiveDiagnosticProvider.ts      # Validates directive syntax
├── frontmatterSchema.ts                # TypeScript schema definitions for frontmatter
├── frontmatter-schema.json             # JSON schema for frontmatter validation
├── substitutions.ts                    # Substitution variable parsing and caching utilities
├── products.ts                         # Product definitions and mappings
└── logger.ts                           # Centralized logging utilities

syntaxes/
└── elastic-markdown.tmLanguage.json # TextMate grammar for syntax highlighting

package.json                         # Extension manifest & configuration
tsconfig.json                       # TypeScript configuration
```

### Extension activation

The extension activates on:
- `onLanguage:markdown` - When markdown files are opened
- `onStartupFinished` - After VS Code fully loads

All providers are registered in `src/extension.ts` using `vscode.languages.registerCompletionItemProvider()`.

## Core providers deep dive

### 1. DirectiveCompletionProvider
**File**: `src/directiveCompletionProvider.ts`  
**Triggers**: `:`, `{` characters  
**Purpose**: Completes directive blocks like `:::{note}`, `:::{warning}`, etc.

**How it works**:
- Detects `:::` at line start followed by optional `{`
- Filters directives from `DIRECTIVES` constant in `directives.ts`
- Provides completion with full directive template insertion
- Supports both argument-based (`{note}`) and argumentless directives

**Key methods**:
- `getAllDirectiveCompletions()` - Returns all available directives
- `getDirectivesWithArgumentsCompletions()` - Returns only directives that take arguments
- `getFilteredDirectivesWithArguments()` - Filters based on partial input

### 2. ParameterCompletionProvider  
**File**: `src/parameterCompletionProvider.ts`  
**Triggers**: `:` character  
**Purpose**: Completes parameters within directive blocks

**How it works**:
- Detects when cursor is inside a directive block (between `:::` markers)
- Identifies the current directive type
- Suggests valid parameters for that directive from the `DIRECTIVES` definition
- Provides parameter names with descriptions

### 3. RoleCompletionProvider
**File**: `src/roleCompletionProvider.ts`  
**Triggers**: `{`, `` ` `` characters  
**Purpose**: Completes inline roles like `{icon}`, `{kbd}`, and `{applies_to}`

**How it works**:
- Detects patterns like `{icon}`, `{kbd}`, or `{applies_to}`
- For `{icon}` - provides comprehensive icon name completions from Elastic's icon set
- For `{kbd}` - provides keyboard shortcut suggestions and common combinations
- For `{applies_to}` - provides product/deployment keys with lifecycle states and common patterns
- Handles both complete role insertion and value completion
- Supports complex applies_to patterns with version numbers and nested objects

**Key features**:
- 200+ predefined icons from Elastic's design system
- Keyboard shortcuts including common combinations (cmd+c, ctrl+v, etc.)
- Applies_to completion with lifecycle states (ga, preview, beta, deprecated, etc.)
- Product-specific completion for APM agents, EDOT components, and deployment models

### 4. SubstitutionCompletionProvider
**File**: `src/substitutionCompletionProvider.ts`
**Triggers**: `{`, `|` characters
**Purpose**: Completes substitution variables from docset.yml files and frontmatter

**How it works**:
- Scans workspace for `docset.yml` files
- Parses document frontmatter `sub:` field for inline substitutions
- Merges frontmatter and docset.yml substitutions
- Triggers on `{{` pattern for variables
- Triggers on `|` for mutation operators
- Provides variable name completion with preview values
- Supports shorthand notation (`.id` → `product.id`)
- Caches parsed docset files for performance

**Key features**:
- Multi-file docset support with frontmatter overrides
- Hierarchical variable resolution
- Value preview in completion items
- YAML parsing error handling
- Mutation operator completion (lc, uc, tc, c, kc, sc, cc, pc, trim, M, M.x, M.M, M+1, M.M+1)
- Shorthand notation support
- Performance optimized with cache invalidation on save

### 5. SubstitutionValidationProvider
**File**: `src/substitutionValidationProvider.ts`
**Purpose**: Validates substitution usage and suggests improvements

**How it works**:
- Scans document content for literal values that match substitution variables
- Compares found values against available substitutions from docset.yml and frontmatter
- Provides warnings when literal values should be replaced with `{{variable}}` syntax
- Uses regex matching to detect values in context (word boundaries)
- Prevents duplicate warnings for overlapping matches
- Excludes frontmatter section from validation to avoid false positives

**Key features**:
- Validation runs on save/open (not on every keystroke for performance)
- Context-aware detection (respects word boundaries)
- Integration with VS Code diagnostics system
- Performance optimized with caching
- Frontmatter exclusion to prevent false positives on substitution definitions

### 6. FrontmatterCompletionProvider
**File**: `src/frontmatterCompletionProvider.ts`  
**Triggers**: `:`, ` `, `-` characters  
**Purpose**: Completes YAML frontmatter fields

**How it works**:
- Uses embedded JSON schema (`frontmatter-schema.json`)
- Detects when cursor is in frontmatter block (between `---` markers)
- Provides field name completion and value completion
- Supports nested objects, arrays, and enum values
- Context-aware completion based on cursor position

**Schema integration**:
- 600+ line comprehensive schema covering all Elastic docs frontmatter
- Includes field descriptions, types, and allowed values
- Supports complex structures like `applies_to` with product/version matrices

### 7. FrontmatterValidationProvider & DirectiveDiagnosticProvider
**Files**: `src/frontmatterValidationProvider.ts`, `src/directiveDiagnosticProvider.ts`  
**Purpose**: Real-time validation with error highlighting

**How it works**:
- Creates diagnostic collections for errors
- Validates content against schemas/rules
- Shows red squiggles under invalid content
- Provides hover cards with error descriptions

### 8. SubstitutionCodeActionProvider
**File**: `src/substitutionCodeActionProvider.ts`  
**Purpose**: Provides quick fixes for substitution validation warnings

**How it works**:
- Implements `vscode.CodeActionProvider` interface
- Detects diagnostics from `SubstitutionValidationProvider` with code `use_sub`
- Parses diagnostic messages to extract substitution key and original value
- Creates code actions that replace literal text with `{{variable}}` syntax
- Marks actions as "preferred" for quick application via keyboard shortcuts

**Key features**:
- One-click replacement of literal values with substitution variables
- Accessible via lightbulb icon, "Quick Fix..." menu, or keyboard shortcuts
- Automatic text replacement preserving document formatting
- Integration with VS Code's built-in code action system

## Data structures & configuration

### Directive definitions
**File**: `src/directives.ts`

```typescript
export interface DirectiveDefinition {
    name: string;           // Directive name (e.g., 'note', 'warning')
    hasArgument: boolean;   // Whether it takes arguments in braces
    parameters: string[];   // Valid parameter names
    template: string;       // Insertion template with placeholders
    description: string;    // User-facing description
}
```

### Frontmatter schema
**File**: `src/frontmatterSchema.ts`  
- TypeScript-based schema definitions with comprehensive type safety
- Complete JSON Schema Draft 7 specification embedded as const
- 600+ lines covering all Elastic docs frontmatter fields
- Includes `applies_to` product/version matrix with lifecycle states
- Field descriptions, types, and allowed values
- Support for complex structures like deployment applicability and serverless projects

### Product definitions
**File**: `src/products.ts`  
- Centralized product mapping with 90+ Elastic products
- Maps product IDs to display names (e.g., 'apm' → 'APM')
- Includes APM agents, EDOT components, cloud services, and tools
- Used for frontmatter completion and substitution filtering

### Substitution utilities
**File**: `src/substitutions.ts`
- YAML parsing utilities for docset.yml files and frontmatter
- Centralized cache management with SubstitutionCache class
- Multi-file docset support with hierarchical resolution
- Frontmatter `sub:` field parsing and merging
- Shorthand notation resolution (`.id` → `product.id`)
- Product filtering to avoid circular references
- Ordered substitution variables by value length
- Cache invalidation on document save

### Mutation operators
**Files**: `src/mutations.ts`, `src/mutationEngine.ts`

**Text case mutations**:
- `lc` - LowerCase: converts all characters to lowercase
- `uc` - UpperCase: converts all characters to uppercase
- `tc` - TitleCase: capitalizes all words
- `c` - Capitalize: capitalizes the first letter
- `kc` - KebabCase: converts to kebab-case
- `sc` - SnakeCase: converts to snake_case
- `cc` - CamelCase: converts to camelCase
- `pc` - PascalCase: converts to PascalCase
- `trim` - Trim: removes common non-word characters from start and end

**Version mutations**:
- `M` - Major: displays only the major version component (e.g., 9.1.5 → 9)
- `M.x` - Major.x: displays major component followed by '.x' (e.g., 9.1.5 → 9.x)
- `M.M` - Major.Minor: displays only major and minor components (e.g., 9.1.5 → 9.1)
- `M+1` - Next Major: increments to the next major version (e.g., 9.1.5 → 10)
- `M.M+1` - Next Minor: increments to the next minor version (e.g., 9.1.5 → 9.2)

**Usage**: Mutations can be chained using pipe syntax: `{{version | lc | M}}`

**Key features**:
- Step-by-step transformation display in hover cards
- Completion support after pipe character
- Syntax highlighting for mutation operators
- Error-tolerant transformation (returns original on failure)

### Role completion constants
**File**: `src/roleCompletionProvider.ts`  
- `ICONS`: 200+ predefined icons from Elastic's design system
- `KEYBOARD_SHORTCUTS`: Common keyboard keys and combinations
- `APPLIES_TO_KEYS`: Product and deployment keys for applies_to completion
- `LIFECYCLE_STATES`: Valid lifecycle states (ga, preview, beta, deprecated, etc.)

### Frontmatter schema (JSON)
**File**: `src/frontmatter-schema.json`  
- Legacy JSON schema file (being phased out in favor of TypeScript schema)
- Complete JSON Schema Draft 7 specification
- 600+ lines covering all Elastic docs frontmatter fields
- Includes `applies_to` product/version matrix
- Field descriptions and constraints

### Syntax highlighting
**File**: `syntaxes/elastic-markdown.tmLanguage.json`  
- TextMate grammar for syntax highlighting
- Injection grammar that extends standard Markdown
- Targets directives, roles, substitutions, and parameters
- Scopes: `elastic-directives.injection`

## Development patterns & conventions

### Provider pattern
All completion providers implement `vscode.CompletionItemProvider`:
```typescript
export class ExampleProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        // Implementation
    }
}
```

Validation providers implement custom validation logic:
```typescript
export class ExampleValidationProvider {
    public validateDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
        // Validation logic returning diagnostic errors/warnings
    }
}
```

### Error handling
- Always wrap provider logic in try-catch blocks
- Return empty arrays on errors to avoid breaking editor
- Use centralized logging via `logger.ts`
- Validation providers should gracefully handle parsing errors

### Performance considerations
- Cache expensive operations (YAML parsing, file scanning, regex matching)
- Use early returns for non-matching contexts
- Debounce diagnostic updates to avoid excessive validation
- Limit completion item counts for large datasets (e.g., 200+ icons)
- Implement cache invalidation for docset.yml file changes
- Use workspace file watchers for cache management

### Text pattern matching
Common patterns used throughout:
```typescript
// Directive detection
const colonMatch = textBefore.match(/^(:+)/);

// Frontmatter detection  
const isInFrontmatter = document.getText().startsWith('---');

// Substitution detection
const substitutionMatch = textBefore.match(/\{\{([^}]*)$/);

// Role completion detection
const roleMatch = textBefore.match(/\{(icon|kbd|applies_to)$/);

// Applies_to pattern validation
const appliesToPattern = /^(preview|beta|ga|deprecated|removed|unavailable|planned|development|discontinued)\s+[0-9]+(\.[0-9]+)*$/;
```

### Copyright headers
All TypeScript files must include Elastic copyright header:
```typescript
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements...
 */
```

Use `npm run copyright:check` and `npm run copyright:fix` to manage headers.

## Adding new features

### Adding a new directive

1. **Update directives.ts**:
```typescript
{
    name: 'mynewdirective',
    hasArgument: true,
    parameters: ['param1', 'param2'],
    template: ':::{mynewdirective}\n${1:Content here}\n:::',
    description: 'Description of the new directive'
}
```

2. **Update syntax highlighting** in `syntaxes/elastic-markdown.tmLanguage.json`:
```json
{
  "match": ":::\\{(note|warning|tip|important|mynewdirective)\\}",
  "name": "markup.directive.elastic"
}
```

3. **Test the completion** works in markdown files

### Adding a new completion provider

1. **Create provider file**: `src/newFeatureProvider.ts`
2. **Implement interface**: `vscode.CompletionItemProvider`
3. **Register in extension.ts**:
```typescript
const newProvider = new NewFeatureProvider();
context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
        { scheme: '*', language: 'markdown', pattern: '**/*.md' },
        newProvider,
        'trigger1', 'trigger2'
    )
);
```

### Adding a new validation provider

1. **Create validation file**: `src/newValidationProvider.ts`
2. **Implement validation logic**:
```typescript
export class NewValidationProvider {
    public validateDocument(document: vscode.TextDocument): vscode.Diagnostic[] {
        const errors: ValidationError[] = [];
        // Add validation logic here
        return errors.map(error => new vscode.Diagnostic(error.range, error.message, error.severity));
    }
}
```
3. **Register in extension.ts**:
```typescript
const newValidator = new NewValidationProvider();
const diagnosticCollection = vscode.languages.createDiagnosticCollection('new-feature');
context.subscriptions.push(diagnosticCollection);

// Add to updateDiagnostics function
const newDiagnostics = newValidator.validateDocument(document);
diagnosticCollection.set(document.uri, newDiagnostics);
```

### Adding frontmatter fields

1. **Update TypeScript schema**: Modify `src/frontmatterSchema.ts`
2. **Add to properties object**:
```typescript
"new_field": {
    "type": "string",
    "description": "Description of the new field",
    "enum": ["value1", "value2"]
}
```
3. **Update legacy JSON schema** (if still needed): Modify `src/frontmatter-schema.json`
4. **The completion provider automatically picks up schema changes**

### Adding new role completions

**For icons**: Edit `src/roleCompletionProvider.ts`, update `ICONS` constant:
```typescript
export const ICONS = [
    'existing_icon',
    'new_icon', // Add new icons here
    // ... rest of icons
];
```

**For keyboard shortcuts**: Update `KEYBOARD_SHORTCUTS` constant:
```typescript
export const KEYBOARD_SHORTCUTS = [
    'existing_key',
    'new_key', // Add new keys here
    // ... rest of keys
];
```

**For applies_to keys**: Update `APPLIES_TO_KEYS` constant:
```typescript
export const APPLIES_TO_KEYS = [
    'existing_key',
    'new_product_key', // Add new product/deployment keys here
    // ... rest of keys
];
```

## Testing & debugging

### Local development
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode for development
npm run watch

# Run linting
npm run lint

# Check copyright headers
npm run copyright:check
```

### Testing in VS Code
1. Press `F5` to launch extension development host
2. Open a `.md` file in the new window
3. Test completion triggers:
   - `:::` for directives
   - `:::{` for directive arguments
   - `:` inside directives for parameters
   - `{icon}` for icon roles
   - `{{` for substitutions
   - Frontmatter fields in YAML blocks

### Debugging
- Use VS Code debugger with breakpoints in TypeScript files
- Check output channel: "Elastic Docs V3 Utilities" for logs
- Use `outputChannel.appendLine()` for debug logging

### Extension packaging
```bash
# Install vsce globally
npm install -g @vscode/vsce

# Package extension  
vsce package

# Install locally
code --install-extension elastic-docs-v3-utilities-*.vsix
```

## Build & deployment

### Automated CI/CD
- **GitHub Actions**: `.github/workflows/release.yml` and `test-package.yml`
- **Release process**: Push tags starting with `v` (e.g., `v1.0.0`)
- **Marketplace publishing**: Automatic via GitHub Actions with `VSCE_PAT` secret
- **Testing**: Every PR runs packaging and validation tests

### Manual release
1. Update version in `package.json`
2. Create git tag: `git tag v1.0.0`
3. Push tag: `git push origin v1.0.0`
4. GitHub Actions handles the rest

## Common development tasks

### Adding new icon completions
Edit `src/roleCompletionProvider.ts`, update `ICONS` constant:
```typescript
export const ICONS = [
    'check', 'warning', 'info',
    'new_icon', // Add new icons here
    // ... rest of icons
];
```

### Adding new substitution sources
Modify `src/substitutions.ts`:
- Update `findDocsetFiles()` for new file patterns
- Modify `parseDocsetFile()` for new YAML structures
- Extend `getSubstitutions()` for additional variable sources
- Update product filtering logic in `products.ts`

### Adding new products
Edit `src/products.ts`, update `PRODUCTS` constant:
```typescript
export const PRODUCTS: Record<string, string> = {
    'existing_product': 'Existing Product',
    'new_product': 'New Product', // Add new products here
    // ... rest of products
};
```

### Extending validation rules
Update diagnostic providers:
- `src/directiveDiagnosticProvider.ts` for directive validation
- `src/frontmatterValidationProvider.ts` for frontmatter validation
- `src/substitutionValidationProvider.ts` for substitution validation
- Add new error types and detection logic

### Performance optimization
- Profile completion providers during development
- Cache expensive operations (file parsing, regex matches, YAML parsing)
- Use workspace file watchers for cache invalidation
- Limit completion results for large datasets (icons, products)
- Implement debouncing for validation providers

## Troubleshooting

### Common issues

1. **Completions not showing**: Check trigger characters match registration
2. **Syntax highlighting not working**: Verify grammar injection scope
3. **Schema validation failing**: Check JSON schema syntax
4. **Extension not activating**: Verify activation events in package.json

### Debug approaches
- Enable developer tools in extension host
- Use VS Code command palette: "Developer: Show Running Extensions"
- Check extension output channel for error messages
- Use TypeScript compiler for static analysis

## Extension API integration

### Key VS Code APIs used
- `vscode.languages.registerCompletionItemProvider()` - Completion providers
- `vscode.languages.registerHoverProvider()` - Hover tooltips  
- `vscode.languages.createDiagnosticCollection()` - Error reporting
- `vscode.workspace.findFiles()` - File system access
- `vscode.window.createOutputChannel()` - Logging

### Extension manifest (package.json)
Key configuration sections:
- `activationEvents`: When extension loads
- `contributes.languages`: Language association
- `contributes.grammars`: Syntax highlighting injection
- `contributes.commands`: Available commands
- `engines.vscode`: Minimum VS Code version

This guide should provide all the necessary information for understanding and extending the Elastic Docs V3 VS Code extension. Focus on the provider pattern, understand the data structures, and follow the established conventions for consistency.

## Recent architecture updates

### Version 0.10.0+ Changes (Substitution Improvements)
- **Mutation operators**: Added comprehensive mutation system for text transformations and version manipulation
  - Text case mutations (lc, uc, tc, c, kc, sc, cc, pc, trim)
  - Version mutations (M, M.x, M.M, M+1, M.M+1)
  - Chained mutation support with pipe syntax
  - Real-time computation and preview in hover cards
- **Frontmatter substitutions**: Parse `sub:` field in document frontmatter for inline variable definitions
- **Shorthand notation**: Support `.id` shorthand for `product.id` (e.g., `{{.elasticsearch}}`)
- **{subs} role**: Added inline code role for substitutions with full syntax highlighting
- **Performance optimization**: Validation runs only on save/open instead of every keystroke
- **Centralized caching**: Unified cache management with explicit invalidation
- **Undefined substitution validation**: Separate validator for undefined variable references
- **Frontmatter exclusion**: Validation skips frontmatter to prevent false positives

### Version 0.9.0+ Changes
- **Enhanced role completion**: Added `{applies_to}` role support with comprehensive product/deployment key completion
- **Substitution validation**: New validation provider that warns when literal values should be replaced with substitution variables
- **TypeScript schema**: Migrated from JSON schema to TypeScript-based schema definitions in `frontmatterSchema.ts`
- **Centralized constants**: Moved icon definitions, keyboard shortcuts, and product mappings to dedicated constant files
- **Improved caching**: Enhanced substitution parsing with better caching and performance optimization
- **Product filtering**: Added intelligent filtering to prevent circular references in substitution variables

### Key architectural improvements
- **Separation of concerns**: Validation logic separated into dedicated providers
- **Type safety**: TypeScript schemas provide better type checking and IDE support
- **Performance**: Caching and debouncing reduce computational overhead
- **Mutation engine**: Separate transformation engine for extensible mutation operations
- **Extensibility**: Modular design makes it easier to add new completion types and validation rules