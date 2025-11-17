# Elastic Docs extension for Visual Studio Code

An extension for Visual Studio Code and compatible IDEs that provides autocompletion for Elastic Docs' Markdown, as well as other features for authoring Elastic Docs authoring.

![vscode-ext](https://github.com/user-attachments/assets/c4ed81f9-9c5d-4e54-af16-857eb8f2bc00)

## Features

### Autocompletion
- **Directive autocompletion**: Autocompletes standard and inline directives.
- **Frontmatter autocompletion**: Autocompletes frontmatter fields.
- **Settings autocomplete**: Enter `:` inside a directive to view suggested settings.
- **Inline role completion**: Use `{icon}`, `{kbd}`, `{applies_to}`, and `{subs}` with autocompletion.
- **Substitution autocompletion**: Type `{{` to see available substitution variables from `docset.yml` files and document frontmatter.
- **Mutation operator completion**: Type `|` after a substitution variable to see available mutation operators for text and version transformations.

### Validation and diagnostics
- **Frontmatter validation**: Validates frontmatter fields against schema.
- **Directive syntax validation**: Real-time validation with red underlines and hover cards for errors.
- **Substitution validation**: Warns when literal values should be replaced with substitution variables.

### Enhanced user experience
- **Substitution tooltips**: Hover over existing `{{variable}}` to see their full values and mutation transformations.
- **Mutation preview**: See step-by-step transformation results when hovering over variables with mutations.
- **Enhanced completion tooltips**: Get full variable values when selecting from autocompletion.
- **Syntax highlighting**: Enhanced syntax highlighting for directives, parameters, roles, substitution variables, and mutation operators that works alongside standard Markdown highlighting.

## Inline roles

The extension provides autocompletion for several inline roles:

### Icon roles
Use `{icon}` to insert icons from Elastic's design system. Type `{icon}` followed by a backtick to see available icons.

### Keyboard shortcuts
Use `{kbd}` to format keyboard shortcuts. Type `{kbd}` followed by a backtick to see common keys and combinations.

### Applies-to roles
Use `{applies_to}` to specify product or deployment applicability. Type `{applies_to}` followed by a backtick to see available product keys and lifecycle states.

### Subs roles
Use `{subs}` for inline code that contains substitution variables. Type `{subs}` followed by a backtick, then use `{{variable}}` syntax with full autocompletion and mutation support.

Example: `{subs}`wget elasticsearch-{{version}}.tar.gz``

## Supported directives

### Admonitions
- `{note}` - Informational notes (supports `:applies_to:`)
- `{warning}` - Important warnings (supports `:applies_to:`)
- `{tip}` - Helpful tips (supports `:applies_to:`)
- `{important}` - Critical information (supports `:applies_to:`)
- `{admonition}` - Custom callouts (supports `:applies_to:`)

### Content organization
- `{dropdown}` - Collapsible content sections (supports `:applies_to:`)
- `{tab-set}` and `{tab-item}` - Tabbed content (supports `:group:` and `:sync:`)
- `{stepper}` and `{step}` - Step-by-step guides
- `{applies-switch}` and `{applies-item}` - Tabbed content with applies_to badges

### Media and visuals
- `{image}` - Images with alt text and sizing options
- `{carousel}` - Image carousels (supports `:max-height:`)
- `{diagram}` - Various diagram types (mermaid, d2, graphviz, plantuml, etc.)
- `{math}` - Mathematical expressions using LaTeX syntax (supports `:label:` for cross-referencing)

### Content inclusion
- `{include}` - Include content from other files
- `{csv-include}` - Include and render CSV files as formatted tables

## Substitution variables

The extension supports autocompletion for substitution variables defined in `docset.yml` files and document frontmatter (`sub:` field). These variables can be used throughout your markdown files with the `{{variable}}` syntax.

### Mutation operators

Transform substitution values using mutation operators with pipe syntax:

**Text case mutations:**
- `lc` - lowercase: `{{product.name | lc}}`
- `uc` - UPPERCASE: `{{product.name | uc}}`
- `tc` - Title Case: `{{product.name | tc}}`
- `c` - Capitalize: `{{product.name | c}}`
- `kc` - kebab-case: `{{product.name | kc}}`
- `sc` - snake_case: `{{product.name | sc}}`
- `cc` - camelCase: `{{product.name | cc}}`
- `pc` - PascalCase: `{{product.name | pc}}`
- `trim` - Remove extra characters: `{{value | trim}}`

**Version mutations:**
- `M` - Major version: `{{version | M}}` (9.1.5 → 9)
- `M.x` - Major.x: `{{version | M.x}}` (9.1.5 → 9.x)
- `M.M` - Major.Minor: `{{version | M.M}}` (9.1.5 → 9.1)
- `M+1` - Next major: `{{version | M+1}}` (9.1.5 → 10)
- `M.M+1` - Next minor: `{{version | M.M+1}}` (9.1.5 → 9.2)

**Chained mutations:** Combine multiple operators: `{{product.name | lc | kc}}`

### Shorthand notation

Use `.id` as shorthand for `product.id`: `{{.elasticsearch}}` is equivalent to `{{product.elasticsearch}}`

### Frontmatter substitutions

Define document-specific substitutions in the frontmatter `sub:` field:

```yaml
---
sub:
  my-variable: "My Value"
  version: "9.1.5"
---
```

These merge with `docset.yml` substitutions and are available throughout the document.

### Substitution validation and quick fixes

The extension automatically detects when you're using literal values that can be replaced with substitution variables. For example, if you have a substitution variable `{{product.apm}}` defined in your `docset.yml` file with the value "APM", the extension shows a warning when you type "APM" directly in your content, suggesting you use `{{product.apm}}` instead.

**Quick fix feature**: When the extension detects a literal value that should be replaced, you can:
- Click the lightbulb icon that appears
- Use the "Quick Fix..." menu (Ctrl+. or Cmd+. on macOS)
- Hover over the warning and click "Quick Fix"

The extension will automatically replace the literal text with the correct substitution variable syntax.

This helps maintain consistency across your documentation and makes it easier to update product names and other values globally.

## Quick start

1. **Install the extension** using the steps in the Installation section below.
2. **Open a Markdown file** in VS Code.
3. **Try the features**:
   - Type `:::` to see directive completions
   - Type `{icon}` followed by a backtick to see icon options
   - Type `{{` to see substitution variables
   - Type `|` after a variable to see mutation operators
   - Use `.elasticsearch` shorthand for `product.elasticsearch`
   - Add `sub:` field in frontmatter for document-specific variables
   - Add frontmatter fields and see autocompletion
   - Notice validation warnings for literal values that could use substitutions
   - Hover over variables with mutations to see transformation previews

## Installation

### From the Visual Studio Marketplace

1. Open the Visual Studio Marketplace.
2. Search for "Elastic Docs Utilities" or go [here](https://marketplace.visualstudio.com/items?itemName=elastic.elastic-docs-v3-utilities).
3. Select "Install".

### From the releases page

1. Download the latest `.vsix` file from the Releases page.
2. Start VSCode.
3. Press `Ctrl/Cmd+Shift+P` to open Command Palette.
4. Run **Extensions: Install from VSIX...**.
5. Select the downloaded `.vsix` file.

## Development

For detailed development, testing, and deployment instructions, refer to the **[Deployment Guide](docs/deployment-guide.md)**.

## License

Refer to [LICENSE.txt](LICENSE.txt) for details.