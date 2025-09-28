# VS Code marketplace publishing setup

This repository is configured to automatically publish to the VS Code Marketplace when a new release tag is created. Follow these steps to set up the required credentials.

## Prerequisites

1. **VS Code Marketplace publisher account**: You need a publisher account on the [VS Code Marketplace](https://marketplace.visualstudio.com/manage).
2. **Azure DevOps organization**: You'll need an Azure DevOps organization to create a Personal Access Token.

## Setup steps

### 1. Create a publisher account

1. Go to the [VS Code Marketplace publisher management page](https://marketplace.visualstudio.com/manage)
2. Sign in with your Microsoft account
3. Create a new publisher or use an existing one
4. Note your publisher ID (it should match the `publisher` field in `package.json`)

### 2. Create a personal access token (PAT)

1. Go to [Azure DevOps](https://dev.azure.com)
2. Sign in with the same Microsoft account
3. Click on your profile picture → "Personal access tokens"
4. Click "New Token"
5. Configure the token:
   - **Name**: `VS Code Extension Publishing`
   - **Organization**: Select "All accessible organizations"
   - **Expiration**: Choose an appropriate duration (recommended: 1 year)
   - **Scopes**: Select "Custom defined" and check:
     - **Marketplace** → **Manage** (this gives both read and publish permissions)

6. Click "Create" and **copy the token immediately** (you won't be able to see it again)

### 3. Add the token to GitHub secrets

1. Go to your GitHub repository
2. Click on "Settings" → "Secrets and variables" → "Actions"
3. Click "New repository secret"
4. Add the following secret:
   - **Name**: `VSCE_PAT`
   - **Value**: The Personal Access Token you created in step 2

### 4. Verify publisher configuration

Ensure your `package.json` has the correct publisher name:

```json
{
  "publisher": "elastic"
}
```

This should match your VS Code Marketplace publisher ID.

## How the publishing works

The GitHub Action workflow (`.github/workflows/release.yml`) will:

1. Trigger when you push a tag starting with `v` (e.g., `v1.0.0`)
2. Build and compile the extension
3. Package the extension using `vsce package`
4. Publish to the VS Code Marketplace using `vsce publish`
5. Create a GitHub release with the packaged `.vsix` file

## Creating a release

To publish a new version:

1. Update the version in `package.json`
2. Commit your changes
3. Create and push a git tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

The GitHub Action will automatically handle the rest!

## Troubleshooting

- **Authentication errors**: Verify the `VSCE_PAT` secret is correctly set and hasn't expired
- **Publisher mismatch**: Ensure the `publisher` field in `package.json` matches your marketplace publisher ID
- **Permission errors**: Make sure your PAT has "Marketplace Manage" permissions

## Additional resources

- [VS Code Extension Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce CLI Documentation](https://github.com/microsoft/vscode-vsce)
- [Azure DevOps PAT Documentation](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate)