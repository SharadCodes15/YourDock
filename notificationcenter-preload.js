const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notificationAPI', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.send('save-settings', settings),
  closeNotificationCenter: () => ipcRenderer.send('close-notification-center'),
  pressEscape: () => ipcRenderer.send('escape-pressed'),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (_event, data) => callback(data)),
  getThemeConfig: () => ipcRenderer.invoke('get-theme-config'),
  onSettingsChanged: (callback) => ipcRenderer.on('settings-changed', (_event, settings) => callback(settings)),
  fetchWeather: (location) => ipcRenderer.invoke('fetch-weather', location),
  getWeatherCache: () => ipcRenderer.invoke('get-weather-cache')
});
