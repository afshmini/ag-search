# AG Global Search

A VS Code and Cursor IDE extension that uses [AG (The Silver Searcher)](https://github.com/ggreer/the_silver_searcher) for fast, powerful global search across your project.

**Works with:** VS Code 1.75+ and Cursor IDE

[![GitHub](https://img.shields.io/badge/GitHub-afshmini%2Fag--search-blue)](https://github.com/afshmini/ag-search)

## Features

- ⚡ **Fast Search**: Uses AG (The Silver Searcher) for lightning-fast code searching
- 🔍 **Global Search**: Search across your entire project, not just open files
- 📁 **Folder Search**: Option to search within a specific folder
- 📊 **Results View**: View search results in an organized tree view
- 🎯 **Quick Navigation**: Click results to jump directly to matches
- ⚙️ **Configurable**: Customize AG options and ignore patterns

## Prerequisites

You need to have AG (The Silver Searcher) installed on your system:

### Linux
```bash
# Ubuntu/Debian
sudo apt-get install silversearcher-ag

# Fedora
sudo dnf install the_silver_searcher

# Arch Linux
sudo pacman -S the_silver_searcher
```

### macOS
```bash
brew install the_silver_searcher
```

### Windows
Download from [AG releases](https://github.com/ggreer/the_silver_searcher/releases) or use:
```bash
choco install ag
```

Verify installation:
```bash
ag --version
```

## Installation

### For Development

1. Clone the repository:
   ```bash
   git clone https://github.com/afshmini/ag-search.git
   cd ag-search
   ```
2. Open the project in VS Code or Cursor
3. Install dependencies:
   ```bash
   npm install
   ```
4. Compile the extension:
   ```bash
   npm run compile
   ```
5. Press `F5` to open a new window with the extension loaded

### For Use in VS Code/Cursor

1. Package the extension:
   ```bash
   npm install -g vsce
   vsce package
   ```
2. Install the `.vsix` file:
   - In VS Code/Cursor: `Extensions` → `...` → `Install from VSIX...`
   - Or use command line: `code --install-extension ag-search-0.1.0.vsix`

## Usage

### Search in Project

1. Press `Ctrl+Shift+F` (or `Cmd+Shift+F` on macOS) to open the search dialog
2. Enter your search term
3. Results will appear in the "AG Search Results" view in the Explorer sidebar
4. Click on any result to navigate to that location

### Search in Folder

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "AG: Search in Folder"
3. Enter your search term
4. Select the folder to search in
5. Results will appear in the "AG Search Results" view

### Viewing Results

- Results are grouped by file
- Each file shows the number of matches
- Expand files to see individual matches with line numbers and context
- Click any result to jump to that location in the editor

## Configuration

You can configure the extension in Cursor settings:

- **cursor-ag.agPath**: Path to the AG executable (default: `"ag"`)
- **cursor-ag.defaultOptions**: Default AG options (default: `["--smart-case", "--numbers", "--column"]`)
- **cursor-ag.ignorePatterns**: Patterns to ignore in searches (default: `["node_modules", ".git", "dist", "build", ".next", ".cache"]`)

### Example Settings

```json
{
  "cursor-ag.agPath": "/usr/local/bin/ag",
  "cursor-ag.defaultOptions": [
    "--smart-case",
    "--numbers",
    "--column",
    "--hidden"
  ],
  "cursor-ag.ignorePatterns": [
    "node_modules",
    ".git",
    "dist",
    "build",
    "*.min.js"
  ]
}
```

## Development

### Building

```bash
npm install
npm run compile
```

### Watching for Changes

```bash
npm run watch
```

### Testing

1. Open the project in VS Code or Cursor
2. Press `F5` to launch a new Extension Development Host window
3. Test the extension in the new window

## Keyboard Shortcuts

- `Ctrl+Shift+F` (Windows/Linux) or `Cmd+Shift+F` (macOS): Search in project

## Troubleshooting

### AG not found

If you get an error that AG is not found:
1. Verify AG is installed: `ag --version`
2. Check if AG is in your PATH
3. Set the full path in settings: `cursor-ag.agPath`

### No results found

- Check that your search term is correct
- Verify that files aren't being ignored by your ignore patterns
- Try searching with a simpler term first

### Extension not working

- Check the Output panel for "AG Search" channel
- Verify AG is installed and accessible
- Check Cursor's Developer Tools console for errors

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Repository

- **GitHub**: [https://github.com/afshmini/ag-search](https://github.com/afshmini/ag-search)
- **Issues**: [https://github.com/afshmini/ag-search/issues](https://github.com/afshmini/ag-search/issues)

## Author

**afshmini**
- Email: afshmini@gmail.com
- GitHub: [@afshmini](https://github.com/afshmini)


