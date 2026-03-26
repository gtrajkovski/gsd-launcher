const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getStatus: () => ipcRenderer.invoke('get-status'),
  installGsd: () => ipcRenderer.invoke('install-gsd'),
  updateGsd: () => ipcRenderer.invoke('update-gsd'),
  launchTerminal: (path) => ipcRenderer.invoke('launch-terminal', path),
  launchVSCode: (path) => ipcRenderer.invoke('launch-vscode', path),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
});
