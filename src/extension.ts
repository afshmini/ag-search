import * as vscode from 'vscode';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

interface AgResult {
  file: string;
  line: number;
  column: number;
  content: string;
  match: string;
}

class AgSearchProvider {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('AG Search');
  }

  private getAgPath(): string {
    const config = vscode.workspace.getConfiguration('cursor-ag');
    return config.get<string>('agPath', 'ag');
  }

  private getDefaultOptions(): string[] {
    const config = vscode.workspace.getConfiguration('cursor-ag');
    return config.get<string[]>('defaultOptions', ['--smart-case', '--numbers', '--column']);
  }

  private getIgnorePatterns(): string[] {
    const config = vscode.workspace.getConfiguration('cursor-ag');
    return config.get<string[]>('ignorePatterns', ['node_modules', '.git', 'dist', 'build', '.next', '.cache']);
  }

  private isDebugMode(): boolean {
    const config = vscode.workspace.getConfiguration('cursor-ag');
    return config.get<boolean>('debug', false);
  }

  private log(message: string) {
    if (this.isDebugMode()) {
      this.outputChannel.appendLine(message);
    }
  }

  private parseAgOutput(output: string, searchTerm: string): AgResult[] {
    const results: AgResult[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      // AG output format: file:line:column:content
      const match = line.match(/^(.+?):(\d+):(\d+):(.*)$/);
      if (match) {
        const [, file, lineNum, colNum, content] = match;
        const lineNumber = parseInt(lineNum, 10);
        const column = parseInt(colNum, 10);

        // Find the match position in content
        const matchIndex = content.toLowerCase().indexOf(searchTerm.toLowerCase());
        const matchText = matchIndex >= 0 
          ? content.substring(Math.max(0, matchIndex - 20), Math.min(content.length, matchIndex + searchTerm.length + 20))
          : content.substring(0, 50);

        results.push({
          file: file.trim(),
          line: lineNumber,
          column: column,
          content: content.trim(),
          match: matchText
        });
      }
    }

    return results;
  }

  private getMaxResults(): number {
    const config = vscode.workspace.getConfiguration('cursor-ag');
    return config.get<number>('maxResults', 10000);
  }

  private buildAgArgs(searchTerm: string, searchPath?: string): string[] {
    const options = this.getDefaultOptions();
    const ignorePatterns = this.getIgnorePatterns();

    const args: string[] = [];
    
    // Add default options
    args.push(...options);

    // Add ignore patterns (AG supports multiple --ignore flags)
    for (const pattern of ignorePatterns) {
      args.push('--ignore', pattern);
    }

    // Add search term (no escaping needed when using spawn with array)
    args.push(searchTerm);

    if (searchPath) {
      args.push(searchPath);
    }

    return args;
  }

  private buildAgCommandString(searchTerm: string, searchPath?: string): string {
    const agPath = this.getAgPath();
    const args = this.buildAgArgs(searchTerm, searchPath);
    return `${agPath} ${args.map(arg => {
      // Escape for display/logging purposes
      if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
        return `"${arg.replace(/"/g, '\\"')}"`;
      }
      return arg;
    }).join(' ')}`;
  }

  async search(searchTerm: string, searchPath?: string): Promise<AgResult[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      throw new Error('Search term cannot be empty');
    }

    // Check if AG is available
    try {
      await execAsync(`${this.getAgPath()} --version`);
    } catch (error) {
      throw new Error(
        `AG (The Silver Searcher) is not installed or not in PATH. ` +
        `Please install it: https://github.com/ggreer/the_silver_searcher`
      );
    }

    const agPath = this.getAgPath();
    const args = this.buildAgArgs(searchTerm, searchPath);
    const commandString = this.buildAgCommandString(searchTerm, searchPath);
    this.log(`Executing: ${commandString}`);

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const cwd = searchPath 
        ? searchPath 
        : workspaceFolder?.uri.fsPath || process.cwd();

      // Use spawn instead of exec to avoid shell escaping issues
      const result = await new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
        const agProcess = spawn(agPath, args, {
          cwd
        });

        let stdout = '';
        let stderr = '';

        agProcess.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString('utf8');
        });

        agProcess.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString('utf8');
        });

        agProcess.on('error', (error: Error) => {
          reject(error);
        });

        agProcess.on('close', (code: number | null) => {
          resolve({ stdout, stderr, code });
        });
      });

      // AG returns exit code 1 when no matches found, which is not an error
      if (result.code === 1) {
        if (result.stdout) {
          // Some results found despite exit code 1
          let results = this.parseAgOutput(result.stdout, searchTerm);
          this.log(`Found ${results.length} results`);
          
          // Limit results to prevent UI overload
          const maxResults = this.getMaxResults();
          if (results.length > maxResults) {
            this.log(`Limiting results to ${maxResults} (found ${results.length} total). Consider refining your search.`);
            results = results.slice(0, maxResults);
          }
          
          return results;
        } else {
          // No matches found
          return [];
        }
      }

      if (result.stderr && !result.stdout) {
        // AG returns exit code 1 when no matches found, but stderr might have info
        if (result.stderr.includes('No matches found') || result.stderr.trim() === '') {
          return [];
        }
        throw new Error(result.stderr);
      }

      let results = this.parseAgOutput(result.stdout, searchTerm);
      this.log(`Found ${results.length} results`);
      
      // Limit results to prevent UI overload
      const maxResults = this.getMaxResults();
      if (results.length > maxResults) {
        this.log(`Limiting results to ${maxResults} (found ${results.length} total). Consider refining your search.`);
        results = results.slice(0, maxResults);
      }
      
      return results;
    } catch (error: any) {
      // Provide better error messages
      if (error.message) {
        if (error.message.includes('ENOENT') || error.message.includes('spawn')) {
          throw new Error(
            `AG (The Silver Searcher) is not installed or not in PATH. ` +
            `Please install it: https://github.com/ggreer/the_silver_searcher`
          );
        }
        throw new Error(`AG search failed: ${error.message}`);
      }
      
      throw error;
    }
  }

  showOutput() {
    this.outputChannel.show();
  }
}

