const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStatus: () => ipcRenderer.invoke('get-status'),
  installNode: () => ipcRenderer.invoke('install-node'),
  installClaude: () => ipcRenderer.invoke('install-claude'),
  installGsd: () => ipcRenderer.invoke('install-gsd'),
  updateGsd: () => ipcRenderer.invoke('update-gsd'),
  launchTerminal: (path) => ipcRenderer.invoke('launch-terminal', path),
  launchVSCode: (path) => ipcRenderer.invoke('launch-vscode', path),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  addScanDir: () => ipcRenderer.invoke('add-scan-dir'),
  removeScanDir: (dir) => ipcRenderer.invoke('remove-scan-dir', dir),
  getScanDirs: () => ipcRenderer.invoke('get-scan-dirs'),
});
