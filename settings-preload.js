const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
  registerShortcut: (type, shortcut) => ipcRenderer.invoke('register-shortcut', { type, shortcut }),
  restoreDefaults: () => ipcRenderer.invoke('restore-defaults'),
  onSettingsChanged: (callback) => ipcRenderer.on('settings-changed', (_event, settings) => callback(settings))
});
