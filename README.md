# Elastic Docs V3 Utilities

A VSCode extension that provides autocompletion for Elastic Docs V3 Markdown authoring with directive support.

## Features

- **Directive autocompletion**: Autocompletes standard and inline directives.
- **Settings autocomplete**: Type : inside a directive to see suggested options.
- **Icon and kbd completion**: Use `{icon}` and `{kbd}` with autocompletion
- **Substitution autocompletion**: Type `{{` to see available substitution variables from `docset.yml` files
- **Substitution tooltips**: Hover over existing `{{variable}}` to see their full values
- **Enhanced completion tooltips**: See full variable values when selecting from autocompletion
- **Validates directive syntax**: Real-time validation with red underlines and hover cards for errors
- **Syntax highlighting**: Enhanced syntax highlighting for directives, parameters, roles, and substitution variables that works alongside standard Markdown highlighting

## Supported directives

- `{note}` - Informational notes
- `{warning}` - Important warnings
- `{tip}` - Helpful tips
- `{important}` - Critical information
- `{admonition}` - Custom callouts
- `{dropdown}` - Collapsible content sections
- `{tab-set}` and `{tab-item}` - Tabbed content
- `{stepper}` and `{step}` - Step-by-step guides
- `{image}` - Images with alt text and sizing options
- `{carousel}` - Image carousels
- `{diagram}` - Various diagram types (mermaid, d2, etc.)
- `{include}` - Include content from other files

## Substitution Variables

The extension supports autocompletion for substitution variables defined in `docset.yml` files. These variables can be used throughout your markdown files with the `{{variable}}` syntax.

## To do

- Add frontmatter validation and autocomplete
- Add support for applies_to directives, both inline and for sections
- Use external JSON data to update extension dynamically

## Installation

1. Download the latest `.vsix` file from the [Releases](../../releases) page or use the packaged version in this repository
2. Open VSCode
3. Press `Ctrl/Cmd+Shift+P` to open Command Palette
4. Run "Extensions: Install from VSIX..."
5. Select the downloaded `.vsix` file

## Development

### Prerequisites

- Node.js
- npm
- VSCode

### Building

```bash
npm install
npm run compile
```

### Packaging

```bash
npm run package
```

### Creating a release

To generate a new release with a VSIX package:

1. **Create and push a version tag**:
   ```bash
   git tag v1.0.0  # Replace with your version number
   git push origin v1.0.0
   ```

2. **Automated release process**: The GitHub workflow (`.github/workflows/release.yml`) will automatically:
   - Build the extension
   - Compile TypeScript
   - Package the extension using `vsce package`
   - Create a GitHub release with the VSIX file attached
   - Generate release notes with installation instructions

3. **Manual packaging** (for local testing):
   ```bash
   npm install -g @vscode/vsce
   vsce package
   ```

The release workflow is triggered by pushing tags that start with `v` (e.g., `v1.0.0`, `v2.1.3`).

### Project structure

```
src/
├── extension.ts                    # Main extension entry point
├── directiveCompletionProvider.ts  # Handles ::: completion
├── parameterCompletionProvider.ts  # Handles parameter completion
├── roleCompletionProvider.ts       # Handles {icon} and {kbd} completion
├── substitutionCompletionProvider.ts # Handles {{ substitution completion
├── substitutionHoverProvider.ts    # Handles hover tooltips for substitutions
├── directiveDiagnosticProvider.ts  # Handles malformed directive detection
└── directives.ts                   # Directive definitions and templates

syntaxes/
└── elastic-markdown.tmLanguage.json # Syntax highlighting rules
```

## License

See [LICENSE.txt](LICENSE.txt) for details.
