const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('drawerAPI', {
  getApps: () => ipcRenderer.invoke('get-apps'),
  launchApp: (appId) => ipcRenderer.send('launch-app', appId),
  hideDrawer: () => ipcRenderer.send('hide-drawer'),
  onOpenDrawer: (callback) => ipcRenderer.on('open-drawer', (_event, screenshotUrl) => callback(screenshotUrl)),
  onCloseDrawer: (callback) => ipcRenderer.on('close-drawer', () => callback())
});
