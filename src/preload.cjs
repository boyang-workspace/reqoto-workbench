const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('workspace', {
  call: (action, payload) => ipcRenderer.invoke('workspace', action, payload),
  onState: callback => ipcRenderer.on('state', (_event, state) => callback(state))
});
