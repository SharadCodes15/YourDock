const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('drawerAPI', {
  getApps: () => ipcRenderer.invoke('get-apps'),
  launchApp: (appId) => ipcRenderer.send('launch-app', appId),
  hideDrawer: () => ipcRenderer.send('hide-drawer'),
  selectCustomApp: () => ipcRenderer.invoke('select-custom-app'),
  refreshApps: () => ipcRenderer.invoke('refresh-apps'),
  saveFavorites: (favs) => ipcRenderer.invoke('save-favorites', favs),
  onOpenDrawer: (callback) => ipcRenderer.on('open-drawer', (_event, screenshotUrl) => callback(screenshotUrl)),
  onCloseDrawer: (callback) => ipcRenderer.on('close-drawer', () => callback()),
  onAppsUpdated: (callback) => ipcRenderer.on('apps-updated', () => callback()),
  getDockConfig: () => ipcRenderer.invoke('get-config'),
  addToDock: (appId, appInfo) => ipcRenderer.send('add-to-dock', appId, appInfo),
  removeFromDock: (appId) => ipcRenderer.send('remove-from-dock', appId),
  pressEscape: () => ipcRenderer.send('escape-pressed'),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (_event, data) => callback(data)),
  getThemeConfig: () => ipcRenderer.invoke('get-theme-config'),
  saveFolders: (folders) => ipcRenderer.invoke('save-folders', folders),
  getFolders: () => ipcRenderer.invoke('get-folders')
});

