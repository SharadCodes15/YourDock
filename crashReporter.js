const { app, BrowserWindow, screen } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const MAX_REPORTS = 20;

function getCrashReportsPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'crashReports.json');
}

function readCrashReports() {
  try {
    const filePath = getCrashReportsPath();
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('[CrashReporter] Failed to read crashReports.json:', err);
    return [];
  }
}

function saveCrashReports(reports) {
  try {
    const filePath = getCrashReportsPath();
    const capped = reports.slice(0, MAX_REPORTS);
    fs.writeFileSync(filePath, JSON.stringify(capped, null, 2), 'utf8');
  } catch (err) {
    console.error('[CrashReporter] Failed to write crashReports.json:', err);
  }
}

function logCrashReport({ errorType, error, processWindow = 'main', stateSnapshot = null }) {
  try {
    const reports = readCrashReports();
    const timestamp = new Date().toISOString();
    const message = error instanceof Error ? error.message : (typeof error === 'string' ? error : (error && error.message) || String(error));
    const stack = error instanceof Error ? error.stack : (error && error.stack) || String(error);

    let version = '1.0.0';
    try {
      if (app && typeof app.getVersion === 'function') {
        version = app.getVersion();
      }
    } catch (e) {}

    const entry = {
      id: `crash_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp,
      errorType: errorType || 'UncaughtException',
      message: message || 'Unknown error',
      stack: stack || 'No stack trace available',
      processWindow: processWindow || 'main',
      appVersion: version,
      stateSnapshot: stateSnapshot || {},
      seen: false
    };

    reports.unshift(entry); // newest first
    saveCrashReports(reports);
    return entry;
  } catch (err) {
    console.error('[CrashReporter] Error in logCrashReport:', err);
    return null;
  }
}

function getCrashReports() {
  return readCrashReports();
}

function clearCrashReports() {
  saveCrashReports([]);
  return { success: true };
}

function markReportsAsSeen() {
  const reports = readCrashReports();
  let modified = false;
  for (const r of reports) {
    if (!r.seen) {
      r.seen = true;
      modified = true;
    }
  }
  if (modified) {
    saveCrashReports(reports);
  }
}

function checkAndSurfaceUnseenCrashToast() {
  try {
    const reports = readCrashReports();
    const hasUnseen = reports.some(r => !r.seen);
    if (!hasUnseen) return null;

    markReportsAsSeen();

    // Create a small non-blocking toast window
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x: dx, y: dy, width: sw, height: sh } = primaryDisplay.bounds;

    let toastWin = new BrowserWindow({
      width: 380,
      height: 70,
      x: dx + sw - 400,
      y: dy + sh - 90,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      show: false,
      focusable: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 10px 14px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: rgba(30, 30, 35, 0.92);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: #ffffff;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.15);
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 12px;
            overflow: hidden;
          }
          .icon { font-size: 18px; flex-shrink: 0; }
          .content { flex: 1; }
          .title { font-weight: 600; color: #ff9500; margin-bottom: 2px; }
          .desc { font-size: 11px; color: #d0d0d0; line-height: 1.3; }
        </style>
      </head>
      <body>
        <div class="icon">⚠️</div>
        <div class="content">
          <div class="title">App Recovered</div>
          <div class="desc">The app recovered from an unexpected issue last session. View details in Settings → Security.</div>
        </div>
      </body>
      </html>
    `;

    toastWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    toastWin.once('ready-to-show', () => {
      toastWin.showInactive();
      setTimeout(() => {
        if (toastWin && !toastWin.isDestroyed()) {
          toastWin.close();
        }
      }, 6000);
    });

    toastWin.on('closed', () => {
      toastWin = null;
    });

    return toastWin;
  } catch (err) {
    console.error('[CrashReporter] Error showing crash toast:', err);
    return null;
  }
}

module.exports = {
  logCrashReport,
  getCrashReports,
  clearCrashReports,
  markReportsAsSeen,
  checkAndSurfaceUnseenCrashToast,
  MAX_REPORTS
};
