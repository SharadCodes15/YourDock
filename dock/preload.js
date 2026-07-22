const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (pinned) => ipcRenderer.send('save-config', pinned),
  saveAutoHide: (autoHide) => ipcRenderer.send('save-auto-hide', autoHide),
  launchApp: (appId) => ipcRenderer.send('launch-app', appId),
  setDockWidth: (width) => ipcRenderer.send('set-dock-width', width),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  onProcessUpdate: (callback) => ipcRenderer.on('process-update', (_event, value) => callback(value)),
  quitApp: (appId) => ipcRenderer.send('quit-app', appId),
  showInFinder: (appId) => ipcRenderer.send('show-in-finder', appId),
  setDockHover: (hover) => ipcRenderer.send('set-dock-hover', hover),
  onSetCollapseState: (callback) => ipcRenderer.on('set-collapse-state', (_event, value) => callback(value)),
  toggleDrawer: () => ipcRenderer.send('toggle-drawer'),
  removeFromDock: (appId) => ipcRenderer.send('remove-from-dock', appId),
  keepInDock: (appId) => ipcRenderer.send('keep-in-dock', appId),
  setBadge: (appId, count) => ipcRenderer.send('set-badge', appId, count),
  onConfigChanged: (callback) => ipcRenderer.on('config-changed', (_event, data) => callback(data)),
  onSettingsChanged: (callback) => ipcRenderer.on('settings-changed', (_event, data) => callback(data)),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  onPlayGenie: (callback) => ipcRenderer.on('play-genie', (_event, appId) => callback(appId)),
  setDockHeight: (height) => ipcRenderer.send('set-dock-height', height),
  pressEscape: () => ipcRenderer.send('escape-pressed'),
  onThemeChanged: (callback) => ipcRenderer.on('theme-changed', (_event, data) => callback(data)),
  getThemeConfig: () => ipcRenderer.invoke('get-theme-config'),
  getOpenWindows: (appId) => ipcRenderer.invoke('get-open-windows', appId),
  focusWindow: (pid) => ipcRenderer.send('focus-window', pid),
  contextMenuState: (isOpen) => ipcRenderer.send('context-menu-state', isOpen),
  onCloseContextMenu: (callback) => ipcRenderer.on('close-context-menu', () => callback())
});

