# Deployment and testing guide

This guide covers how to test and deploy your VS Code extension to the marketplace.

## Testing before release

### 1. Automated testing

The repository includes two GitHub Actions workflows:

- **`test-package.yml`**: Runs on every push/PR to test packaging without publishing
- **`release.yml`**: Runs on tag push to publish to marketplace and create GitHub release

### 2. Manual testing

Before creating a release, you should test the extension locally:

```bash
# Install dependencies
npm ci

# Run linting
npm run lint

# Compile TypeScript
npm run compile

# Test packaging
npm run package

# Install the extension locally for testing
code --install-extension ./elastic-docs-v3-utilities-*.vsix
```

### 3. Pre-release checklist

Before creating a release tag:

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` or release notes
- [ ] Test the extension locally
- [ ] Ensure all tests pass
- [ ] Verify the `publisher` field matches your marketplace publisher ID
- [ ] Confirm `VSCE_PAT` secret is set and valid

## Deployment process

### Step 1: Prepare the release

1. **Update version**: Increment the version in `package.json`:
   ```json
   {
     "version": "1.2.3"
   }
   ```

2. **Commit changes**:
   ```bash
   git add package.json
   git commit -m "Bump version to 1.2.3"
   git push origin main
   ```

### Step 2: Create and push tag

```bash
# Create the tag (must start with 'v')
git tag v1.2.3

# Push the tag to trigger the release workflow
git push origin v1.2.3
```

### Step 3: Monitor the release

1. Go to your GitHub repository's "Actions" tab
2. Watch the "Release" workflow execution
3. The workflow will:
   - ✅ Build and compile the extension
   - ✅ Validate version consistency between tag and package.json
   - ✅ Package the extension
   - ✅ Publish to VS Code Marketplace
   - ✅ Create a GitHub release with the `.vsix` file

### Step 4: Verify the release

1. **Check VS Code Marketplace**: 
   - Go to https://marketplace.visualstudio.com/items?itemName=elastic.elastic-docs-v3-utilities
   - Verify the new version is available

2. **Check GitHub release**:
   - Go to your repository's "Releases" page
   - Verify the new release was created with the `.vsix` file attached

3. **Test installation**:
   ```bash
   # Install from marketplace
   code --install-extension elastic.elastic-docs-v3-utilities
   ```

## Troubleshooting

### Common issues

1. **Version mismatch error**:
   ```
   Error: package.json version (1.2.2) doesn't match tag version (1.2.3)
   ```
   **Solution**: Update `package.json` version to match your tag, or create a new tag with the correct version.

2. **Authentication error**:
   ```
   Error: Failed to publish. Check your credentials.
   ```
   **Solution**: 
   - Verify `VSCE_PAT` secret is set in GitHub repository settings
   - Check if your Personal Access Token has expired
   - Ensure the PAT has "Marketplace Manage" permissions

3. **Publisher mismatch**:
   ```
   Error: Extension publisher 'your-publisher' doesn't match expected 'elastic'
   ```
   **Solution**: Update the `publisher` field in `package.json` to match your marketplace publisher ID.

4. **Package not found**:
   ```
   Error: Package file not found: ./elastic-docs-v3-utilities-1.2.3.vsix
   ```
   **Solution**: This usually indicates the packaging step failed. Check the build logs for compilation errors.

### Manual publishing (emergency)

If the automated publishing fails, you can publish manually:

```bash
# Install vsce globally
npm install -g @vscode/vsce

# Build and package
npm ci
npm run compile
vsce package

# Publish to marketplace
vsce publish --packagePath ./elastic-docs-v3-utilities-*.vsix
```

## Rollback process

If you need to unpublish or rollback a version:

1. **Unpublish from marketplace** (use cautiously):
   ```bash
   vsce unpublish elastic.elastic-docs-v3-utilities@1.2.3
   ```

2. **Delete GitHub release**:
   - Go to repository's "Releases" page
   - Click on the release
   - Click "Delete this release"

3. **Delete git tag**:
   ```bash
   git tag -d v1.2.3
   git push --delete origin v1.2.3
   ```

## Environment variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VSCE_PAT` | Personal Access Token for VS Code Marketplace | Yes |

## Workflow permissions

The release workflow requires these permissions:
- `contents: write` - To create GitHub releases
- Access to repository secrets for `VSCE_PAT`

## Best practices

1. **Semantic versioning**: Use semantic versioning (major.minor.patch)
2. **Test thoroughly**: Always test locally before releasing
3. **Release notes**: Include meaningful release notes
4. **Security**: Regularly rotate your Personal Access Token
5. **Monitoring**: Monitor the marketplace page after releases
6. **Backup**: Keep local copies of `.vsix` files for important releases