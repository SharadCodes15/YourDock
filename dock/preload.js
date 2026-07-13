const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (pinned) => ipcRenderer.send('save-config', pinned),
  saveAutoHide: (autoHide) => ipcRenderer.send('save-auto-hide', autoHide),
  launchApp: (appId) => ipcRenderer.send('launch-app', appId),
  setDockWidth: (width) => ipcRenderer.send('set-dock-width', width),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  onProcessUpdate: (callback) => ipcRenderer.on('process-update', (_event, value) => callback(value)),
  quitApp: () => ipcRenderer.send('quit-app'),
  showInFinder: (appId) => ipcRenderer.send('show-in-finder', appId),
  setDockHover: (hover) => ipcRenderer.send('set-dock-hover', hover),
  onSetCollapseState: (callback) => ipcRenderer.on('set-collapse-state', (_event, value) => callback(value))
});
