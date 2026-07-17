const { desktopCapturer, screen, clipboard, nativeImage, BrowserWindow, ipcMain, app, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let overlayWin = null;
let resolveSelection = null;
let isCapturing = false;

function getScreenshotsFolder(settings) {
  const base = (settings.general && settings.general.screenshotFolder)
    ? settings.general.screenshotFolder
    : app.getPath('pictures');
  const dir = path.join(base, 'Screenshots');
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { return base; }
  }
  return dir;
}

function generateFilename() {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `Screenshot ${y}-${mo}-${d} at ${h}.${mi}.${s}.png`;
}

function saveScreenshot(pngBuffer, settings) {
  const folder = getScreenshotsFolder(settings);
  const filename = generateFilename();
  const filePath = path.join(folder, filename);
  fs.writeFileSync(filePath, pngBuffer);
  return filePath;
}

function copyToClipboard(pngBuffer, settings) {
  if (settings.general && settings.general.copyScreenshotToClipboard === false) return;
  const img = nativeImage.createFromBuffer(pngBuffer);
  clipboard.writeImage(img);
}

async function captureFullScreen(settings) {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.bounds;
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: Math.round(width * devicePixelRatio), height: Math.round(height * devicePixelRatio) }
  });
  if (!sources || sources.length === 0) throw new Error('No screen sources found');
  const source = sources[0];
  const pngBuffer = source.thumbnail.toPNG();
  const filePath = saveScreenshot(pngBuffer, settings);
  copyToClipboard(pngBuffer, settings);
  return filePath;
}

async function captureSelectedArea(settings) {
  return new Promise((resolve, reject) => {
    if (overlayWin) {
      reject(new Error('Already capturing'));
      return;
    }

    const displays = screen.getAllDisplays();
    let totalBounds = { x: 0, y: 0, width: 0, height: 0 };
    for (const d of displays) {
      const b = d.bounds;
      if (b.x < totalBounds.x) totalBounds.x = b.x;
      if (b.y < totalBounds.y) totalBounds.y = b.y;
      if (b.x + b.width > totalBounds.x + totalBounds.width) totalBounds.width = b.x + b.width - totalBounds.x;
      if (b.y + b.height > totalBounds.y + totalBounds.height) totalBounds.height = b.y + b.height - totalBounds.y;
    }

    overlayWin = new BrowserWindow({
      x: totalBounds.x, y: totalBounds.y,
      width: totalBounds.width, height: totalBounds.height,
      frame: false, transparent: true,
      alwaysOnTop: true, skipTaskbar: true,
      resizable: false, show: false,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, 'screenshot-overlay-preload.js'),
        contextIsolation: true, nodeIntegration: false
      }
    });

    overlayWin.loadFile(path.join(__dirname, 'screenshot-overlay.html'));

    overlayWin.once('ready-to-show', () => {
      overlayWin.show();
      overlayWin.focus();
      overlayWin.setIgnoreMouseEvents(false);
    });

    ipcMain.once('overlay-selection', (event, rect) => {
      const ol = overlayWin;
      overlayWin = null;
      if (ol && !ol.isDestroyed()) ol.destroy();

      if (!rect || !rect.width || !rect.height) {
        resolve(null);
        return;
      }

      setTimeout(async () => {
        try {
          const primaryDisplay = screen.getPrimaryDisplay();
          const pWidth = primaryDisplay.bounds.width;
          const pHeight = primaryDisplay.bounds.height;
          const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: Math.round(pWidth * 2), height: Math.round(pHeight * 2) }
          });
          if (!sources || sources.length === 0) { resolve(null); return; }

          const fullImage = sources[0].thumbnail;
          const scaleX = fullImage.getSize().width / totalBounds.width;
          const scaleY = fullImage.getSize().height / totalBounds.height;

          const cropX = Math.round((rect.x - totalBounds.x) * scaleX);
          const cropY = Math.round((rect.y - totalBounds.y) * scaleY);
          const cropW = Math.round(rect.width * scaleX);
          const cropH = Math.round(rect.height * scaleY);

          const cropped = fullImage.crop({ x: cropX, y: cropY, width: cropW, height: cropH });
          const pngBuffer = cropped.toPNG();
          const filePath = saveScreenshot(pngBuffer, settings);
          copyToClipboard(pngBuffer, settings);
          resolve(filePath);
        } catch (err) {
          reject(err);
        }
      }, 100);
    });

    ipcMain.once('overlay-cancel', () => {
      const ol = overlayWin;
      overlayWin = null;
      if (ol && !ol.isDestroyed()) ol.destroy();
      resolve(null);
    });
  });
}

async function captureWindow(appName, settings) {
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: 0, height: 0 }
  });

  if (!sources || sources.length === 0) throw new Error('No window sources found');

  let matched = null;
  if (appName) {
    const lower = appName.toLowerCase();
    matched = sources.find(s => s.name.toLowerCase().includes(lower)) || sources.find(s => s.id.toLowerCase().includes(lower));
  }
  if (!matched) matched = sources[0];

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: sW, height: sH } = primaryDisplay.bounds;
  const sources2 = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: { width: Math.round(sW * 2), height: Math.round(sH * 2) }
  });

  const target = sources2.find(s => s.id === matched.id || s.name === matched.name);
  if (!target) throw new Error('Window source not found for full capture');

  const pngBuffer = target.thumbnail.toPNG();
  const filePath = saveScreenshot(pngBuffer, settings);
  copyToClipboard(pngBuffer, settings);
  return filePath;
}

function createToastWindow(filePath, settings) {
  let toastWin = new BrowserWindow({
    width: 260, height: 60,
    frame: false, transparent: true,
    alwaysOnTop: true, skipTaskbar: true,
    resizable: false, show: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'screenshot-toast-preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  });

  toastWin.loadFile(path.join(__dirname, 'screenshot-toast.html'));

  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const targetDisplay = displays.find(d => {
    const b = d.bounds;
    return b.x <= 0 && b.y <= 0 && b.x + b.width >= primary.bounds.width;
  }) || primary;

  const { x: dx, y: dy, width: sw, height: sh } = targetDisplay.bounds;

  toastWin.once('ready-to-show', () => {
    const tx = dx + sw - 280;
    const ty = dy + sh - 80;
    toastWin.setBounds({ x: tx, y: ty, width: 260, height: 60 });
    toastWin.show();
    toastWin.focus();

    toastWin.webContents.send('toast-data', {
      filePath: filePath,
      dismissMs: 4000
    });
  });

  toastWin.on('closed', () => { toastWin = null; });

  return toastWin;
}

module.exports = { captureFullScreen, captureSelectedArea, captureWindow, createToastWindow };
