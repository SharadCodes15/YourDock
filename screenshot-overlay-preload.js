const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayAPI', {
  sendSelection: (rect) => ipcRenderer.send('overlay-selection', rect),
  sendCancel: () => ipcRenderer.send('overlay-cancel'),
  pressEscape: () => ipcRenderer.send('overlay-cancel')
});
