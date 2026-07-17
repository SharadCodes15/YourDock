const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('toastAPI', {
  onToastData: (callback) => ipcRenderer.on('toast-data', (_event, data) => callback(data)),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  closeToast: () => ipcRenderer.send('close-toast')
});
