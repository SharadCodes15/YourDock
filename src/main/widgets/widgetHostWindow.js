const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('node:path');
const { pinWindowToWallpaper } = require('./wallpaperPinner');

/**
 * WIDGET HOST WINDOW MANAGEMENT
 *
 * Safe Electron-Only Implementation Note:
 * True "pinned to desktop, always behind everything" wallpaper behavior like Wallpaper Engine
 * requires the Win32 WorkerW wallpaper-parenting technique. This module performs that parenting
 * via a PowerShell + embedded C# P/Invoke helper (wallpaperPinner.js) so no native addon is
 * shipped. If the helper fails, the window degrades to a normal transparent window with a
 * moveBottom() fallback so it still sinks behind regular app windows.
 *
 * Zero-Cost Requirement Guarantee:
 * This window is created ONLY when at least 1 widget is placed.
 * When the last widget is removed, this window is FULLY DESTROYED (not hidden), releasing
 * all GPU/renderer resources, DOM nodes, and background timers.
 */

let hostWindow = null;
let isHostWindowVisible = true;

function createHostWindow(store, registry, onStateChangeCallback) {
  if (hostWindow && !hostWindow.isDestroyed()) {
    return hostWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;

  hostWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width: width,
    height: height,
    transparent: true,
    frame: false,
    show: false,
    hasShadow: false,
    enableLargerThanScreen: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: true,
    alwaysOnTop: false, // best effort: behind normal windows
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false
    }
  });

  const rendererPath = path.join(__dirname, '..', '..', 'renderer', 'widgets', 'host.html');
  hostWindow.loadFile(rendererPath);

  // Default click-through except over widget elements
  hostWindow.setIgnoreMouseEvents(true, { forward: true });

  function pinToWallpaper() {
    if (!hostWindow || hostWindow.isDestroyed()) return;
    pinWindowToWallpaper(hostWindow).then((pinned) => {
      if (!pinned && hostWindow && !hostWindow.isDestroyed()) {
        // Fallback: sink below regular app windows as best as Electron allows.
        try { hostWindow.moveBottom(); } catch (e) { /* noop */ }
      }
    }).catch(() => {
      try { if (hostWindow && !hostWindow.isDestroyed()) hostWindow.moveBottom(); } catch (e) { /* noop */ }
    });
  }

  hostWindow.once('ready-to-show', () => {
    if (hostWindow && !hostWindow.isDestroyed()) {
      hostWindow.showInactive();
      isHostWindowVisible = true;
      pinToWallpaper();
    }
  });

  // Re-pin on every show in case Explorer recreated the WorkerW (wallpaper change).
  hostWindow.on('show', () => {
    pinToWallpaper();
  });

  hostWindow.on('minimize', () => {
    isHostWindowVisible = false;
    if (hostWindow && !hostWindow.isDestroyed()) {
      hostWindow.webContents.send('widgets-pause-timers');
    }
  });

  hostWindow.on('hide', () => {
    isHostWindowVisible = false;
    if (hostWindow && !hostWindow.isDestroyed()) {
      hostWindow.webContents.send('widgets-pause-timers');
    }
  });

  hostWindow.on('restore', () => {
    isHostWindowVisible = true;
    if (hostWindow && !hostWindow.isDestroyed()) {
      hostWindow.webContents.send('widgets-resume-timers');
    }
  });

  hostWindow.on('show', () => {
    isHostWindowVisible = true;
    if (hostWindow && !hostWindow.isDestroyed()) {
      hostWindow.webContents.send('widgets-resume-timers');
    }
  });

  hostWindow.on('closed', () => {
    hostWindow = null;
    isHostWindowVisible = false;
    if (typeof onStateChangeCallback === 'function') {
      onStateChangeCallback();
    }
  });

  return hostWindow;
}

function destroyHostWindow() {
  if (hostWindow && !hostWindow.isDestroyed()) {
    try {
      hostWindow.destroy();
    } catch (err) {
      console.error('[widgetHostWindow] Error destroying host window:', err.message);
    }
    hostWindow = null;
    isHostWindowVisible = false;
  }
}

function getHostWindow() {
  return (hostWindow && !hostWindow.isDestroyed()) ? hostWindow : null;
}

function isHostVisible() {
  return isHostWindowVisible && hostWindow !== null && !hostWindow.isDestroyed() && hostWindow.isVisible();
}

function updateHostWindowLifecycle(store, registry, onStateChangeCallback) {
  const widgets = store.getWidgets();
  if (widgets.length > 0) {
    if (!hostWindow || hostWindow.isDestroyed()) {
      createHostWindow(store, registry, onStateChangeCallback);
    } else {
      if (!hostWindow.isVisible()) {
        hostWindow.showInactive();
      }
      hostWindow.webContents.send('widgets-updated', {
        widgets: widgets,
        editMode: store.getEditMode()
      });
    }
  } else {
    // 0 widgets placed = destroy window completely
    destroyHostWindow();
  }
}

module.exports = {
  createHostWindow,
  destroyHostWindow,
  getHostWindow,
  isHostVisible,
  updateHostWindowLifecycle
};
