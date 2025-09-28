# Agent development guide for Elastic Docs V3 VS Code Extension

This document provides comprehensive instructions for AI agents to understand, develop, and extend this VS Code extension for Elastic Documentation V3 authoring.

## Extension overview

**Name**: Elastic Docs V3 Utilities  
**Purpose**: VS Code extension providing intelligent autocompletion, validation, and syntax highlighting for Elastic Documentation V3 Markdown authoring  
**Language**: TypeScript  
**Target**: VS Code 1.74.0+  

### Core functionality

The extension provides 8 primary features:
1. **Directive autocompletion** - `:::{directive}` blocks
2. **Parameter autocompletion** - Parameters within directives  
3. **Role autocompletion** - `{icon}` and `{kbd}` inline roles
4. **Substitution autocompletion** - `{{variable}}` from docset.yml files
5. **Frontmatter autocompletion** - YAML frontmatter field completion
6. **Validation & diagnostics** - Real-time error detection
7. **Hover tooltips** - Variable value previews
8. **Syntax highlighting** - Enhanced highlighting via grammar injection

## Architecture & file structure

### Core structure
```
src/
├── extension.ts                     # Main entry point & provider registration
├── directives.ts                    # Directive definitions & templates
├── directiveCompletionProvider.ts   # Handles :::{directive} completion
├── parameterCompletionProvider.ts   # Handles :parameter completion inside directives
├── roleCompletionProvider.ts        # Handles {icon} and {kbd} role completion
├── substitutionCompletionProvider.ts # Handles {{variable}} completion
├── substitutionHoverProvider.ts     # Provides hover tooltips for variables
├── frontmatterCompletionProvider.ts # Handles YAML frontmatter completion
├── frontmatterValidationProvider.ts # Validates frontmatter against schema
├── directiveDiagnosticProvider.ts   # Validates directive syntax
├── frontmatter-schema.json          # JSON schema for frontmatter validation
└── logger.ts                        # Centralized logging utilities

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
**Purpose**: Completes inline roles like `{icon}` and `{kbd}`

**How it works**:
- Detects patterns like `{icon}` or `{kbd}`
- For `{icon}` - provides icon name completions
- For `{kbd}` - provides keyboard shortcut suggestions
- Handles both complete role insertion and value completion

### 4. SubstitutionCompletionProvider
**File**: `src/substitutionCompletionProvider.ts`  
**Triggers**: `{` character  
**Purpose**: Completes substitution variables from docset.yml files

**How it works**:
- Scans workspace for `docset.yml` files
- Parses YAML to extract substitution variables
- Triggers on `{{` pattern
- Provides variable name completion with preview values
- Caches parsed docset files for performance

**Key features**:
- Multi-file docset support
- Hierarchical variable resolution
- Value preview in completion items
- YAML parsing error handling

### 5. FrontmatterCompletionProvider
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

### 6. FrontmatterValidationProvider & DirectiveDiagnosticProvider
**Files**: `src/frontmatterValidationProvider.ts`, `src/directiveDiagnosticProvider.ts`  
**Purpose**: Real-time validation with error highlighting

**How it works**:
- Creates diagnostic collections for errors
- Validates content against schemas/rules
- Shows red squiggles under invalid content
- Provides hover cards with error descriptions

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
**File**: `src/frontmatter-schema.json`  
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

### Error handling
- Always wrap provider logic in try-catch blocks
- Return empty arrays on errors to avoid breaking editor
- Use centralized logging via `logger.ts`

### Performance considerations
- Cache expensive operations (YAML parsing, file scanning)
- Use early returns for non-matching contexts
- Debounce diagnostic updates
- Limit completion item counts for large datasets

### Text pattern matching
Common patterns used throughout:
```typescript
// Directive detection
const colonMatch = textBefore.match(/^(:+)/);

// Frontmatter detection  
const isInFrontmatter = document.getText().startsWith('---');

// Substitution detection
const substitutionMatch = textBefore.match(/\{\{([^}]*)$/);
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
        { scheme: 'file', language: 'markdown', pattern: '**/*.md' },
        newProvider,
        'trigger1', 'trigger2'
    )
);
```

### Adding frontmatter fields

1. **Update schema**: Modify `src/frontmatter-schema.json`
2. **Add to properties object**:
```json
"new_field": {
    "type": "string",
    "description": "Description of the new field",
    "enum": ["value1", "value2"]
}
```

3. **The completion provider automatically picks up schema changes**

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
Edit `src/roleCompletionProvider.ts`, update `getIconCompletions()` method:
```typescript
const iconCompletions = [
    { name: 'check', description: 'Checkmark icon' },
    // Add new icons here
];
```

### Adding new substitution sources
Modify `src/substitutionCompletionProvider.ts`:
- Update `findDocsetFiles()` for new file patterns
- Modify `parseDocsetFile()` for new YAML structures
- Extend `getSubstitutions()` for additional variable sources

### Extending validation rules
Update diagnostic providers:
- `src/directiveDiagnosticProvider.ts` for directive validation
- `src/frontmatterValidationProvider.ts` for frontmatter validation
- Add new error types and detection logic

### Performance optimization
- Profile completion providers during development
- Cache expensive operations (file parsing, regex matches)
- Use workspace file watchers for cache invalidation
- Limit completion results for large datasets

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