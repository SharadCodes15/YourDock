const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onActiveAppChanged: (callback) => ipcRenderer.on('active-app-changed', (_event, value) => callback(value)),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  setWindowHeight: (height) => ipcRenderer.send('set-window-height', height),
  onSetCollapseState: (callback) => ipcRenderer.on('set-collapse-state', (_event, value) => callback(value)),
  openSettings: () => ipcRenderer.send('open-settings'),
  onSettingsChanged: (callback) => ipcRenderer.on('settings-changed', (_event, settings) => callback(settings)),
  getSettings: () => ipcRenderer.invoke('get-settings')
});
