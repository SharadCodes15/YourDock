const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('settingsAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
  registerShortcut: (type, shortcut) => ipcRenderer.invoke('register-shortcut', { type, shortcut }),
  restoreDefaults: () => ipcRenderer.invoke('restore-defaults'),
  onSettingsChanged: (callback) => ipcRenderer.on('settings-changed', (_event, settings) => callback(settings)),
  getApps: () => ipcRenderer.invoke('get-apps'),
  overrideAppIcon: (appId, exePath) => ipcRenderer.invoke('override-app-icon', { appId, exePath }),
  resetAppIcon: (appId, exePath) => ipcRenderer.invoke('reset-app-icon', { appId, exePath }),
  onAppsUpdated: (callback) => ipcRenderer.on('apps-updated', () => callback()),
  getDockConfig: () => ipcRenderer.invoke('get-config'),
  saveAutoHide: (autoHide) => ipcRenderer.send('save-auto-hide', autoHide),
  exportSettings: () => ipcRenderer.invoke('export-settings'),
  importSettings: () => ipcRenderer.invoke('import-settings'),
  pressEscape: () => ipcRenderer.send('escape-pressed'),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (_event, data) => callback(data)),
  getThemeConfig: () => ipcRenderer.invoke('get-theme-config'),
  getDisplays: () => ipcRenderer.invoke('get-displays'),
  getRamUsage: () => ipcRenderer.invoke('get-ram-usage'),
  clearIconCache: () => ipcRenderer.invoke('clear-icon-cache'),
  refreshApp: () => ipcRenderer.send('refresh-app')
});

