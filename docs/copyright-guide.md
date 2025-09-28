# Copyright header management guide

This guide explains how to manage and maintain Elastic copyright headers in TypeScript files for this project.

## Current status ✅

All TypeScript files in this project already have the correct Elastic copyright header:

```typescript
/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *	http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
```

## Available commands

### Check copyright headers

```bash
# Check all TypeScript files for copyright headers
npm run copyright:check
```

This command will:
- ✅ List all files with correct copyright headers
- ❌ List any files missing copyright headers
- Exit with code 1 if any files are missing headers (useful for CI)

### Fix missing copyright headers

```bash
# Automatically add copyright headers to files that are missing them
npm run copyright:fix
```

This command will:
- Check all files like the check command
- Automatically add the copyright header to any files that are missing it
- Report which files were fixed

## Creating new TypeScript files

### Option 1: Use the helper script (recommended)

```bash
# Create a new TypeScript file with copyright header automatically included
./scripts/create-ts-file.sh src/newFeature.ts
```

This will:
- Create the file with the copyright header already included
- Create any necessary directories
- Leave space for you to add your code

### Option 2: Manual creation

If you create files manually:

1. Create your `.ts` file
2. Run `npm run copyright:fix` to automatically add the header
3. Or copy the header from `scripts/copyright-header.txt`

## Automated enforcement

### GitHub actions

The copyright header check is automatically run in CI/CD:

- **Pull requests**: Copyright headers are checked on every PR
- **Push to main**: Headers are validated before any deployment
- **Failed check**: The workflow will fail if any files are missing headers

### Local development

Before committing code, you can run:

```bash
# Run all checks (including copyright)
npm run lint
npm run copyright:check
npm run compile
```

## File structure

```
scripts/
├── copyright-header.txt     # Standard copyright header template
├── check-copyright.js       # Node.js script for checking/fixing headers
└── create-ts-file.sh       # Helper script for creating new files
```

## Troubleshooting

### "Files missing copyright header" error

If you see this error:

1. **In CI/CD**: The build will fail. You need to add copyright headers to the listed files.
2. **Locally**: Run `npm run copyright:fix` to automatically add headers.

### Adding headers manually

If you need to add a header manually:

1. Copy the content from `scripts/copyright-header.txt`
2. Paste it at the very beginning of your TypeScript file
3. Add a blank line after the header before your code

### Modifying the copyright header

If you need to update the copyright header format:

1. Edit `scripts/copyright-header.txt`
2. Run `npm run copyright:fix` to update all files
3. Commit the changes

## Best practices

1. **Always use the helper script** when creating new TypeScript files
2. **Run copyright check** before committing code
3. **Don't modify** the copyright header format without team approval
4. **Include copyright headers** in all source code files (.ts files)

## Integration with git hooks

You can add a pre-commit hook to automatically check copyright headers:

```bash
# Add to .git/hooks/pre-commit
#!/bin/sh
npm run copyright:check
if [ $? -ne 0 ]; then
    echo "❌ Copyright header check failed. Run 'npm run copyright:fix' to fix."
    exit 1
fi
```

## FAQ

**Q: Do I need copyright headers in test files?**
A: Yes, all TypeScript files should have copyright headers, including test files.

**Q: What about JSON files or configuration files?**
A: The current setup only handles TypeScript (.ts) files. For other file types, headers would need to be added manually.

**Q: Can I exclude certain files?**
A: Currently all `.ts` files are included. To exclude files, you would need to modify the `check-copyright.js` script.

**Q: What if I accidentally commit a file without a header?**
A: The CI will catch it and fail. You can then run `npm run copyright:fix` and push the fix.