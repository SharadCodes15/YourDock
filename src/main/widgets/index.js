const { ipcMain, globalShortcut, dialog, shell } = require('electron');
const path = require('node:path');
const { WidgetsStore } = require('./widgetsStore');
const WidgetRegistry = require('./widgetRegistry');
const { updateHostWindowLifecycle, getHostWindow, destroyHostWindow } = require('./widgetHostWindow');
const { toggleAccessPanel, closeAccessPanel, isAccessPanelOpen } = require('./widgetAccessPanel');
const weatherModule = require('../../../weather');

let storeInstance = null;
let registryInstance = null;
let isInitialized = false;

function initWidgetsSubsystem() {
  if (isInitialized) return;
  isInitialized = true;

  storeInstance = new WidgetsStore();
  registryInstance = new WidgetRegistry();

  // Sync registry from initial store state
  const initialWidgets = storeInstance.getWidgets();
  registryInstance.syncFromWidgetList(initialWidgets);

  // Setup host window lifecycle callback
  const onStateChange = () => {
    const currentWidgets = storeInstance.getWidgets();
    registryInstance.syncFromWidgetList(currentWidgets);
    const hostWin = getHostWindow();
    if (hostWin && !hostWin.isDestroyed()) {
      hostWin.webContents.send('widgets-updated', {
        widgets: currentWidgets,
        editMode: storeInstance.getEditMode()
      });
    }
  };

  // Create host window ONLY if widgets already exist on startup
  if (initialWidgets.length > 0) {
    updateHostWindowLifecycle(storeInstance, registryInstance, onStateChange);
  }

  // Register Global Hotkey (Default Ctrl+Shift+W)
  try {
    globalShortcut.register('CommandOrControl+Shift+W', () => {
      toggleAccessPanel(storeInstance, (editMode) => {
        onStateChange();
      });
    });
  } catch (err) {
    console.error('[Widgets] Failed to register global shortcut:', err.message);
  }

  // IPC Handlers
  ipcMain.handle('get-widgets', () => {
    return {
      widgets: storeInstance.getWidgets(),
      editMode: storeInstance.getEditMode()
    };
  });

  ipcMain.handle('add-widget', (_event, { type, initialPos }) => {
    const newWidget = storeInstance.addWidget(type, initialPos);
    registryInstance.registerInstance(newWidget.type, newWidget.id);
    updateHostWindowLifecycle(storeInstance, registryInstance, onStateChange);
    onStateChange();
    return newWidget;
  });

  ipcMain.handle('remove-widget', (_event, id) => {
    registryInstance.unregisterInstance(id);
    const updated = storeInstance.removeWidget(id);
    updateHostWindowLifecycle(storeInstance, registryInstance, onStateChange);
    onStateChange();
    return updated;
  });

  ipcMain.handle('update-widget', (_event, { id, updates }) => {
    const updated = storeInstance.updateWidget(id, updates);
    onStateChange();
    return updated;
  });

  ipcMain.handle('set-widget-edit-mode', (_event, editMode) => {
    storeInstance.setEditMode(editMode);
    onStateChange();
    return storeInstance.getEditMode();
  });

  ipcMain.handle('toggle-widget-access-panel', () => {
    toggleAccessPanel(storeInstance, (editMode) => {
      onStateChange();
    });
    return isAccessPanelOpen();
  });

  ipcMain.handle('get-widget-active-summary', () => {
    return registryInstance.getActiveSummary();
  });

  ipcMain.handle('select-photo-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('widget-action', async (_event, actionData) => {
    if (!actionData || !actionData.action) return { success: false };
    if (actionData.action === 'launch-app') {
      if (actionData.path) {
        shell.openPath(actionData.path);
        return { success: true };
      }
    }
    return { success: false };
  });

  // Mouse event ignore forwarding handler for host window
  ipcMain.on('set-ignore-mouse', (_event, ignore) => {
    const hostWin = getHostWindow();
    if (hostWin && !hostWin.isDestroyed()) {
      if (ignore) {
        hostWin.setIgnoreMouseEvents(true, { forward: true });
      } else {
        hostWin.setIgnoreMouseEvents(false);
        if (!hostWin.isFocused()) {
          hostWin.focus();
        }
      }
    }
  });

  // Weather fetch integration reusing weather.js
  ipcMain.handle('get-widget-weather', async (_event, cityOverride) => {
    try {
      if (weatherModule && typeof weatherModule.fetchWeather === 'function') {
        return await weatherModule.fetchWeather(cityOverride, true);
      }
    } catch (err) {
      console.error('[Widgets] Weather fetch error:', err.message);
    }
    return { error: 'Weather fetch failed' };
  });

  // Media info & control integration
  let isMediaPlaying = false;
  ipcMain.handle('get-media-metadata', () => {
    return {
      title: isMediaPlaying ? 'System Media Audio' : 'Media Player',
      artist: isMediaPlaying ? 'Playing' : 'Paused / Ready',
      isPlaying: isMediaPlaying
    };
  });

  ipcMain.handle('media-control', async (_event, action) => {
    if (action === 'play-pause') {
      isMediaPlaying = !isMediaPlaying;
    }
    if (process.platform === 'win32') {
      const { exec } = require('node:child_process');
      let keyCode = 179; // Play/Pause
      if (action === 'next') keyCode = 176;
      if (action === 'prev') keyCode = 177;
      try {
        exec(`powershell -c "(New-Object -ComObject wscript.shell).SendKeys([char]${keyCode})"`);
      } catch (e) {
        console.error('[Widgets] Media control exec error:', e.message);
      }
    }
    return { success: true, isPlaying: isMediaPlaying };
  });
}

function getRegistry() {
  return registryInstance;
}

function getStore() {
  return storeInstance;
}

module.exports = {
  initWidgetsSubsystem,
  getRegistry,
  getStore
};
