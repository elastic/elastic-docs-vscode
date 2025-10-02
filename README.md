# Elastic Docs extension for Visual Studio Code

An extension for Visual Studio Code and compatible IDEs that provides autocompletion for Elastic Docs' Markdown, as well as other features for authoring Elastic Docs authoring.

## Features

- **Directive autocompletion**: Autocompletes standard and inline directives.
- **Frontmatter autocompletion**: Autocompletes frontmatter fields.
- **Frontmatter validation**: Validates frontmatter fields.
- **Settings autocomplete**: Type : inside a directive to see suggested options.
- **Icon and kbd completion**: Use `{icon}` and `{kbd}` with autocompletion
- **Substitution autocompletion**: Type `{{` to see available substitution variables from `docset.yml` files
- **Substitution tooltips**: Hover over existing `{{variable}}` to see their full values
- **Enhanced completion tooltips**: See full variable values when selecting from autocompletion
- **Validates directive syntax**: Real-time validation with red underlines and hover cards for errors
- **Syntax highlighting**: Enhanced syntax highlighting for directives, parameters, roles, and substitution variables that works alongside standard Markdown highlighting

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

### Content inclusion
- `{include}` - Include content from other files
- `{csv-include}` - Include and render CSV files as formatted tables

## Substitution Variables

The extension supports autocompletion for substitution variables defined in `docset.yml` files. These variables can be used throughout your markdown files with the `{{variable}}` syntax.

## Installation

1. Download the latest `.vsix` file from the Releases page.
2. Open VSCode.
3. Press `Ctrl/Cmd+Shift+P` to open Command Palette.
4. Run "Extensions: Install from VSIX...".
5. Select the downloaded `.vsix` file.

## Development

For detailed development, testing, and deployment instructions, see the **[Deployment Guide](docs/deployment-guide.md)**.

## Documentation

Additional documentation is available:

- **[AGENTS.md](AGENTS.md)** - Comprehensive guide for AI agents and developers
- **[RELEASE_NOTES.md](RELEASE_NOTES.md)** - Version history and changelog
- **[docs/marketplace-setup.md](docs/marketplace-setup.md)** - VS Code Marketplace publishing setup
- **[docs/deployment-guide.md](docs/deployment-guide.md)** - Testing and deployment guide
- **[docs/copyright-guide.md](docs/copyright-guide.md)** - Copyright header management
- **[docs/example.md](docs/example.md)** - Example Elastic Docs V3 Markdown file

## License

See [LICENSE.txt](LICENSE.txt) for details.