class AgSearchResultsProvider implements vscode.TreeDataProvider<AgResultItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<AgResultItem | undefined | null | void> = new vscode.EventEmitter<AgResultItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<AgResultItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private results: AgResult[] = [];

  refresh(results: AgResult[]) {
    this.results = results;
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AgResultItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AgResultItem): Thenable<AgResultItem[]> {
    if (!element) {
      // Group results by file
      const fileGroups = new Map<string, AgResult[]>();
      for (const result of this.results) {
        const fileName = path.basename(result.file);
        if (!fileGroups.has(result.file)) {
          fileGroups.set(result.file, []);
        }
        fileGroups.get(result.file)!.push(result);
      }

      return Promise.resolve(
        Array.from(fileGroups.entries()).map(([file, results]) => {
          const item = new AgResultItem(
            path.basename(file),
            vscode.TreeItemCollapsibleState.Expanded,
            file,
            results.length
          );
          item.resourceUri = vscode.Uri.file(file);
          item.contextValue = 'file';
          return item;
        })
      );
    } else {
      // Return results for this file
      const fileResults = this.results.filter(r => r.file === element.filePath);
      return Promise.resolve(
        fileResults.map(result => {
          const item = new AgResultItem(
            `${result.line}:${result.column} - ${result.match}`,
            vscode.TreeItemCollapsibleState.None,
            result.file,
            0,
            result.line,
            result.column
          );
          item.command = {
            command: 'cursor-ag.openResult',
            title: 'Open Result',
            arguments: [result]
          };
          item.contextValue = 'result';
          return item;
        })
      );
    }
  }
}

class AgResultItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly filePath: string,
    public readonly resultCount: number = 0,
    public readonly line?: number,
    public readonly column?: number
  ) {
    super(label, collapsibleState);
    this.tooltip = filePath;
    if (resultCount > 0) {
      this.description = `${resultCount} result${resultCount > 1 ? 's' : ''}`;
    }
  }
}

