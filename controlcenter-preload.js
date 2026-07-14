const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ccAPI', {
  getVolume: () => ipcRenderer.invoke('get-volume'),
  setVolume: (val) => ipcRenderer.send('set-volume', val),
  getBrightness: () => ipcRenderer.invoke('get-brightness'),
  setBrightness: (val) => ipcRenderer.send('set-brightness', val),
  toggleWifi: (on) => ipcRenderer.invoke('toggle-wifi', on),
  toggleBluetooth: (on) => ipcRenderer.invoke('toggle-bluetooth', on),
  getDND: () => ipcRenderer.invoke('get-dnd'),
  setDND: (on) => ipcRenderer.send('set-dnd', on),
  onSystemDataUpdate: (callback) => ipcRenderer.on('system-data-update', (_event, data) => callback(data)),
  closeCcWindow: () => ipcRenderer.send('close-cc-window')
});
