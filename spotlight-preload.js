const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  spotlightSearch: (query) => ipcRenderer.invoke('spotlight-search', query),
  launchApp: (appId) => ipcRenderer.send('launch-app', appId),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  closeSpotlight: () => ipcRenderer.send('close-spotlight'),
  onFocusInput: (callback) => ipcRenderer.on('focus-input', () => callback()),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  onSettingsChanged: (callback) => ipcRenderer.on('settings-changed', (_event, settings) => callback(settings)),
  pressEscape: () => ipcRenderer.send('escape-pressed'),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (_event, data) => callback(data)),
  getThemeConfig: () => ipcRenderer.invoke('get-theme-config')
});

