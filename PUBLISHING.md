# Publishing Guide for VS Code/Cursor Marketplace

## Prerequisites

1. **Create a Publisher Account**
   - Visit: https://marketplace.visualstudio.com/manage
   - Sign in with Microsoft/Azure account
   - Click "Create Publisher"
   - Choose a unique publisher ID (this will be your `publisher` in package.json)

2. **Get Personal Access Token**
   - Go to: https://dev.azure.com
   - Click on your profile → Personal Access Tokens
   - Create new token with:
     - **Organization**: All accessible organizations
     - **Scopes**: Marketplace (Manage)
   - Copy the token (you'll need it for publishing)

## Publishing Steps

### 1. Install vsce (Visual Studio Code Extensions CLI)

```bash
npm install -g @vscode/vsce
```

### 2. Update package.json

Make sure your `package.json` has:
- `publisher`: Your publisher ID from step 1 (already set to "afshmini")
- `name`: Extension ID (already set to "ag-search")
- `version`: Current version (e.g., "0.1.0")
- `license`: License type (already set to "MIT")
- `repository`: Repository URL (already set to "https://github.com/afshmini/ag-search")

### 3. Compile the Extension

```bash
npm run compile
```

### 4. Package the Extension (Optional - for testing)

```bash
vsce package
```

This creates a `.vsix` file you can test locally:
- In VS Code/Cursor: `Extensions` → `...` → `Install from VSIX...`

### 5. Publish to Marketplace

**First time publishing:**
```bash
vsce publish
```

You'll be prompted for:
- Personal Access Token (from step 2)

**Subsequent updates:**
```bash
# Update version in package.json first, then:
vsce publish
```

### 6. Verify Publication

- Visit: https://marketplace.visualstudio.com/vscode
- Search for your extension by name
- It should appear within a few minutes

## Publishing Options

### Publish a Minor/Patch Update

1. Update `version` in `package.json` (e.g., "0.1.0" → "0.1.1")
2. Run `vsce publish`

### Publish a Major Update

1. Update `version` in `package.json` (e.g., "0.1.0" → "1.0.0")
2. Run `vsce publish`

### Unpublish an Extension

- Go to: https://marketplace.visualstudio.com/manage
- Find your extension
- Click "..." → "Unpublish"

## Important Notes

- **Version numbers**: Must follow semantic versioning (major.minor.patch)
- **Publisher ID**: Cannot be changed after first publication
- **Extension ID**: Format is `publisher.extension-name` (e.g., `afshmini.ag-search`)
- **Personal Access Token**: Keep it secure, don't commit it to git
- **Testing**: Always test with `vsce package` before publishing

## Troubleshooting

### "Extension name already exists"
- The extension name must be unique across the marketplace
- Try a different name in package.json

### "Invalid publisher"
- Make sure the publisher ID in package.json matches your marketplace publisher ID
- Check at: https://marketplace.visualstudio.com/manage

### "Personal Access Token expired"
- Create a new token at https://dev.azure.com
- Use the new token when prompted

## Additional Resources

- [VS Code Extension Publishing Guide](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [vsce Documentation](https://github.com/microsoft/vscode-vsce)
- [Marketplace Management Portal](https://marketplace.visualstudio.com/manage)

