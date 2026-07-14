const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onActiveAppChanged: (callback) => ipcRenderer.on('active-app-changed', (_event, value) => callback(value)),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  setWindowHeight: (height) => ipcRenderer.send('set-window-height', height),
  onSetCollapseState: (callback) => ipcRenderer.on('set-collapse-state', (_event, value) => callback(value)),
  openSettings: () => ipcRenderer.send('open-settings'),
  onSettingsChanged: (callback) => ipcRenderer.on('settings-changed', (_event, settings) => callback(settings)),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  toggleControlCenter: (rect) => ipcRenderer.send('toggle-control-center', rect),
  onSystemDataUpdate: (callback) => ipcRenderer.on('system-data-update', (_event, data) => callback(data)),
  spotlightSearch: (query) => ipcRenderer.invoke('spotlight-search', query),
  launchApp: (appId) => ipcRenderer.send('launch-app', appId),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  getVolume: () => ipcRenderer.invoke('get-volume'),
  setVolume: (val) => ipcRenderer.send('set-volume', val),
  onVolumeSync: (callback) => ipcRenderer.on('volume-sync', (_event, val) => callback(val)),
  toggleWifi: (on) => ipcRenderer.invoke('toggle-wifi', on),
  toggleBluetooth: (on) => ipcRenderer.invoke('toggle-bluetooth', on)
});
