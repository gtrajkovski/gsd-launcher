const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStatus: () => ipcRenderer.invoke('get-status'),
  installGsd: () => ipcRenderer.invoke('install-gsd'),
  updateGsd: () => ipcRenderer.invoke('update-gsd'),
  launchTerminal: (path) => ipcRenderer.invoke('launch-terminal', path),
  launchVSCode: (path) => ipcRenderer.invoke('launch-vscode', path),
  launchClaude: (repoPath) => ipcRenderer.invoke('launch-claude', repoPath),
  openProject: (projectPath) => ipcRenderer.invoke('open-project', projectPath),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getRecentProjects: () => ipcRenderer.invoke('get-recent-projects')
});
