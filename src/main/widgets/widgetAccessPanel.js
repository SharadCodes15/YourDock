const { BrowserWindow, screen, ipcMain } = require('electron');
const path = require('node:path');

let panelWindow = null;

function createAccessPanelWindow(store, onToggleCallback) {
  if (panelWindow && !panelWindow.isDestroyed()) {
    return panelWindow;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  const panelWidth = 330;

  panelWindow = new BrowserWindow({
    width: panelWidth,
    height: screenHeight,
    x: screenWidth - panelWidth,
    y: 0,
    transparent: true,
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const rendererPath = path.join(__dirname, '..', '..', 'renderer', 'widgets', 'access-panel.html');
  panelWindow.loadFile(rendererPath);

  panelWindow.once('ready-to-show', () => {
    if (panelWindow && !panelWindow.isDestroyed()) {
      panelWindow.show();
      panelWindow.focus();
    }
  });

  panelWindow.on('closed', () => {
    panelWindow = null;
  });

  return panelWindow;
}

function openAccessPanel(store, onToggleCallback) {
  store.setEditMode(true);
  if (!panelWindow || panelWindow.isDestroyed()) {
    createAccessPanelWindow(store, onToggleCallback);
  } else {
    panelWindow.show();
    panelWindow.focus();
  }
  if (typeof onToggleCallback === 'function') {
    onToggleCallback(true);
  }
}

function closeAccessPanel(store, onToggleCallback) {
  store.setEditMode(false);
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.hide();
  }
  if (typeof onToggleCallback === 'function') {
    onToggleCallback(false);
  }
}

function toggleAccessPanel(store, onToggleCallback) {
  if (panelWindow && !panelWindow.isDestroyed() && panelWindow.isVisible()) {
    closeAccessPanel(store, onToggleCallback);
  } else {
    openAccessPanel(store, onToggleCallback);
  }
}

function isAccessPanelOpen() {
  return panelWindow !== null && !panelWindow.isDestroyed() && panelWindow.isVisible();
}

module.exports = {
  openAccessPanel,
  closeAccessPanel,
  toggleAccessPanel,
  isAccessPanelOpen
};