let searchProvider: AgSearchProvider;
let resultsProvider: AgSearchResultsProvider;
let resultsTreeView: vscode.TreeView<AgResultItem>;
let currentSearchQuickPick: vscode.QuickPick<vscode.QuickPickItem> | undefined;
let searchTimeout: NodeJS.Timeout | undefined;

/**
 * Resolves a file path (absolute or relative) to a vscode.Uri
 */
function resolveFileUri(filePath: string, searchPath?: string): vscode.Uri {
  // If absolute path, use it directly
  if (path.isAbsolute(filePath)) {
    return vscode.Uri.file(filePath);
  }

  // For relative paths, resolve against workspace or search path
  if (searchPath && path.isAbsolute(searchPath)) {
    return vscode.Uri.file(path.resolve(searchPath, filePath));
  }

  // Resolve against workspace folder
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    return vscode.Uri.joinPath(workspaceFolder.uri, filePath);
  }

  // Fallback to current working directory
  return vscode.Uri.file(path.resolve(filePath));
}

/**
 * Opens a file and navigates to the specified line and column
 */
async function openFileAtLocation(result: AgResult, searchPath?: string) {
  try {
    const fileUri = resolveFileUri(result.file, searchPath);
    const document = await vscode.workspace.openTextDocument(fileUri);
    const editor = await vscode.window.showTextDocument(document, {
      preview: false,
      selection: new vscode.Range(
        new vscode.Position(result.line - 1, Math.max(0, result.column - 1)),
        new vscode.Position(result.line - 1, Math.max(0, result.column - 1))
      )
    });
    const position = new vscode.Position(result.line - 1, Math.max(0, result.column - 1));
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    vscode.window.showErrorMessage(`Failed to open file: ${result.file}\n${errorMessage}`);
  }
}

export function activate(context: vscode.ExtensionContext) {
  searchProvider = new AgSearchProvider();
  resultsProvider = new AgSearchResultsProvider();

  resultsTreeView = vscode.window.createTreeView('agSearchResults', {
    treeDataProvider: resultsProvider,
    showCollapseAll: true
  });

  // Register search command
  const searchCommand = vscode.commands.registerCommand('cursor-ag.search', async () => {
    await showRealtimeSearch();
  });

  // Register search in folder command
  const searchInFolderCommand = vscode.commands.registerCommand('cursor-ag.searchInFolder', async () => {
    const folderUri = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Search in this folder'
    });

    if (!folderUri || folderUri.length === 0) {
      return;
    }

    await showRealtimeSearchInFolder(folderUri[0].fsPath);
  });

  // Register open result command
  const openResultCommand = vscode.commands.registerCommand('cursor-ag.openResult', async (result: AgResult) => {
    await openFileAtLocation(result);
  });

  context.subscriptions.push(searchCommand, searchInFolderCommand, openResultCommand, resultsTreeView);
}

