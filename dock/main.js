const { app, BrowserWindow, screen, ipcMain, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { exec } = require('node:child_process');

let win;
let config = {};
const configPath = path.join(__dirname, 'config.json');

// Read config file or write default if missing
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const rawData = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(rawData);
    } else {
      // Fallback defaults
      config = {
        pinned: ["finder", "launchpad", "safari", "messages", "mail", "maps", "photos", "facetime", "calendar", "notes", "reminders", "music", "appstore", "preferences"],
        autoHide: false
      };
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
}

// Generate beautiful placeholder SVG icons inside /icons
function ensureIconsFolder() {
  const iconsDir = path.join(__dirname, 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir);
  }
  
  const svgTemplates = {
    finder: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#80d0ff"/><stop offset="100%" stop-color="#0060e6"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g1)"/><path d="M 50,22 C 63,22 75,32 75,47 C 75,62 63,72 50,72 L 50,88 C 30,83 25,62 25,47 C 25,32 37,22 50,22 Z" fill="#ffffff" opacity="0.95"/><path d="M 50,22 L 50,72 M 35,42 Q 40,38 45,42 M 55,42 Q 60,38 65,42 M 36,58 Q 50,68 64,58" stroke="#004da6" stroke-width="4.5" stroke-linecap="round" fill="none"/></svg>`,
    launchpad: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f8fafc"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g2)"/><circle cx="32" cy="32" r="8" fill="#ff3b30"/><circle cx="50" cy="32" r="8" fill="#4cd964"/><circle cx="68" cy="32" r="8" fill="#007aff"/><circle cx="32" cy="50" r="8" fill="#ffcc00"/><circle cx="50" cy="50" r="8" fill="#5856d6"/><circle cx="68" cy="50" r="8" fill="#ff9500"/><circle cx="32" cy="68" r="8" fill="#34aadc"/><circle cx="50" cy="68" r="8" fill="#ff2d55"/><circle cx="68" cy="68" r="8" fill="#8e8e93"/></svg>`,
    safari: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0284c7"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g3)"/><circle cx="50" cy="50" r="28" fill="#ffffff" stroke="#0284c7" stroke-width="4"/><path d="M 50,26 L 56,44 L 74,50 L 56,56 L 50,74 L 44,56 L 26,50 L 44,44 Z" fill="#ff3b30"/><path d="M 50,50 L 56,44 L 50,26 Z" fill="#ffffff" opacity="0.6"/><circle cx="50" cy="50" r="4" fill="#ffffff"/></svg>`,
    messages: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#4ade80"/><stop offset="100%" stop-color="#16a34a"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g4)"/><path d="M 18,44 C 18,27 32,16 50,16 C 68,16 82,27 82,44 C 82,61 68,72 50,72 C 45,72 40,70 36,68 L 20,74 L 24,60 C 20,56 18,50 18,44 Z" fill="#ffffff"/></svg>`,
    mail: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g5" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#1d4ed8"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g5)"/><rect x="20" y="32" width="60" height="38" rx="5" fill="#ffffff"/><path d="M 20,34 L 50,52 L 80,34" stroke="#1d4ed8" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M 20,66 L 42,48 M 80,66 L 58,48" stroke="#1d4ed8" stroke-width="4" stroke-linecap="round" fill="none"/></svg>`,
    maps: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g6" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#a3e635"/><stop offset="100%" stop-color="#15803d"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g6)"/><path d="M 20,20 L 40,30 L 60,20 L 80,30 L 80,80 L 60,70 L 40,80 L 20,70 Z" fill="none" stroke="#ffffff" stroke-width="5" stroke-linejoin="round"/><path d="M 40,30 L 40,80 M 60,20 L 60,70" stroke="#ffffff" stroke-width="3"/><circle cx="50" cy="45" r="8" fill="#ef4444"/><path d="M 45,49 L 50,60 L 55,49 Z" fill="#ef4444"/></svg>`,
    photos: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="22" fill="#ffffff" stroke="#f1f5f9" stroke-width="1.5"/><ellipse cx="50" cy="30" rx="9" ry="17" fill="#ff2d55" opacity="0.8"/><ellipse cx="70" cy="50" rx="17" ry="9" fill="#ff9500" opacity="0.8"/><ellipse cx="50" cy="70" rx="9" ry="17" fill="#4cd964" opacity="0.8"/><ellipse cx="30" cy="50" rx="17" ry="9" fill="#007aff" opacity="0.8"/></svg>`,
    facetime: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g8" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#22c55e"/><stop offset="100%" stop-color="#15803d"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g8)"/><rect x="22" y="32" width="34" height="36" rx="6" fill="#ffffff"/><polygon points="56,42 78,32 78,68 56,58" fill="#ffffff" stroke-linejoin="round"/></svg>`,
    calendar: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="22" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/><rect width="100" height="26" fill="#ef4444" rx="22" clip-path="polygon(0 0, 100 0, 100 26, 0 26)"/><path d="M0,18 L100,18" stroke="#ef4444" stroke-width="8"/><text x="50" y="17" font-family="-apple-system, sans-serif" font-weight="800" font-size="11" fill="#ffffff" text-anchor="middle">MON</text><text x="50" y="74" font-family="-apple-system, sans-serif" font-weight="700" font-size="40" fill="#1e293b" text-anchor="middle">13</text></svg>`,
    notes: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g10" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fef08a"/><stop offset="100%" stop-color="#eab308"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g10)"/><rect width="100" height="18" fill="#ca8a04" rx="22" clip-path="polygon(0 0, 100 0, 100 18, 0 18)"/><path d="M0,13 L100,13" stroke="#ca8a04" stroke-width="8"/><line x1="20" y1="38" x2="80" y2="38" stroke="#71717a" stroke-width="2.5"/><line x1="20" y1="54" x2="80" y2="54" stroke="#71717a" stroke-width="2.5"/><line x1="20" y1="70" x2="80" y2="70" stroke="#71717a" stroke-width="2.5"/></svg>`,
    reminders: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="22" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/><circle cx="28" cy="32" r="6" stroke="#ef4444" stroke-width="3" fill="none"/><line x1="42" y1="32" x2="78" y2="32" stroke="#1d1d1f" stroke-width="4.5" stroke-linecap="round"/><circle cx="28" cy="50" r="6" stroke="#3b82f6" stroke-width="3" fill="none"/><line x1="42" y1="50" x2="78" y2="50" stroke="#1d1d1f" stroke-width="4.5" stroke-linecap="round"/><circle cx="28" cy="68" r="6" stroke="#22c55e" stroke-width="3" fill="none"/><line x1="42" y1="68" x2="78" y2="68" stroke="#1d1d1f" stroke-width="4.5" stroke-linecap="round"/></svg>`,
    music: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g12" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f43f5e"/><stop offset="100%" stop-color="#dc2626"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g12)"/><path d="M 38,65 C 38,56 46,56 48,56 L 48,26 L 72,32 L 72,44 L 56,40 L 56,60 C 56,69 46,69 38,65 Z" fill="#ffffff"/></svg>`,
    appstore: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g13" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#2563eb"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g13)"/><path d="M 50,15 L 50,85 M 20,68 L 80,32 M 20,32 L 80,68" stroke="#ffffff" stroke-width="9" stroke-linecap="round"/></svg>`,
    preferences: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g14" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#cbd5e1"/><stop offset="100%" stop-color="#64748b"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g14)"/><circle cx="50" cy="50" r="22" fill="none" stroke="#334155" stroke-width="5.5"/><circle cx="50" cy="50" r="9" fill="#334155"/><path d="M 50,20 L 50,12 M 50,80 L 50,88 M 20,50 L 12,50 M 80,50 L 88,50 M 29,29 L 23,23 M 71,71 L 77,77 M 29,71 L 23,77 M 71,29 L 77,23" stroke="#334155" stroke-width="8" stroke-linecap="round"/></svg>`,
    trash: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g15" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f1f5f9"/><stop offset="100%" stop-color="#94a3b8"/></linearGradient></defs><rect width="100" height="100" rx="22" fill="url(#g15)"/><rect x="30" y="32" width="40" height="42" rx="4" fill="none" stroke="#334155" stroke-width="5"/><line x1="24" y1="26" x2="76" y2="26" stroke="#334155" stroke-width="5" stroke-linecap="round"/><rect x="42" y="18" width="16" height="8" rx="2" fill="none" stroke="#334155" stroke-width="4"/><line x1="42" y1="42" x2="42" y2="62" stroke="#334155" stroke-width="4.5" stroke-linecap="round"/><line x1="50" y1="42" x2="50" y2="62" stroke="#334155" stroke-width="4.5" stroke-linecap="round"/><line x1="58" y1="42" x2="58" y2="62" stroke="#334155" stroke-width="4.5" stroke-linecap="round"/></svg>`
  };
  
  for (const [name, svgContent] of Object.entries(svgTemplates)) {
    const filePath = path.join(iconsDir, `${name}.svg`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, svgContent);
    }
  }
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  
  // Start with default width of 800px and height of 85px. Horizontally center it.
  const defaultWidth = 800;
  const defaultHeight = 85;
  const x = Math.round((screenWidth - defaultWidth) / 2);
  const y = screenHeight - defaultHeight;

  win = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    hasShadow: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');

  win.once('ready-to-show', () => {
    win.show();
  });

  // macOS Vibrancy
  if (process.platform === 'darwin') {
    win.setVibrancy('hud');
  }

  // Set to click-through by default, forwarding hover events
  win.setIgnoreMouseEvents(true, { forward: true });

  win.on('closed', () => {
    win = null;
  });

  // Start polling system tasks for dots indicators (every 4s)
  pollProcesses();
  setInterval(pollProcesses, 4000);
}

// Poll OS processes to find which mapped apps are running
function pollProcesses() {
  const cmd = process.platform === 'win32'
    ? 'tasklist /NH /FO CSV'
    : 'ps -ax -o comm';

  exec(cmd, (err, stdout) => {
    if (err || !stdout) return;

    const output = stdout.toLowerCase();
    const runningAppIds = [];

    if (config && config.apps) {
      for (const [appId, appConfig] of Object.entries(config.apps)) {
        if (!appConfig.process) continue;
        const procName = appConfig.process.toLowerCase();
        if (output.includes(procName)) {
          runningAppIds.push(appId);
        }
      }
    }

    if (win) {
      win.webContents.send('process-update', runningAppIds);
    }
  });
}

// IPC Receivers
ipcMain.handle('get-config', () => {
  loadConfig();
  return config;
});

ipcMain.on('save-config', (event, pinned) => {
  config.pinned = pinned;
  fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8', (err) => {
    if (err) console.error(err);
  });
});

ipcMain.on('save-auto-hide', (event, autoHide) => {
  config.autoHide = autoHide;
  fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8', (err) => {
    if (err) console.error(err);
  });
});

ipcMain.on('set-dock-width', (event, dockWidth) => {
  if (win) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
    const x = Math.round((screenWidth - dockWidth) / 2);
    const y = screenHeight - 85;
    win.setBounds({
      x: x,
      y: y,
      width: Math.round(dockWidth),
      height: 85
    });
  }
});

ipcMain.on('set-ignore-mouse', (event, ignore) => {
  if (win) {
    win.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

ipcMain.on('launch-app', (event, appId) => {
  if (!config || !config.apps) return;
  const appConfig = config.apps[appId];
  if (!appConfig) return;

  const targetPath = process.platform === 'win32' ? appConfig.win : appConfig.mac;
  if (!targetPath) return;

  const webProtocols = ['http://', 'https://', 'mailto:', 'ms-', 'microsoft.', 'outlookcal:', 'spotify:', 'whatsapp:'];
  const isProtocol = webProtocols.some(proto => targetPath.startsWith(proto));

  if (isProtocol) {
    shell.openExternal(targetPath).catch(err => console.error(err));
  } else {
    // Attempt exec (direct exe launch)
    exec(targetPath, (err) => {
      if (err) {
        // Fallback to shell openPath
        shell.openPath(targetPath).catch(err2 => console.error(err2));
      }
    });
  }
  
  // Re-poll immediately to show dot indicator quickly
  setTimeout(pollProcesses, 1500);
});

ipcMain.on('show-in-finder', (event, appId) => {
  if (!config || !config.apps) return;
  const appConfig = config.apps[appId];
  if (!appConfig) return;

  const targetPath = process.platform === 'win32' ? appConfig.win : appConfig.mac;
  if (!targetPath) return;

  if (fs.existsSync(targetPath)) {
    shell.showItemInFolder(targetPath);
  } else {
    // Fall back to default apps/program folders
    const fallbackFolder = process.platform === 'win32' ? 'C:\\Program Files' : '/Applications';
    shell.openPath(fallbackFolder).catch(err => console.error(err));
  }
});

ipcMain.on('quit-app', () => {
  app.quit();
});

// Single instance enforcement
const isPrimaryInstance = app.requestSingleInstanceLock({ app: 'macos-dock' });

if (!isPrimaryInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    loadConfig();
    ensureIconsFolder();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