async function performSearch(searchTerm: string, searchPath?: string, showProgress = true): Promise<AgResult[]> {
  try {
    const searchPromise = searchProvider.search(searchTerm, searchPath);
    
    if (showProgress) {
      return await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Searching for "${searchTerm}"...`,
          cancellable: false
        },
        async () => {
          const results = await searchPromise;
          resultsProvider.refresh(results);
          return results;
        }
      );
    } else {
      const results = await searchPromise;
      resultsProvider.refresh(results);
      return results;
    }
  } catch (error: any) {
    const errorMessage = error.message || 'An error occurred during search';
    vscode.window.showErrorMessage(`AG Search Error: ${errorMessage}`);
    searchProvider.showOutput();
    return [];
  }
}

async function showRealtimeSearch() {
  // Close existing search if open
  if (currentSearchQuickPick) {
    currentSearchQuickPick.dispose();
  }

  const quickPick = vscode.window.createQuickPick();
  currentSearchQuickPick = quickPick;
  
  quickPick.placeholder = 'Type to search in project (results update as you type)';
  quickPick.items = [];
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;
  quickPick.canSelectMany = false;

  let currentResults: AgResult[] = [];
  let isSearching = false;

  // Debounced search function
  const performDebouncedSearch = (searchTerm: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (!searchTerm || searchTerm.trim().length < 2) {
      quickPick.items = [];
      currentResults = [];
      resultsProvider.refresh([]);
      quickPick.busy = false;
      return;
    }

    quickPick.busy = true;
    isSearching = true;

    searchTimeout = setTimeout(async () => {
      try {
        const results = await performSearch(searchTerm, undefined, false);
        currentResults = results;

        // Update QuickPick items
        const items: vscode.QuickPickItem[] = [];
        
        if (results.length === 0) {
          items.push({
            label: '$(search) No results found',
            description: `No matches for "${searchTerm}"`,
            alwaysShow: true
          });
        } else {
          // Group by file and show top results
          const fileGroups = new Map<string, AgResult[]>();
          for (const result of results.slice(0, 100)) { // Limit to 100 results in QuickPick
            if (!fileGroups.has(result.file)) {
              fileGroups.set(result.file, []);
            }
            fileGroups.get(result.file)!.push(result);
          }

          for (const [file, fileResults] of fileGroups.entries()) {
            const fileName = path.basename(file);
            const filePath = file;
            const resultCount = fileResults.length;
            
            items.push({
              label: `$(file-code) ${fileName}`,
              description: `${resultCount} match${resultCount > 1 ? 'es' : ''}`,
              detail: filePath,
              alwaysShow: true
            });

            // Add first few results from this file
            for (const result of fileResults.slice(0, 3)) {
              items.push({
                label: `  ${result.line}:${result.column}`,
                description: result.match.substring(0, 60) + (result.match.length > 60 ? '...' : ''),
                detail: `${filePath}|${result.line}|${result.column}`,
                alwaysShow: false
              });
            }

            if (fileResults.length > 3) {
              items.push({
                label: `  ... and ${fileResults.length - 3} more in this file`,
                description: '',
                detail: filePath,
                alwaysShow: false
              });
            }
          }

          if (results.length > 100) {
            items.push({
              label: `$(info) Showing first 100 of ${results.length} results`,
              description: 'View all results in the sidebar',
              alwaysShow: true
            });
          }
        }

        quickPick.items = items;
        quickPick.busy = false;
        isSearching = false;
      } catch (error) {
        quickPick.items = [{
          label: '$(error) Search error',
          description: 'Check the output panel for details',
          alwaysShow: true
        }];
        quickPick.busy = false;
        isSearching = false;
      }
    }, 300); // 300ms debounce
  };

  // Handle input changes
  quickPick.onDidChangeValue((value) => {
    performDebouncedSearch(value);
  });

  // Handle item selection
  quickPick.onDidAccept(async () => {
    const selected = quickPick.selectedItems[0];
    if (!selected || !selected.detail) {
      quickPick.dispose();
      currentSearchQuickPick = undefined;
      return;
    }

    // Close QuickPick immediately
    quickPick.dispose();
    currentSearchQuickPick = undefined;

    // Parse detail: either filePath or "filePath|line|column"
    const detailParts = selected.detail.split('|');
    const filePath = detailParts[0];
    
    if (!filePath) {
      return;
    }
    
    let result: AgResult | undefined;
    
    if (detailParts.length === 3) {
      // Specific result selected (line and column provided)
      const line = parseInt(detailParts[1], 10);
      const column = parseInt(detailParts[2], 10);
      if (!isNaN(line) && !isNaN(column)) {
        result = currentResults.find(r => r.file === filePath && r.line === line && r.column === column);
      }
    }
    
    // If no specific result found, use first result from that file
    if (!result) {
      const fileResults = currentResults.filter(r => r.file === filePath);
      result = fileResults[0];
    }

    if (result) {
      await openFileAtLocation(result);
    }
  });

  // Handle cancellation
  quickPick.onDidHide(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    quickPick.dispose();
    currentSearchQuickPick = undefined;
  });

  quickPick.show();
}

async function showRealtimeSearchInFolder(searchPath: string) {
  // Close existing search if open
  if (currentSearchQuickPick) {
    currentSearchQuickPick.dispose();
  }

  const quickPick = vscode.window.createQuickPick();
  currentSearchQuickPick = quickPick;
  
  const folderName = path.basename(searchPath);
  quickPick.placeholder = `Type to search in "${folderName}" (results update as you type)`;
  quickPick.items = [];
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = true;
  quickPick.canSelectMany = false;

  let currentResults: AgResult[] = [];
  let isSearching = false;

  // Debounced search function
  const performDebouncedSearch = (searchTerm: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (!searchTerm || searchTerm.trim().length < 2) {
      quickPick.items = [];
      currentResults = [];
      resultsProvider.refresh([]);
      quickPick.busy = false;
      return;
    }

    quickPick.busy = true;
    isSearching = true;

    searchTimeout = setTimeout(async () => {
      try {
        const results = await performSearch(searchTerm, searchPath, false);
        currentResults = results;

        // Update QuickPick items (same logic as showRealtimeSearch)
        const items: vscode.QuickPickItem[] = [];
        
        if (results.length === 0) {
          items.push({
            label: '$(search) No results found',
            description: `No matches for "${searchTerm}"`,
            alwaysShow: true
          });
        } else {
          // Group by file and show top results
          const fileGroups = new Map<string, AgResult[]>();
          for (const result of results.slice(0, 100)) {
            if (!fileGroups.has(result.file)) {
              fileGroups.set(result.file, []);
            }
            fileGroups.get(result.file)!.push(result);
          }

          for (const [file, fileResults] of fileGroups.entries()) {
            const fileName = path.basename(file);
            const filePath = file;
            const resultCount = fileResults.length;
            
            items.push({
              label: `$(file-code) ${fileName}`,
              description: `${resultCount} match${resultCount > 1 ? 'es' : ''}`,
              detail: filePath,
              alwaysShow: true
            });

            // Add first few results from this file
            for (const result of fileResults.slice(0, 3)) {
              items.push({
                label: `  ${result.line}:${result.column}`,
                description: result.match.substring(0, 60) + (result.match.length > 60 ? '...' : ''),
                detail: `${filePath}|${result.line}|${result.column}`,
                alwaysShow: false
              });
            }

            if (fileResults.length > 3) {
              items.push({
                label: `  ... and ${fileResults.length - 3} more in this file`,
                description: '',
                detail: filePath,
                alwaysShow: false
              });
            }
          }

          if (results.length > 100) {
            items.push({
              label: `$(info) Showing first 100 of ${results.length} results`,
              description: 'View all results in the sidebar',
              alwaysShow: true
            });
          }
        }

        quickPick.items = items;
        quickPick.busy = false;
        isSearching = false;
      } catch (error) {
        quickPick.items = [{
          label: '$(error) Search error',
          description: 'Check the output panel for details',
          alwaysShow: true
        }];
        quickPick.busy = false;
        isSearching = false;
      }
    }, 300); // 300ms debounce
  };

  // Handle input changes
  quickPick.onDidChangeValue((value) => {
    performDebouncedSearch(value);
  });

  // Handle item selection
  quickPick.onDidAccept(async () => {
    const selected = quickPick.selectedItems[0];
    if (!selected || !selected.detail) {
      quickPick.dispose();
      currentSearchQuickPick = undefined;
      return;
    }

    // Close QuickPick immediately
    quickPick.dispose();
    currentSearchQuickPick = undefined;

    // Parse detail: either filePath or "filePath|line|column"
    const detailParts = selected.detail.split('|');
    const filePath = detailParts[0];
    
    if (!filePath) {
      return;
    }
    
    let result: AgResult | undefined;
    
    if (detailParts.length === 3) {
      // Specific result selected (line and column provided)
      const line = parseInt(detailParts[1], 10);
      const column = parseInt(detailParts[2], 10);
      if (!isNaN(line) && !isNaN(column)) {
        result = currentResults.find(r => r.file === filePath && r.line === line && r.column === column);
      }
    }
    
    // If no specific result found, use first result from that file
    if (!result) {
      const fileResults = currentResults.filter(r => r.file === filePath);
      result = fileResults[0];
    }

    if (result) {
      await openFileAtLocation(result, searchPath);
    }
  });

  // Handle cancellation
  quickPick.onDidHide(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    quickPick.dispose();
    currentSearchQuickPick = undefined;
  });

  quickPick.show();
}

export function deactivate() {}

