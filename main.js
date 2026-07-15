const { app, BrowserWindow, screen, ipcMain, shell, globalShortcut, nativeTheme, desktopCapturer, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { exec, execFile } = require('node:child_process');
const crypto = require('crypto');

// [FIX] Debug flag — set to true to enable verbose console.log statements; false keeps production quiet
const DEBUG = false;
function debugLog(...args) { if (DEBUG) console.log('[DEBUG]', ...args); }

let menuBarWin;
let dockWin;
let config = {};
const configPath = path.join(__dirname, 'dock', 'config.json');

// Settings management
let settings = {};
const settingsPath = path.join(__dirname, 'settings.json');
let settingsWin = null;

// Cache dynamically loaded modules
let activeWinModule = null;

async function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const raw = await fs.promises.readFile(settingsPath, 'utf8');
      settings = JSON.parse(raw);
    } else {
      // Default settings.json
      settings = {
        general: { launchAtLogin: false, showInDock: true, clockFormat12h: true, showDate: true },
        appearance: { theme: 'auto', blurIntensity: 20, opacity: 0.85, accentColor: '#007aff' },
        hiding: { enabled: true, mode: 'collapsed', sensitivity: 100, delay: 400, pillWidth: 180 },
        menuItems: {
          visible: { wifi: true, bluetooth: true, battery: true, volume: true, spotlight: true, controlCenter: true, settings: true, clock: true },
          order: ['wifi', 'bluetooth', 'battery', 'volume', 'spotlight', 'controlCenter', 'settings', 'clock']
        },
        shortcuts: { toggleMenuBar: '', openSettings: '' }
      };
      await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function saveSettings() {
  try {
    await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    if (menuBarWin) menuBarWin.webContents.send('settings-changed', settings);
    if (settingsWin) settingsWin.webContents.send('settings-changed', settings);
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}

// Application Drawer variables
let drawerWin = null;
let isDrawerOpen = false;
let cachedScreenshot = null;
let lastCaptureTime = 0;
const appsJsonPath = path.join(__dirname, 'dock', 'apps.json');

// [FIX] Load blacklist from editable JSON config instead of hardcoding — allows user customization
const devToolsBlacklistPath = path.join(__dirname, 'devToolsBlacklist.json');
let devToolsBlacklist = { nameKeywords: [], devToolKeywords: [], exeBlacklist: [] };
try {
  if (fs.existsSync(devToolsBlacklistPath)) {
    devToolsBlacklist = JSON.parse(fs.readFileSync(devToolsBlacklistPath, 'utf8'));
  }
} catch (e) {
  console.error('Failed to load devToolsBlacklist.json:', e);
}
const APP_BLACKLIST = devToolsBlacklist.nameKeywords || [];
const DEV_TOOL_KEYWORDS = devToolsBlacklist.devToolKeywords || [];
const EXE_BLACKLIST = (devToolsBlacklist.exeBlacklist || []).map(e => e.toLowerCase());

/**
 * Scan Windows Start Menu .lnk files using PowerShell + WScript.Shell COM.
 * Writes a temp .ps1 script to avoid inline escaping issues.
 * Returns a Promise that resolves to an array of { id, name, icon, exec }.
 */
function scanStartMenuApps() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve([]);
      return;
    }

    // Both Start Menu dirs
    const dirs = [
      path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
      path.join(process.env.APPDATA || '', 'Microsoft', 'Windows', 'Start Menu', 'Programs')
    ].filter(d => fs.existsSync(d));

    if (dirs.length === 0) {
      resolve([]);
      return;
    }

    // Write a temp PowerShell script
    const tempScriptPath = path.join(app.getPath('temp'), 'scan_startmenu.ps1');
    const dirsArray = dirs.map(d => `"${d}"`).join(',');
    const psScript = `
$shell = New-Object -ComObject WScript.Shell
$dirs = @(${dirsArray})
$results = foreach ($dir in $dirs) {
  Get-ChildItem -Path $dir -Recurse -Filter *.lnk -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      $shortcut = $shell.CreateShortcut($_.FullName)
      if ($shortcut.TargetPath) {
        [PSCustomObject]@{
          name = $_.BaseName
          target = $shortcut.TargetPath
        }
      }
    } catch {}
  }
}
if (-not $results) {
  Write-Output "[]"
} elseif ($results.Count -eq 1) {
  Write-Output ("[" + ($results | ConvertTo-Json -Compress) + "]")
} else {
  $results | ConvertTo-Json -Compress
}
`;

    fs.promises.writeFile(tempScriptPath, psScript, 'utf8').then(() => {
      exec(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tempScriptPath}"`,
        { maxBuffer: 1024 * 1024 * 5, timeout: 30000 },
        async (err, stdout, stderr) => {
          // Clean up temp script
          try { await fs.promises.unlink(tempScriptPath); } catch (e) {}

          if (err) {
            console.error('Start Menu scan error:', err.message);
            if (stderr) console.error('PowerShell stderr:', stderr);
            resolve([]);
            return;
          }

        const output = (stdout || '').trim();
        if (!output || output === '[]') {
          debugLog('Start Menu scan: no shortcuts found.');
          resolve([]);
          return;
        }

        try {
          let parsed = JSON.parse(output);
          if (!Array.isArray(parsed)) parsed = [parsed];

          const seenExePaths = new Set();
          const apps = [];

          for (const entry of parsed) {
            if (!entry || !entry.name || !entry.target) continue;

            const nameLower = entry.name.toLowerCase();
            const targetLower = (entry.target || '').toLowerCase();

            // Base blacklist filter (always applied — junk entries like uninstall/readme/help)
            const isBlacklisted = APP_BLACKLIST.some(kw => nameLower.includes(kw) || targetLower.includes(kw));
            if (isBlacklisted) continue;

            // [FIX] Multi-signal dev-tool filtering — only when hideDevTools setting is ON (default true)
            const hideDevTools = !(settings.general && settings.general.hideDevTools === false);
            if (hideDevTools) {
              // Signal 1: Dev-tool name/path keyword match
              const isDevTool = DEV_TOOL_KEYWORDS.some(kw => nameLower.includes(kw) || targetLower.includes(kw));
              if (isDevTool) continue;

              // Signal 2: Target exe is a known console/runtime executable
              const exeBasename = path.basename(targetLower);
              const isBlacklistedExe = EXE_BLACKLIST.includes(exeBasename);
              if (isBlacklistedExe) continue;
            }

            // Must have a real executable target (skip URLs, empty targets, folders)
            if (!entry.target || (!targetLower.endsWith('.exe') && !targetLower.endsWith('.msc') && !targetLower.endsWith('.cmd') && !targetLower.endsWith('.bat'))) continue;

            // De-duplicate by target exe path (case-insensitive)
            const dedupeKey = targetLower.replace(/\\/g, '/');
            if (seenExePaths.has(dedupeKey)) continue;
            seenExePaths.add(dedupeKey);

            const id = entry.name.toLowerCase().replace(/[^a-z0-9]/g, '') || `app_${apps.length}`;

            apps.push({
              id: id,
              name: entry.name,
              icon: '',
              exec: entry.target
            });
          }

          // Sort alphabetically by name
          apps.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

          debugLog(`Start Menu scan: found ${apps.length} apps (after filtering).`);
          resolve(apps);
        } catch (parseErr) {
          console.error('Failed to parse Start Menu scan output:', parseErr.message);
          console.error('Raw output (first 500 chars):', output.substring(0, 500));
          resolve([]);
        }
      });
    }).catch(err => {
      console.error('Failed to write temp PowerShell script:', err);
      resolve([]);
    });
  });
}

function getIconCachePath(exePath, extension = '.png') {
  const hash = crypto.createHash('md5').update(exePath.toLowerCase()).digest('hex');
  return path.join(__dirname, 'dock', 'icons-cache', `${hash}${extension}`);
}

let isAppsScanned = false;
function ensureAppsScanned() {
  if (isAppsScanned) return Promise.resolve();
  isAppsScanned = true;
  return scanAndPopulateApps().then(() => {
    notifyAppsUpdated();
  }).catch(err => {
    console.error('Lazy app scan failed:', err);
  });
}

/**
 * On startup, scan Start Menu and populate apps.json.
 * Preserves any manually added custom apps, favorites, and manual icon overrides.
 */
async function scanAndPopulateApps() {
  const scannedApps = await scanStartMenuApps();

  // Load existing apps.json to preserve custom entries and favorites
  let existingData = { settings: { useDesktopCapture: true }, apps: [], custom: [], favorites: [] };
  try {
    if (fs.existsSync(appsJsonPath)) {
      const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
      existingData = JSON.parse(raw);
    }
  } catch (e) {}

  // Migrate old structure if needed
  const customApps = existingData.custom || [];
  const favorites = existingData.favorites || [];
  const settingsBlock = existingData.settings || { useDesktopCapture: true };

  // Map existing apps by lowercase exec path for easy merge lookup
  const existingAppsMap = new Map();
  if (existingData.apps) {
    existingData.apps.forEach(app => {
      if (app && app.exec) {
        existingAppsMap.set(app.exec.toLowerCase(), app);
      }
    });
  }
  if (existingData.custom) {
    existingData.custom.forEach(app => {
      if (app && app.exec) {
        existingAppsMap.set(app.exec.toLowerCase(), app);
      }
    });
  }

  // Ensure icons cache folder exists
  ensureIconsFolder();

  // Merge logic: preserve manual overrides and prepare for parallel icon extraction
  const appsToProcess = [];
  for (const scannedApp of scannedApps) {
    const existing = existingAppsMap.get(scannedApp.exec.toLowerCase());
    if (existing) {
      if (existing.iconSource === 'manual') {
        scannedApp.iconPath = existing.iconPath;
        scannedApp.iconSource = 'manual';
      } else {
        scannedApp.iconPath = existing.iconPath || '';
        scannedApp.iconSource = existing.iconSource || 'extracted';
      }
    } else {
      scannedApp.iconPath = '';
      scannedApp.iconSource = 'scan';
    }
    appsToProcess.push(scannedApp);
  }

  // Helper to extract a single app's icon asynchronously
  const extractIcon = async (scannedApp) => {
    if (scannedApp.iconSource === 'manual') {
      return;
    }
    const cachePath = getIconCachePath(scannedApp.exec, '.png');
    const cacheExists = fs.existsSync(cachePath);
    if (cacheExists) {
      scannedApp.iconPath = `file://${cachePath.replace(/\\/g, '/')}`;
      scannedApp.iconSource = 'extracted';
    } else if (fs.existsSync(scannedApp.exec)) {
      try {
        const nativeImg = await app.getFileIcon(scannedApp.exec, { size: 'large' });
        await fs.promises.writeFile(cachePath, nativeImg.toPNG());
        scannedApp.iconPath = `file://${cachePath.replace(/\\/g, '/')}`;
        scannedApp.iconSource = 'extracted';
      } catch (err) {
        console.error(`Failed to auto-extract icon for ${scannedApp.name}:`, err.message);
        scannedApp.iconSource = 'scan';
        scannedApp.iconPath = '';
      }
    }
    return scannedApp;
  };

  // Run icon extraction in parallel batches of 5
  const mergedApps = [];
  const batchSize = 5;
  for (let i = 0; i < appsToProcess.length; i += batchSize) {
    const batch = appsToProcess.slice(i, i + batchSize);
    const processedBatch = await Promise.all(batch.map(app => extractIcon(app)));
    mergedApps.push(...processedBatch);
  }

  // Ensure custom apps also have default schema fields
  customApps.forEach(app => {
    if (!app.iconSource) {
      app.iconSource = app.iconPath ? 'extracted' : 'scan';
    }
  });

  const newData = {
    settings: settingsBlock,
    apps: mergedApps.length > 0 ? mergedApps : (existingData.apps || []),
    custom: customApps,
    favorites: favorites
  };

  try {
    await fs.promises.writeFile(appsJsonPath, JSON.stringify(newData, null, 2), 'utf8');
    debugLog(`apps.json populated with ${newData.apps.length} scanned apps, ${newData.custom.length} custom apps, and ${newData.favorites.length} favorites.`);
  } catch (e) {
    console.error('Failed to write apps.json:', e);
  }
}


// Auto-hide configuration and state variables (Dynamic Island pill mode for Menu Bar)
let menuBarState = 'collapsed'; // Starts collapsed by default
let cursorPollInterval = null;
let consecutiveHotspotPolls = 0;
let leaveTimeout = null;

// Auto-hide configuration and state variables (Dynamic Island pill mode for Dock)
let dockAutoHide = true; // Default true
let dockState = 'collapsed'; // Starts collapsed by default
let dockCursorPollInterval = null;
let consecutiveDockHotspotPolls = 0;
let dockLeaveTimeout = null;

// Read dock config file or write default if missing
async function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const rawData = await fs.promises.readFile(configPath, 'utf8');
      config = JSON.parse(rawData);
    } else {
      // Fallback defaults
      config = {
        pinned: ["finder", "launchpad", "safari", "mail", "appstore", "preferences"],
        autoHide: true // default true
      };
      await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    }
    dockAutoHide = config.autoHide !== false; // default to true
    dockState = dockAutoHide ? 'collapsed' : 'expanded'; // Set initial state correctly
  } catch (err) {
    console.error('Error loading config:', err);
  }
}

// [FIX] saveConfig was called but never defined — caused ReferenceError on every IPC call touching config.json
async function saveConfig() {
  try {
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving config:', err);
  }
}

// Generate placeholder SVG icons inside /dock/icons
function ensureIconsFolder() {
  const iconsDir = path.join(__dirname, 'dock', 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  const iconsCacheDir = path.join(__dirname, 'dock', 'icons-cache');
  if (!fs.existsSync(iconsCacheDir)) {
    fs.mkdirSync(iconsCacheDir, { recursive: true });
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

let ccLeaveTimeout = null;
function checkControlCenterCursor() {
  if (!ccWin || ccWin.isDestroyed() || !ccWin.isVisible()) {
    if (ccLeaveTimeout) {
      clearTimeout(ccLeaveTimeout);
      ccLeaveTimeout = null;
    }
    return;
  }
  
  const cursorPoint = screen.getCursorScreenPoint();
  const bounds = ccWin.getBounds();
  const isWithin = (
    cursorPoint.x >= bounds.x &&
    cursorPoint.x <= bounds.x + bounds.width &&
    cursorPoint.y >= bounds.y &&
    cursorPoint.y <= bounds.y + bounds.height
  );
  
  if (!isWithin) {
    if (!ccLeaveTimeout) {
      ccLeaveTimeout = setTimeout(() => {
        const checkCursor = screen.getCursorScreenPoint();
        const checkBounds = ccWin.getBounds();
        const stillOutside = !(
          checkCursor.x >= checkBounds.x &&
          checkCursor.x <= checkBounds.x + checkBounds.width &&
          checkCursor.y >= checkBounds.y &&
          checkCursor.y <= checkBounds.y + checkBounds.height
        );
        
        if (stillOutside && ccWin && !ccWin.isDestroyed() && ccWin.isVisible()) {
          ccWin.hide();
        }
        ccLeaveTimeout = null;
      }, 400);
    }
  } else {
    if (ccLeaveTimeout) {
      clearTimeout(ccLeaveTimeout);
      ccLeaveTimeout = null;
    }
  }
}

// Cursor polling for reveal when collapsed (Dynamic Island mode for Menu Bar)
function pollMenuBarHover() {
  checkControlCenterCursor();
  
  if (!menuBarWin || menuBarWin.isDestroyed()) return;

  // Check if auto-hide is enabled globally
  if (!settings.hiding || !settings.hiding.enabled) {
    if (menuBarState !== 'expanded') {
      menuBarState = 'expanded';
      menuBarWin.webContents.send('set-collapse-state', false);
    }
    return;
  }

  const primaryDisplay = getTargetDisplay();
  const displayBounds = primaryDisplay.bounds;
  const cursorPoint = screen.getCursorScreenPoint();

  const screenWidth = displayBounds.width;
  const centerX = displayBounds.x + Math.round(screenWidth / 2);

  if (menuBarState === 'collapsed') {
    // 1. Hotspot Expand Detection
    const sens = settings.hiding.sensitivity || 100;
    const inHotspot = (
      cursorPoint.x >= centerX - Math.round(sens / 2) &&
      cursorPoint.x <= centerX + Math.round(sens / 2) &&
      cursorPoint.y >= displayBounds.y &&
      cursorPoint.y <= displayBounds.y + 8
    );

    if (inHotspot) {
      consecutiveHotspotPolls++;
      if (consecutiveHotspotPolls >= 2) {
        menuBarState = 'expanded';
        consecutiveHotspotPolls = 0;
        if (leaveTimeout) {
          clearTimeout(leaveTimeout);
          leaveTimeout = null;
        }
        menuBarWin.webContents.send('set-collapse-state', false); // Expand visually
      }
    } else {
      consecutiveHotspotPolls = 0;
    }
  } else {
    // 2. Leave-Bounds Detection (check full menu bar bounds)
    const menuBarBounds = menuBarWin.getBounds();
    const isWithinMenuBar = (
      cursorPoint.x >= displayBounds.x &&
      cursorPoint.x <= displayBounds.x + displayBounds.width &&
      cursorPoint.y >= displayBounds.y &&
      cursorPoint.y <= displayBounds.y + menuBarBounds.height
    );

    if (!isWithinMenuBar) {
      if (!leaveTimeout) {
        const delay = settings.hiding.delay !== undefined ? settings.hiding.delay : 400;
        leaveTimeout = setTimeout(() => {
          // Double check cursor after configured delay
          const checkCursor = screen.getCursorScreenPoint();
          const checkBounds = menuBarWin.getBounds();
          const stillOutside = !(
            checkCursor.x >= displayBounds.x &&
            checkCursor.x <= displayBounds.x + displayBounds.width &&
            checkCursor.y >= displayBounds.y &&
            checkCursor.y <= displayBounds.y + checkBounds.height
          );

          if (stillOutside) {
            menuBarState = 'collapsed';
            menuBarWin.webContents.send('set-collapse-state', true); // Collapse back to pill
          }
          leaveTimeout = null;
        }, delay);
      }
    } else {
      if (leaveTimeout) {
        clearTimeout(leaveTimeout);
        leaveTimeout = null;
      }
    }
  }
}

function startCursorPolling() {}
function stopCursorPolling() {}

// Cursor polling for reveal when Dock is collapsed (Dynamic Island mode for Dock)
function pollDockHover() {
  if (!dockWin || dockWin.isDestroyed()) return;
  if (!dockAutoHide) {
    if (dockState !== 'expanded') {
      dockState = 'expanded';
      dockWin.webContents.send('set-collapse-state', false);
    }
    return;
  }

  const primaryDisplay = getTargetDisplay();
  const displayBounds = primaryDisplay.bounds;
  const cursorPoint = screen.getCursorScreenPoint();
  const screenHeight = displayBounds.height;

  if (dockState === 'collapsed') {
    // 1. Hotspot Expand Detection (Center bottom ±100px wide, y >= bottom 15px of screen)
    const screenWidth = displayBounds.width;
    const centerX = displayBounds.x + Math.round(screenWidth / 2);
    const inHotspot = (
      cursorPoint.x >= centerX - 100 &&
      cursorPoint.x <= centerX + 100 &&
      cursorPoint.y >= displayBounds.y + screenHeight - 15
    );

    if (inHotspot) {
      consecutiveDockHotspotPolls++;
      // Debounce: require cursor in hotspot for 1 poll cycle (2 consecutive checks)
      if (consecutiveDockHotspotPolls >= 2) {
        dockState = 'expanded';
        consecutiveDockHotspotPolls = 0;
        if (dockLeaveTimeout) {
          clearTimeout(dockLeaveTimeout);
          dockLeaveTimeout = null;
        }
        dockWin.webContents.send('set-collapse-state', false); // Expand visually
      }
    } else {
      consecutiveDockHotspotPolls = 0;
    }
  } else {
    // 2. Leave-Bounds Collapse Detection
    const dockBounds = dockWin.getBounds();
    const currentHeight = isDockContextMenuOpen ? 300 : 85;
    const isWithinDock = (
      cursorPoint.x >= dockBounds.x &&
      cursorPoint.x <= dockBounds.x + dockBounds.width &&
      cursorPoint.y >= displayBounds.y + screenHeight - currentHeight &&
      cursorPoint.y <= displayBounds.y + screenHeight
    );

    if (!isWithinDock) {
      if (!dockLeaveTimeout) {
        dockLeaveTimeout = setTimeout(() => {
          // Double check cursor after 400ms debounce
          const checkCursor = screen.getCursorScreenPoint();
          const checkBounds = dockWin.getBounds();
          const stillOutside = !(
            checkCursor.x >= checkBounds.x &&
            checkCursor.x <= checkBounds.x + checkBounds.width &&
            checkCursor.y >= displayBounds.y + screenHeight - currentHeight &&
            checkCursor.y <= displayBounds.y + screenHeight
          );

          if (stillOutside) {
            if (isDockContextMenuOpen) {
              isDockContextMenuOpen = false;
              dockWin.webContents.send('close-context-menu');
              dockWin.setBounds({
                x: checkBounds.x,
                y: screenHeight - 85,
                width: checkBounds.width,
                height: 85
              });
            }
            if (dockAutoHide) {
              dockState = 'collapsed';
              dockWin.webContents.send('set-collapse-state', true); // Collapse back to pill
            }
          }
          dockLeaveTimeout = null;
        }, 400);
      }
    } else {
      if (dockLeaveTimeout) {
        clearTimeout(dockLeaveTimeout);
        dockLeaveTimeout = null;
      }
    }
  }
}

function startDockCursorPolling() {}
function stopDockCursorPolling() {}

// Register Global Shortcuts
function registerGlobalShortcuts() {
  globalShortcut.unregisterAll();

  if (settings.shortcuts && settings.shortcuts.toggleMenuBar) {
    try {
      globalShortcut.register(settings.shortcuts.toggleMenuBar, () => {
        if (menuBarWin) {
          if (menuBarWin.isVisible()) menuBarWin.hide();
          else menuBarWin.show();
        }
      });
    } catch (err) {
      console.error('Failed to register toggleMenuBar shortcut:', err);
    }
  }

  if (settings.shortcuts && settings.shortcuts.openSettings) {
    try {
      globalShortcut.register(settings.shortcuts.openSettings, () => {
        showSettingsWindow();
      });
    } catch (err) {
      console.error('Failed to register openSettings shortcut:', err);
    }
  }

  // Register Spotlight search shortcut
  try {
    globalShortcut.register('CommandOrControl+Space', () => {
      toggleSpotlight();
    });
  } catch (err) {
    console.error('Failed to register spotlight shortcut:', err);
  }
}

// Create Settings Window
function createSettingsWindow() {
  if (settingsWin) return;

  settingsWin = new BrowserWindow({
    width: 480,
    height: 600,
    frame: true,
    resizable: false,
    alwaysOnTop: false,
    show: false,
    title: 'Menu Bar Settings',
    webPreferences: {
      preload: path.join(__dirname, 'settings-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWin.loadFile(path.join(__dirname, 'settings.html'));

  // Intercept close to hide window instead of destroying
  settingsWin.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      settingsWin.hide();
    }
  });

  settingsWin.on('closed', () => {
    settingsWin = null;
  });
}

function showSettingsWindow() {
  ensureAppsScanned();
  if (!settingsWin) {
    createSettingsWindow();
  }
  settingsWin.center();
  settingsWin.show();
}



// Resolve resolved theme values (Light/Dark, opacity, blur, cornerRadius)
function resolveThemeConfig() {
  let activeTheme = (settings.appearance && settings.appearance.theme) || 'light';
  let glassIntensity = (settings.appearance && settings.appearance.glassIntensity) || 'Standard';
  let cornerRadius = (settings.appearance && settings.appearance.cornerRadius) || 12;
  let accentColor = (settings.appearance && settings.appearance.accentColor) || '#007aff';
  
  const presets = settings.themePresets || [];
  const matchedPreset = presets.find(p => p.name === activeTheme);
  if (matchedPreset) {
    activeTheme = matchedPreset.theme;
    glassIntensity = matchedPreset.glassIntensity;
    cornerRadius = matchedPreset.cornerRadius;
    accentColor = matchedPreset.accentColor;
  }
  
  let themeValue = activeTheme;
  if (activeTheme === 'auto') {
    themeValue = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }
  
  return {
    theme: themeValue,
    accentColor,
    glassIntensity,
    cornerRadius,
    lowRamMode: !!(settings.performance && settings.performance.lowRamMode)
  };
}

function broadcastThemeConfig() {
  const resolved = resolveThemeConfig();
  const windows = [menuBarWin, dockWin, drawerWin, ccWin, spotlightWin, settingsWin];
  for (const w of windows) {
    if (w && !w.isDestroyed()) {
      w.webContents.send('theme-changed', resolved);
    }
  }
}

// Watch system theme change (Auto theme)
nativeTheme.on('updated', () => {
  if (settings.appearance && settings.appearance.theme === 'auto') {
    broadcastThemeConfig();
  }
});

// IPC Handles for theme config
ipcMain.handle('get-theme-config', () => {
  return resolveThemeConfig();
});

function getTargetDisplay() {
  const all = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  if (settings.general && settings.general.displayMonitor && settings.general.displayMonitor !== 'primary') {
    const matched = all.find(d => String(d.id) === String(settings.general.displayMonitor));
    if (matched) return matched;
  }
  return primary;
}

ipcMain.handle('get-displays', () => {
  return screen.getAllDisplays().map(d => ({
    id: d.id,
    bounds: d.bounds,
    isPrimary: d.id === screen.getPrimaryDisplay().id
  }));
});

function clearIconCache() {
  const cacheDir = path.join(__dirname, 'dock', 'icons-cache');
  if (fs.existsSync(cacheDir)) {
    const files = fs.readdirSync(cacheDir);
    for (const file of files) {
      try {
        fs.unlinkSync(path.join(cacheDir, file));
      } catch (e) {}
    }
  }
  return { success: true };
}

ipcMain.handle('clear-icon-cache', () => {
  return clearIconCache();
});

ipcMain.handle('get-ram-usage', () => {
  let totalKb = 0;
  const metrics = app.getAppMetrics();
  for (const m of metrics) {
    totalKb += m.memory.workingSetSize;
  }
  return Math.round(totalKb / 1024);
});

// Apply settings state to system (e.g. skipTaskbar, opacity, launchAtLogin, etc.)
function applySettings() {
  if (!menuBarWin) return;
  
  broadcastThemeConfig();


  // 1. Show in Dock / Taskbar (skipTaskbar)
  const skipDock = settings.general && settings.general.showInDock === false;
  menuBarWin.setSkipTaskbar(skipDock);

  // 2. Launch at Login
  const launch = settings.general && settings.general.launchAtLogin;
  app.setLoginItemSettings({
    openAtLogin: launch
  });

  // 3. Opacity
  const opacityVal = (settings.appearance && settings.appearance.opacity) || 0.85;
  menuBarWin.setOpacity(opacityVal);

  // 4. Auto-Hide behavior
  const autoHideEnabled = settings.hiding && settings.hiding.enabled;
  menuBarState = autoHideEnabled ? 'collapsed' : 'expanded';
}

// Get desktop screenshot as data URL using desktopCapturer
async function getScreenshotDataUrl() {
  const now = Date.now();
  if (cachedScreenshot && (now - lastCaptureTime < 5000)) {
    return cachedScreenshot;
  }

  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.bounds;
    
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(width / 8),
        height: Math.round(height / 8)
      }
    });

    if (sources && sources.length > 0) {
      cachedScreenshot = sources[0].thumbnail.toDataURL();
      lastCaptureTime = now;
      return cachedScreenshot;
    }
  } catch (err) {
    console.error('Failed to capture desktop screenshot:', err);
  }
  return '';
}

// Create fullscreen Application Drawer window
function createDrawerWindow() {
  if (drawerWin) return;

  drawerWin = new BrowserWindow({
    fullscreen: true,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'dock', 'drawer-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  drawerWin.loadFile(path.join(__dirname, 'dock', 'drawer.html'));

  drawerWin.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      closeDrawer();
    }
  });

  drawerWin.on('closed', () => {
    drawerWin = null;
  });
}

async function openDrawer() {
  ensureAppsScanned();
  if (!drawerWin) {
    createDrawerWindow();
  }

  let screenshotUrl = '';
  let useCapture = true;

  if (fs.existsSync(appsJsonPath)) {
    try {
      const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
      const appsData = JSON.parse(raw);
      if (appsData.settings && appsData.settings.useDesktopCapture === false) {
        useCapture = false;
      }
    } catch (e) {}
  }

  if (useCapture) {
    screenshotUrl = await getScreenshotDataUrl();
  }

  if (drawerWin) {
    drawerWin.webContents.send('open-drawer', screenshotUrl);
    drawerWin.show();
    isDrawerOpen = true;
  }
}

function closeDrawer() {
  if (drawerWin) {
    drawerWin.webContents.send('close-drawer');
    // Hide drawer window after CSS fade/scale animation has ended (200ms ease)
    setTimeout(() => {
      if (!isDrawerOpen && drawerWin) {
        drawerWin.hide();
      }
    }, 250);
    isDrawerOpen = false;
  }
}

let tray = null;
function createTray() {
  if (tray) return;
  
  const trayIconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAABJElEQVQ4y2P8//8/AyUYSAu4rihJ+N/QyGf959cfhszETBwMTAwM/wz1fNf/uC4jK+C2/C8j4/8M1NnAwMDA8O/Pf0ZWRqIEN4CBIOPvn/+MzDSwAGQASyNDwv/ffxiZKW4AWyPDf7D4f5qegY2BYcK1X6/PGBj+M+AyALmBbM3t/xV1zAxsa/8xMTAwMDBIqdgwTND8/4cBzX/mCbd//V7x7z8jA1wB35V/GQyMfzPQsAGmsYxM/xkYf+d/N7tSwszExMCwfPcfRj+/Pwxsa/6DxdkYGBj+MzLw3fxz4Vf2r3/M+GzBNeHaL7B4DQMTA8O/f//gCv6d+ZPxL04DGBgY/jH9O/33/M9sXF4EmwECDIz/z//Mxu9FmAEAw156yOchLpIAAAAASUVORK5CYII=';
  const img = nativeImage.createFromBuffer(Buffer.from(trayIconBase64, 'base64'));
  
  tray = new Tray(img);
  tray.setToolTip('macOS Dock & Menu Bar');
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Settings', click: () => showSettingsWindow() },
    { label: 'Show Menu Bar & Dock', click: () => {
        if (menuBarWin && !menuBarWin.isDestroyed()) {
          menuBarWin.show();
          if (menuBarState === 'collapsed') {
            menuBarWin.webContents.send('set-collapse-state', true);
          } else {
            menuBarWin.webContents.send('set-collapse-state', false);
          }
        }
        if (dockWin && !dockWin.isDestroyed()) {
          dockWin.show();
          if (dockState === 'collapsed') {
            dockWin.webContents.send('set-collapse-state', true);
          } else {
            dockWin.webContents.send('set-collapse-state', false);
          }
        }
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => {
    if (menuBarWin && !menuBarWin.isDestroyed()) menuBarWin.show();
    if (dockWin && !dockWin.isDestroyed()) dockWin.show();
  });
}

let masterInterval = null;
let tickCount = 0;

let lastAppName = '';
let lastActiveAppId = '';


async function pollActiveApp() {
  try {
    if (!activeWinModule) {
      activeWinModule = await import('active-win');
    }
    const activeWindow = await activeWinModule.activeWindow();
    if (activeWindow && activeWindow.owner) {
      const appName = activeWindow.owner.name;
      if (appName && appName !== lastAppName) {
        lastAppName = appName;
        if (menuBarWin && !menuBarWin.isDestroyed()) {
          menuBarWin.webContents.send('active-app-changed', appName);
        }
      }

      // Determine current app ID for genie effect
      let currentAppId = '';
      if (activeWindow.owner.path) {
        const exeName = path.basename(activeWindow.owner.path).toLowerCase();
        
        if (config && config.apps) {
          for (const [key, appConfig] of Object.entries(config.apps)) {
            if (appConfig.process && appConfig.process.toLowerCase() === exeName) {
              currentAppId = key;
              break;
            }
          }
        }
        
        if (!currentAppId && fs.existsSync(appsJsonPath)) {
          try {
            const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
            const data = JSON.parse(raw);
            const allApps = [...(data.apps || []), ...(data.custom || [])];
            const match = allApps.find(a => a.exec && path.basename(a.exec).toLowerCase() === exeName);
            if (match) {
              currentAppId = match.id;
            }
          } catch (e) {}
        }
      }

      if (currentAppId !== lastActiveAppId) {
        if (lastActiveAppId && dockWin && !dockWin.isDestroyed()) {
          dockWin.webContents.send('play-genie', lastActiveAppId);
        }
        lastActiveAppId = currentAppId;
      }
    } else {
      const defaultApp = process.platform === 'darwin' ? 'Finder' : 'Explorer';
      if (lastAppName !== defaultApp) {
        lastAppName = defaultApp;
        if (menuBarWin && !menuBarWin.isDestroyed()) {
          menuBarWin.webContents.send('active-app-changed', lastAppName);
        }
      }
      if (lastActiveAppId && dockWin && !dockWin.isDestroyed()) {
        dockWin.webContents.send('play-genie', lastActiveAppId);
      }
      lastActiveAppId = '';
    }
  } catch (err) {
    const fallbackApp = process.platform === 'darwin' ? 'Finder' : 'Explorer';
    if (lastAppName !== fallbackApp) {
      lastAppName = fallbackApp;
      if (menuBarWin && !menuBarWin.isDestroyed()) {
        menuBarWin.webContents.send('active-app-changed', lastAppName);
      }
    }
  }
}

function startMasterTimer() {
  if (masterInterval) return;
  
  masterInterval = setInterval(() => {
    tickCount++;
    const isLowRam = settings.performance && settings.performance.lowRamMode;
    
    const activeAppThreshold = isLowRam ? 25 : 8; // 3s vs 1s
    const processThreshold = isLowRam ? 250 : 66; // 30s vs 8s
    const sysinfoThreshold = isLowRam ? 1000 : 250; // 2min vs 30s
    
    // 1. Menu Bar Notch reveal hover check (120ms)
    if (menuBarWin && !menuBarWin.isDestroyed() && settings.hiding && settings.hiding.enabled) {
      pollMenuBarHover();
    }
    
    // 2. Dock reveal hover check (120ms)
    if (dockWin && !dockWin.isDestroyed()) {
      pollDockHover();
    }
    
    // 3. Active Window App Check
    if (tickCount % activeAppThreshold === 0) {
      if (menuBarWin && !menuBarWin.isDestroyed() && menuBarState !== 'collapsed') {
        pollActiveApp();
      }
    }
    
    // 4. Processes check (running dots)
    if (tickCount % processThreshold === 0) {
      if (dockWin && !dockWin.isDestroyed() && dockState !== 'collapsed') {
        pollProcesses();
      }
    }
    
    // 5. System Data (wifi/bluetooth/battery) check
    if (tickCount % sysinfoThreshold === 0) {
      const ccOpen = ccWin && !ccWin.isDestroyed() && ccWin.isVisible();
      const menuExpanded = menuBarState !== 'collapsed';
      if (ccOpen || menuExpanded) {
        pollSystemData();
      }
    }
    
    if (tickCount >= 10000) {
      tickCount = 0;
    }
  }, 120);
}

// Create macOS Top Menu Bar Window
let activeAppInterval;
function createMenuBarWindow() {
  const targetDisplay = getTargetDisplay();
  const { x, y, width } = targetDisplay.bounds;
  const startMinimized = settings.general && settings.general.startMinimizedToTray;

  menuBarWin = new BrowserWindow({
    width: width,
    height: 28,
    x: x,
    y: y,
    show: !startMinimized,
    frame: false,
    transparent: true,
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

  menuBarWin.webContents.on('console-message', (event, level, message, line, sourceId) => {
    debugLog(`[MenuBar Console] ${message} (${sourceId}:${line})`);
  });

  // Enable macOS menu bar vibrancy
  if (process.platform === 'darwin') {
    menuBarWin.setVibrancy('menu');
  }

  // Set click-through behavior by default, forwarding mouse events to renderer
  menuBarWin.setIgnoreMouseEvents(true, { forward: true });

  menuBarWin.loadFile('index.html');

  // Set initial state to collapsed when loaded
  menuBarWin.webContents.on('did-finish-load', () => {
    applySettings();
    if (menuBarState === 'collapsed') {
      menuBarWin.webContents.send('set-collapse-state', true);
    }
  });

  // Active App polling is handled by the master timer.
}

function startProcessPolling() {}
function stopProcessPolling() {}

function createDockWindow() {
  const targetDisplay = getTargetDisplay();
  const { x: dx, y: dy, width: screenWidth, height: screenHeight } = targetDisplay.bounds;
  const startMinimized = settings.general && settings.general.startMinimizedToTray;
  
  // Start with default width of 800px and height of 85px. Horizontally center it.
  const defaultWidth = 800;
  const defaultHeight = 85;
  const x = dx + Math.round((screenWidth - defaultWidth) / 2);
  const y = dy + screenHeight - defaultHeight;

  dockWin = new BrowserWindow({
    width: defaultWidth,
    height: defaultHeight,
    x: x,
    y: y,
    show: !startMinimized,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    hasShadow: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'dock', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  dockWin.loadFile(path.join(__dirname, 'dock', 'index.html'));

  // Set initial state to collapsed when loaded (if autoHide enabled)
  dockWin.webContents.on('did-finish-load', () => {
    if (dockAutoHide && dockState === 'collapsed') {
      dockWin.webContents.send('set-collapse-state', true);
      stopProcessPolling();
    } else {
      dockState = 'expanded';
      dockWin.webContents.send('set-collapse-state', false);
      startProcessPolling();
    }
  });

  // macOS Vibrancy
  if (process.platform === 'darwin') {
    dockWin.setVibrancy('hud');
  }

  // Set to click-through by default, forwarding hover events
  dockWin.setIgnoreMouseEvents(true, { forward: true });

  dockWin.on('closed', () => {
    dockWin = null;
    stopProcessPolling();
  });
}

let globalAppWindowsMap = {};

function getOpenWindowsList() {
  return new Promise((resolve) => {
    const psCommand = `Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;
public class WindowLister {
    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);
    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    public struct WindowInfo {
        public string Title;
        public uint ProcessId;
    }
    public static WindowInfo[] GetOpenWindows() {
        var list = new List<WindowInfo>();
        EnumWindows((hWnd, lParam) => {
            if (IsWindowVisible(hWnd)) {
                StringBuilder sb = new StringBuilder(256);
                GetWindowText(hWnd, sb, 256);
                string title = sb.ToString();
                if (!string.IsNullOrEmpty(title)) {
                    uint pid;
                    GetWindowThreadProcessId(hWnd, out pid);
                    list.Add(new WindowInfo { Title = title, ProcessId = pid });
                }
            }
            return true;
        }, IntPtr.Zero);
        return list.ToArray();
    }
}
"@; [WindowLister]::GetOpenWindows() | ConvertTo-Json -Compress`;

    exec(`powershell -NoProfile -Command "${psCommand.replace(/"/g, '\\"')}"`, (err, stdout) => {
      if (err) {
        exec(`powershell -NoProfile -Command "Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object @{Name='Title';Expression={$_.MainWindowTitle}}, @{Name='ProcessId';Expression={$_.Id}} | ConvertTo-Json -Compress"`, (err2, stdout2) => {
          if (err2) return resolve([]);
          try {
            const parsed = JSON.parse(stdout2);
            resolve(Array.isArray(parsed) ? parsed : [parsed]);
          } catch (e) {
            resolve([]);
          }
        });
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(Array.isArray(parsed) ? parsed : [parsed]);
      } catch (e) {
        resolve([]);
      }
    });
  });
}

// Poll OS processes to find which mapped apps are running for the Dock
function pollProcesses() {
  if (process.platform === 'win32') {
    execFile('tasklist.exe', ['/NH', '/FO', 'CSV'], { maxBuffer: 1024 * 1024 * 2 }, async (err, stdout) => {
      if (err || !stdout) return;

      const lines = stdout.split('\r\n');
      const processMap = {}; // pid -> exeName
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split('","').map(p => p.replace(/"/g, '').trim().toLowerCase());
        if (parts.length >= 2) {
          const exeName = parts[0];
          const pid = parseInt(parts[1]);
          if (!isNaN(pid)) {
            processMap[pid] = exeName;
          }
        }
      }

      const output = stdout.toLowerCase();
      const runningPinnedAppIds = [];
      const tempRunningApps = [];

      // 1. Check pinned apps (default config)
      if (config && config.apps) {
        for (const [appId, appConfig] of Object.entries(config.apps)) {
          if (!appConfig.process) continue;
          const procName = appConfig.process.toLowerCase();
          if (output.includes(procName)) {
            runningPinnedAppIds.push(appId);
          }
        }
      }

      // 2. Check all apps in apps.json (scanned + custom)
      let allApps = [];
      if (fs.existsSync(appsJsonPath)) {
        try {
          const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
          const appsData = JSON.parse(raw);
          allApps = [...(appsData.apps || []), ...(appsData.custom || [])];
          
          for (const app of allApps) {
            if (!app.exec) continue;
            const exeName = path.basename(app.exec).toLowerCase();
            if (output.includes(exeName)) {
              const isPinned = config.pinned && config.pinned.includes(app.id);
              if (isPinned) {
                if (!runningPinnedAppIds.includes(app.id)) {
                  runningPinnedAppIds.push(app.id);
                }
              } else {
                const alreadyAdded = tempRunningApps.some(t => t.id === app.id);
                if (!alreadyAdded) {
                  tempRunningApps.push({
                    id: app.id,
                    name: app.name,
                    iconPath: app.iconPath || '',
                    exec: app.exec
                  });
                }
              }
            }
          }
        } catch (e) {
          console.error('Failed to scan running apps from apps.json:', e);
        }
      }

      // 3. Match windows to running apps
      getOpenWindowsList().then(openWindows => {
        const localAppWindowsMap = {};
        const localAppWindowCounts = {};

        const getAppIdForPid = (pid) => {
          const exeName = processMap[pid];
          if (!exeName) return null;

          if (config && config.apps) {
            for (const [appId, appConfig] of Object.entries(config.apps)) {
              if (appConfig.process && appConfig.process.toLowerCase() === exeName) {
                return appId;
              }
            }
          }

          for (const app of allApps) {
            if (app.exec && path.basename(app.exec).toLowerCase() === exeName) {
              return app.id;
            }
          }
          return null;
        };

        for (const win of openWindows) {
          const pid = win.ProcessId || win.pid;
          const title = win.Title || win.title || '';
          if (!pid) continue;

          const appId = getAppIdForPid(pid);
          if (appId) {
            localAppWindowsMap[appId] = localAppWindowsMap[appId] || [];
            const dup = localAppWindowsMap[appId].some(w => w.Title === title && w.Pid === pid);
            if (!dup) {
              localAppWindowsMap[appId].push({ Title: title, Pid: pid });
            }
          }
        }

        for (const appId of [...runningPinnedAppIds, ...tempRunningApps.map(t => t.id)]) {
          localAppWindowCounts[appId] = localAppWindowsMap[appId] ? localAppWindowsMap[appId].length : 0;
        }

        globalAppWindowsMap = localAppWindowsMap;

        if (settings.general && settings.general.smartOrdering) {
          const counts = config.launchCounts || {};
          tempRunningApps.sort((a, b) => {
            const countA = counts[a.id] || 0;
            const countB = counts[b.id] || 0;
            return countB - countA;
          });
        }

        if (dockWin && !dockWin.isDestroyed()) {
          dockWin.webContents.send('process-update', {
            runningPinned: runningPinnedAppIds,
            tempRunning: tempRunningApps,
            windowCounts: localAppWindowCounts
          });
        }
      });
    });
  } else {
    const cmd = 'ps -ax -o comm';
    exec(cmd, (err, stdout) => {
      if (err || !stdout) return;

      const output = stdout.toLowerCase();
      const runningPinnedAppIds = [];
      const tempRunningApps = [];

      if (config && config.apps) {
        for (const [appId, appConfig] of Object.entries(config.apps)) {
          if (!appConfig.process) continue;
          const procName = appConfig.process.toLowerCase();
          if (output.includes(procName)) {
            runningPinnedAppIds.push(appId);
          }
        }
      }

      if (dockWin) {
        dockWin.webContents.send('process-update', {
          runningPinned: runningPinnedAppIds,
          tempRunning: tempRunningApps
        });
      }
    });
  }
}

// IPC Receivers and Handlers

// IPC handler to dynamically toggle click-through behavior for the calling window
ipcMain.on('set-ignore-mouse', (event, ignore) => {
  const senderWin = BrowserWindow.fromWebContents(event.sender);
  if (senderWin) {
    senderWin.setIgnoreMouseEvents(ignore, { forward: true });
  }
});

// IPC handler to dynamically resize window height for dropdown rendering (Menu Bar)
ipcMain.on('set-window-height', (event, height) => {
  if (menuBarWin) {
    const bounds = menuBarWin.getBounds();
    menuBarWin.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: height
    });
  }
});

// IPC handler to dynamically resize dock width and keep it centered at the bottom (Dock)
ipcMain.on('set-dock-width', (event, dockWidth) => {
  if (dockWin) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
    const x = Math.round((screenWidth - dockWidth) / 2);
    const y = screenHeight - 85;
    
    dockWin.setBounds({
      x: x,
      y: y,
      width: Math.round(dockWidth),
      height: 85
    });
  }
});

let isDockContextMenuOpen = false;
ipcMain.on('context-menu-state', (event, isOpen) => {
  isDockContextMenuOpen = isOpen;
});

ipcMain.on('escape-pressed', () => {
  forceCollapseAll();
});

ipcMain.on('refresh-app', async () => {
  await loadConfig();
  await loadSettings();
  applySettings();
  
  if (dockWin && !dockWin.isDestroyed()) {
    dockWin.webContents.send('config-changed', { config: config, appIconsMap: appIconsMap || {} });
  }
  
  const windows = [menuBarWin, spotlightWin, ccWin, settingsWin];
  for (const w of windows) {
    if (w && !w.isDestroyed()) {
      w.webContents.send('settings-changed', settings);
    }
  }
  
  notifyAppsUpdated();
});

ipcMain.on('focus-window', (event, pid) => {
  if (pid) {
    exec(`powershell -NoProfile -Command "$wshell = New-Object -ComObject WScript.Shell; $wshell.AppActivate(${pid})"`, (err) => {
      if (err) console.error('Failed to focus window:', err);
    });
  }
});

function forceCollapseAll() {
  if (dockWin && !dockWin.isDestroyed()) {
    dockWin.webContents.send('close-context-menu');
    isDockContextMenuOpen = false;
    dockWin.webContents.send('set-collapse-state', true);
    dockState = 'collapsed';
    stopProcessPolling();
    
    const bounds = dockWin.getBounds();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { height: screenHeight } = primaryDisplay.bounds;
    dockWin.setBounds({
      x: bounds.x,
      y: screenHeight - 85,
      width: bounds.width,
      height: 85
    });
  }
  
  if (menuBarWin && !menuBarWin.isDestroyed()) {
    menuBarWin.webContents.send('set-collapse-state', true);
    menuBarState = 'collapsed';
  }
  
  if (ccWin && !ccWin.isDestroyed()) {
    ccWin.hide();
  }
  
  if (spotlightWin && !spotlightWin.isDestroyed()) {
    spotlightWin.hide();
  }
  
  if (drawerWin && !drawerWin.isDestroyed() && isDrawerOpen) {
    closeDrawer();
  }
}


ipcMain.on('set-dock-height', (event, height) => {
  if (dockWin) {
    const bounds = dockWin.getBounds();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { height: screenHeight } = primaryDisplay.bounds;
    const y = screenHeight - height;
    
    dockWin.setBounds({
      x: bounds.x,
      y: y,
      width: bounds.width,
      height: height
    });
  }
});

ipcMain.handle('get-config', async () => {
  await loadConfig();
  let appIconsMap = {};
  try {
    if (fs.existsSync(appsJsonPath)) {
      const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
      const data = JSON.parse(raw);
      const allApps = [...(data.apps || []), ...(data.custom || [])];
      for (const app of allApps) {
        if (app.iconPath) {
          appIconsMap[app.id] = app.iconPath;
        }
      }
    }
  } catch (e) {}
  return { config, appIconsMap };
});

ipcMain.on('save-config', async (event, pinned) => {
  config.pinned = pinned;
  await saveConfig();
});

ipcMain.on('save-auto-hide', async (event, autoHide) => {
  config.autoHide = autoHide;
  await saveConfig();
  
  dockAutoHide = autoHide;
  if (!dockAutoHide) {
    dockState = 'expanded';
    if (dockWin) {
      dockWin.webContents.send('set-collapse-state', false);
    }
    startProcessPolling();
  } else {
    dockState = 'collapsed';
    if (dockWin) {
      dockWin.webContents.send('set-collapse-state', true);
    }
    stopProcessPolling();
  }
});

// Settings IPC Handlers
ipcMain.on('open-settings', () => {
  showSettingsWindow();
});

ipcMain.handle('get-settings', () => {
  return settings;
});

ipcMain.on('save-settings', async (event, newSettings) => {
  settings = newSettings;
  await saveSettings();
  applySettings();
});

ipcMain.handle('register-shortcut', async (event, { type, shortcut }) => {
  if (!shortcut) {
    settings.shortcuts[type] = '';
    await saveSettings();
    registerGlobalShortcuts();
    return { success: true };
  }

  try {
    const isRegistered = globalShortcut.isRegistered(shortcut);
    if (isRegistered) {
      return { success: false, error: 'Shortcut already in use by another app.' };
    }

    // Attempt temporary register
    const success = globalShortcut.register(shortcut, () => {
      if (type === 'toggleMenuBar') {
        if (menuBarWin) {
          if (menuBarWin.isVisible()) menuBarWin.hide();
          else menuBarWin.show();
        }
      } else if (type === 'openSettings') {
        showSettingsWindow();
      }
    });

    if (success) {
      globalShortcut.unregister(shortcut);
      settings.shortcuts[type] = shortcut;
      await saveSettings();
      registerGlobalShortcuts();
      return { success: true };
    } else {
      return { success: false, error: 'Could not register shortcut.' };
    }
  } catch (err) {
    return { success: false, error: `Invalid shortcut format: ${err.message}` };
  }
});

ipcMain.handle('restore-defaults', async () => {
  settings = {
    general: { launchAtLogin: false, showInDock: true, clockFormat12h: true, showDate: true },
    appearance: { theme: 'auto', blurIntensity: 20, opacity: 0.85, accentColor: '#007aff' },
    hiding: { enabled: true, mode: 'collapsed', sensitivity: 100, delay: 400, pillWidth: 180 },
    menuItems: {
      visible: { wifi: true, bluetooth: true, battery: true, volume: true, spotlight: true, controlCenter: true, settings: true, clock: true },
      order: ['wifi', 'bluetooth', 'battery', 'volume', 'spotlight', 'controlCenter', 'settings', 'clock']
    },
    shortcuts: { toggleMenuBar: '', openSettings: '' }
  };
  await saveSettings();
  applySettings();
  registerGlobalShortcuts();
  return settings;
});

// Application Drawer IPC Handlers
function notifyAppsUpdated() {
  if (drawerWin && !drawerWin.isDestroyed()) {
    drawerWin.webContents.send('apps-updated');
  }
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.webContents.send('apps-updated');
  }
}

ipcMain.handle('get-apps', async () => {
  try {
    let appsList = [];
    let favorites = [];
    let settingsData = {};

    // 1. Load Drawer apps from apps.json
    if (fs.existsSync(appsJsonPath)) {
      const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
      const data = JSON.parse(raw);
      const scanned = data.apps || [];
      const custom = data.custom || [];
      favorites = data.favorites || [];
      settingsData = data.settings || {};
      appsList = [...scanned, ...custom];
    }

    // 2. Load Pinned apps from config.json
    await loadConfig();
    if (config && config.apps) {
      for (const [appId, appConfig] of Object.entries(config.apps)) {
        const execPath = appConfig.exec || appConfig.win;
        if (!execPath) continue;

        // Check if already in drawer apps list
        const exists = appsList.some(a => (a.exec && a.exec.toLowerCase() === execPath.toLowerCase()) || a.id === appId);
        if (!exists) {
          appsList.push({
            id: appId,
            name: appConfig.name,
            exec: execPath,
            iconPath: appConfig.iconPath || '',
            iconSource: appConfig.iconSource || 'system'
          });
        }
      }
    }

    return {
      settings: settingsData,
      apps: appsList,
      favorites: favorites
    };
  } catch (err) {
    console.error('Failed to read apps in get-apps:', err);
  }
  return { apps: [], favorites: [] };
});

ipcMain.handle('save-favorites', async (event, favorites) => {
  try {
    if (fs.existsSync(appsJsonPath)) {
      const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
      const data = JSON.parse(raw);
      data.favorites = favorites;
      await fs.promises.writeFile(appsJsonPath, JSON.stringify(data, null, 2), 'utf8');
      notifyAppsUpdated();
      return true;
    }
  } catch (err) {
    console.error('Failed to save favorites:', err);
  }
  return false;
});

ipcMain.handle('refresh-apps', async () => {
  try {
    await scanAndPopulateApps();
    notifyAppsUpdated();
    return { success: true };
  } catch (err) {
    console.error('Failed to refresh apps:', err);
    return { success: false };
  }
});

ipcMain.handle('override-app-icon', async (event, { appId, exePath }) => {
  const result = await dialog.showOpenDialog({
    title: 'Select Custom Icon',
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'ico'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { success: false };
  }

  const selectedPath = result.filePaths[0];
  const ext = path.extname(selectedPath);
  const cachePath = getIconCachePath(exePath, ext);

  try {
    await fs.promises.copyFile(selectedPath, cachePath);
    const iconUrl = `file://${cachePath.replace(/\\/g, '/')}`;
    
    // 1. Read and update apps.json
    if (fs.existsSync(appsJsonPath)) {
      const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
      const data = JSON.parse(raw);
      
      const updateEntry = (appEntry) => {
        if (appEntry.id === appId || (appEntry.exec && appEntry.exec.toLowerCase() === exePath.toLowerCase())) {
          appEntry.iconPath = iconUrl;
          appEntry.iconSource = 'manual';
        }
      };

      if (data.apps) data.apps.forEach(updateEntry);
      if (data.custom) data.custom.forEach(updateEntry);

      await fs.promises.writeFile(appsJsonPath, JSON.stringify(data, null, 2), 'utf8');
      notifyAppsUpdated();
    }

    // 2. Read and update config.json
    await loadConfig();
    let configChanged = false;
    if (config && config.apps) {
      for (const [key, appConfig] of Object.entries(config.apps)) {
        const execPath = appConfig.exec || appConfig.win;
        if (key === appId || (execPath && execPath.toLowerCase() === exePath.toLowerCase())) {
          appConfig.iconPath = iconUrl;
          appConfig.iconSource = 'manual';
          configChanged = true;
        }
      }
    }
    if (configChanged) {
      await saveConfig();
      broadcastConfigUpdate();
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to override app icon:', err);
  }
  return { success: false };
});

ipcMain.handle('reset-app-icon', async (event, { appId, exePath }) => {
  try {
    // Re-extract using Electron's app.getFileIcon
    const nativeImg = await app.getFileIcon(exePath, { size: 'large' });
    const cachePath = getIconCachePath(exePath, '.png');
    
    // Save extracted image as PNG
    await fs.promises.writeFile(cachePath, nativeImg.toPNG());
    const iconUrl = `file://${cachePath.replace(/\\/g, '/')}`;
    
    // 1. Read and update apps.json
    if (fs.existsSync(appsJsonPath)) {
      const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
      const data = JSON.parse(raw);
      
      const updateEntry = (appEntry) => {
        if (appEntry.id === appId || (appEntry.exec && appEntry.exec.toLowerCase() === exePath.toLowerCase())) {
          appEntry.iconPath = iconUrl;
          appEntry.iconSource = 'extracted';
        }
      };

      if (data.apps) data.apps.forEach(updateEntry);
      if (data.custom) data.custom.forEach(updateEntry);

      await fs.promises.writeFile(appsJsonPath, JSON.stringify(data, null, 2), 'utf8');
      notifyAppsUpdated();
    }

    // 2. Read and update config.json
    await loadConfig();
    let configChanged = false;
    if (config && config.apps) {
      for (const [key, appConfig] of Object.entries(config.apps)) {
        const execPath = appConfig.exec || appConfig.win;
        if (key === appId || (execPath && execPath.toLowerCase() === exePath.toLowerCase())) {
          appConfig.iconPath = iconUrl;
          appConfig.iconSource = 'extracted';
          configChanged = true;
        }
      }
    }
    if (configChanged) {
      await saveConfig();
      broadcastConfigUpdate();
    }

    return { success: true };
  } catch (err) {
    console.error('Failed to reset app icon:', err);
  }
  return { success: false };
});


ipcMain.handle('select-custom-app', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select an Application',
    filters: [
      { name: 'Applications', extensions: ['exe', 'lnk'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { added: false };
  }

  const selectedPath = result.filePaths[0];
  const displayName = path.basename(selectedPath, path.extname(selectedPath));
  const id = displayName.toLowerCase().replace(/[^a-z0-9]/g, '') || `custom_${Date.now()}`;

  // Read existing apps.json, append to custom array, write back
  let existingData = { settings: { useDesktopCapture: true }, apps: [], custom: [] };
  try {
    if (fs.existsSync(appsJsonPath)) {
      const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
      existingData = JSON.parse(raw);
    }
  } catch (e) {}

  const custom = existingData.custom || [];

  // Check for duplicate in custom list
  const alreadyExists = custom.some(a => a.exec.toLowerCase() === selectedPath.toLowerCase());
  if (alreadyExists) {
    return { added: false, reason: 'already exists' };
  }

  custom.push({
    id: id,
    name: displayName,
    icon: '',
    exec: selectedPath
  });

  existingData.custom = custom;
  try {
    await fs.promises.writeFile(appsJsonPath, JSON.stringify(existingData, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write apps.json after custom add:', e);
    return { added: false };
  }

  return { added: true, app: { id, name: displayName, icon: '', exec: selectedPath } };
});

ipcMain.on('toggle-drawer', () => {
  if (isDrawerOpen) {
    closeDrawer();
  } else {
    openDrawer();
  }
});



// Helper to bring an already running window to the foreground on Windows
function focusRunningApp(processName) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' || !processName) {
      resolve(false);
      return;
    }
    const proc = processName.replace(/\.exe$/i, '').toLowerCase();
    const tmpScript = path.join(app.getPath('temp'), '_dock_focus.ps1');
    const psContent = [
      `$p = Get-Process -Name '${proc}' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1`,
      `if ($p) {`,
      `  $sig = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);'`,
      `  $t = Add-Type -MemberDefinition $sig -Name 'WU' -Namespace 'W32' -PassThru -ErrorAction SilentlyContinue`,
      `  if ($t) { $t::ShowWindow($p.MainWindowHandle, 9); $t::SetForegroundWindow($p.MainWindowHandle); Write-Host 'SUCCESS' }`,
      `}`
    ].join('\n');
    
    fs.promises.writeFile(tmpScript, psContent, 'utf8').then(() => {
      exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpScript}"`, async (err, stdout) => {
        try { await fs.promises.unlink(tmpScript); } catch(e) {}
        if (!err && stdout && stdout.includes('SUCCESS')) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    }).catch(() => {
      resolve(false);
    });
  });
}

ipcMain.on('hide-drawer', () => {
  closeDrawer();
});

ipcMain.on('launch-app', async (event, appId) => {
  if (appId) {
    try {
      config.launchCounts = config.launchCounts || {};
      config.launchCounts[appId] = (config.launchCounts[appId] || 0) + 1;
      await saveConfig(); // [FIX] Now properly defined — was previously undefined
    } catch (err) {
      console.error('Failed to persist launch count:', err);
    }
  }
  let appConfig = config && config.apps ? config.apps[appId] : null;

  if (!appConfig && fs.existsSync(appsJsonPath)) {
    try {
      const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
      const appsData = JSON.parse(raw);
      const allEntries = [...(appsData.apps || []), ...(appsData.custom || [])];
      const found = allEntries.find(a => a.id === appId);
      if (found) {
        appConfig = {
          name: found.name,
          win: found.exec,
          mac: found.exec
        };
      }
    } catch (e) {
      console.error('Failed to parse apps.json:', e);
    }
  }

  if (!appConfig) return;

  const targetPath = process.platform === 'win32' ? appConfig.win : appConfig.mac;
  if (!targetPath) return;

  // Try focusing first if the app is already running
  const processName = appConfig.process || path.basename(targetPath);
  if (processName) {
    const focused = await focusRunningApp(processName);
    if (focused) {
      setTimeout(pollProcesses, 1500);
      return;
    }
  }

  const webProtocols = ['http://', 'https://', 'mailto:', 'ms-', 'microsoft.', 'outlookcal:', 'spotify:', 'whatsapp:'];
  const isProtocol = webProtocols.some(proto => targetPath.startsWith(proto));

  if (isProtocol) {
    shell.openExternal(targetPath).catch(err => console.error(err));
  } else {
    exec(targetPath, (err) => {
      if (err) {
        shell.openPath(targetPath).catch(err2 => console.error(err2));
      }
    });
  }
  
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

// Single instance enforcement for the integrated app
const additionalData = { myKey: 'macos-top-bar-and-dock' };
const isPrimaryInstance = app.requestSingleInstanceLock(additionalData);

if (!isPrimaryInstance) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (menuBarWin) {
      if (menuBarWin.isMinimized()) menuBarWin.restore();
      menuBarWin.focus();
    }
    if (dockWin) {
      if (dockWin.isMinimized()) dockWin.restore();
      dockWin.focus();
    }
  });

  app.whenReady().then(async () => {
    await loadConfig();
    await loadSettings();
    ensureIconsFolder();
    createTray();
    if (settings.general && settings.general.checkForUpdatesAutomatically !== false) {
      debugLog("[Update Check] Stub: Automatically checking for updates...");
    }
    createMenuBarWindow();
    createDockWindow();
    createSettingsWindow();
    createDrawerWindow();
    registerGlobalShortcuts();
    startMasterTimer();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMenuBarWindow();
        createDockWindow();
      }
    });
  });
}

app.isQuitting = false;
app.on('before-quit', () => {
  app.isQuitting = true;
  stopCursorPolling();
  stopDockCursorPolling();
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/*
// UNCOMMENT AND CALL THIS TO REGENERATE apps.json BY SCANNING SYSTEM INSTALLED APPS
function regenerateAppsJson() {
  const fs = require('node:fs');
  const path = require('node:path');
  const { exec } = require('node:child_process');

  const appsList = [];

  if (process.platform === 'win32') {
    // Scan Windows Start Menu
    const startMenuPath1 = 'C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs';
    const startMenuPath2 = path.join(process.env.APPDATA, 'Microsoft\\Windows\\Start Menu\\Programs');
    
    const scanShortcutDir = (dir) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          scanShortcutDir(fullPath);
        } else if (file.endsWith('.lnk')) {
          const name = path.basename(file, '.lnk');
          appsList.push({
            id: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
            name: name,
            icon: '',
            exec: fullPath
          });
        }
      }
    };
    
    scanShortcutDir(startMenuPath1);
    scanShortcutDir(startMenuPath2);
  } else if (process.platform === 'darwin') {
    // Scan macOS Applications folder
    const appDir = '/Applications';
    if (fs.existsSync(appDir)) {
      const files = fs.readdirSync(appDir);
      for (const file of files) {
        if (file.endsWith('.app')) {
          const name = path.basename(file, '.app');
          appsList.push({
            id: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
            name: name,
            icon: `/Applications/${file}/Contents/Resources/AppIcon.icns`,
            exec: `/Applications/${file}`
          });
        }
      }
    }
  } else {
    // Scan Linux desktop files
    const desktopDir = '/usr/share/applications';
    if (fs.existsSync(desktopDir)) {
      const files = fs.readdirSync(desktopDir);
      for (const file of files) {
        if (file.endsWith('.desktop')) {
          const name = path.basename(file, '.desktop');
          appsList.push({
            id: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
            name: name,
            icon: '',
            exec: name
          });
        }
      }
    }
  }

  const output = {
    settings: { useDesktopCapture: true },
    apps: appsList
  };

  fs.writeFileSync(
    path.join(__dirname, 'dock', 'apps.json'),
    JSON.stringify(output, null, 2),
    'utf8'
  );
  debugLog(`Successfully generated apps.json with ${appsList.length} applications!`);
}
// regenerateAppsJson();
*/

// ==========================================
// CONTROL CENTER, SYSTEM DATA & DOCK BADGES
// ==========================================
let ccWin = null;
let dndActive = false;

function createControlCenterWindow() {
  if (ccWin) return;
  ccWin = new BrowserWindow({
    width: 290,
    height: 350,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'controlcenter-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  ccWin.loadFile(path.join(__dirname, 'controlcenter.html'));

  ccWin.on('blur', () => {
    ccWin.hide();
  });

  ccWin.on('closed', () => {
    ccWin = null;
  });
}

function getWifiAdapterName() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve('Wi-Fi');
      return;
    }
    exec('netsh wlan show interfaces', (err, stdout) => {
      if (err || !stdout) {
        resolve('Wi-Fi');
        return;
      }
      const match = stdout.match(/Name\s*:\s*(.+)/);
      if (match && match[1]) {
        resolve(match[1].trim());
      } else {
        resolve('Wi-Fi');
      }
    });
  });
}

async function toggleWifi(on) {
  if (process.platform !== 'win32') return true;
  const name = await getWifiAdapterName();
  const state = on ? 'enabled' : 'disabled';
  return new Promise((resolve) => {
    exec(`netsh interface set interface name="${name}" admin=${state}`, (err) => {
      resolve(!err);
    });
  });
}

function getBluetoothState() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false);
      return;
    }
    exec('powershell -NoProfile -Command "Get-Service bthserv | Select-Object -ExpandProperty Status"', (err, stdout) => {
      if (err || !stdout) {
        resolve(false);
        return;
      }
      const isServiceRunning = stdout.trim().toLowerCase() === 'running';
      if (!isServiceRunning) {
        resolve(false);
        return;
      }
      exec('powershell -NoProfile -Command "Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq \'OK\' } | Measure-Object | Select-Object -ExpandProperty Count"', (err2, stdout2) => {
        if (err2 || !stdout2) {
          resolve(false);
          return;
        }
        const count = parseInt(stdout2.trim());
        resolve(count > 0);
      });
    });
  });
}

function toggleBluetooth(on) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(true);
      return;
    }
    const cmd = on
      ? `powershell -NoProfile -Command "Start-Service bthserv -ErrorAction SilentlyContinue; Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Enable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue"`
      : `powershell -NoProfile -Command "Get-PnpDevice -Class Bluetooth -ErrorAction SilentlyContinue | Disable-PnpDevice -Confirm:$false -ErrorAction SilentlyContinue"`;
    exec(cmd, (err) => {
      resolve(!err);
    });
  });
}

function getBrightness() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(80);
      return;
    }
    exec('powershell -NoProfile -Command "(Get-WmiObject -Namespace root\\wmi -Class WmiMonitorBrightness -ErrorAction SilentlyContinue).CurrentBrightness"', (err, stdout) => {
      if (err || !stdout) {
        resolve(80);
        return;
      }
      const val = parseInt(stdout.trim());
      resolve(isNaN(val) ? 80 : val);
    });
  });
}

function setBrightness(level) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(true);
      return;
    }
    exec(`powershell -NoProfile -Command "(Get-WmiObject -Namespace root\\wmi -Class WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue).WmiSetBrightness(1, ${level})"`, (err) => {
      resolve(!err);
    });
  });
}

let sysDataTick = 0;
let lastWifiSSID = '';
let lastBluetoothOn = false;
let lastBatteryPercent = 100;
let lastBatteryIsCharging = false;

let sysInfoMod = null;
async function pollSystemData() {
  try {
    if (!sysInfoMod) {
      sysInfoMod = require('systeminformation');
    }
    
    let ssid = '';
    try {
      const wifi = await sysInfoMod.wifiConnections();
      ssid = (wifi && wifi.length > 0) ? wifi[0].ssid : '';
    } catch (e) {}

    let bluetoothOn = false;
    try {
      bluetoothOn = await getBluetoothState();
    } catch (e) {}
    
    let batteryPercent = lastBatteryPercent;
    let batteryIsCharging = lastBatteryIsCharging;
    
    try {
      const battery = await sysInfoMod.battery();
      if (battery && battery.hasBattery) {
        batteryPercent = battery.percent;
        batteryIsCharging = battery.isCharging;
      }
    } catch (e) {}
    
    lastWifiSSID = ssid;
    lastBluetoothOn = bluetoothOn;
    lastBatteryPercent = batteryPercent;
    lastBatteryIsCharging = batteryIsCharging;
    
    const payload = {
      wifi: { ssid: lastWifiSSID, on: lastWifiSSID !== '' },
      bluetooth: { on: lastBluetoothOn },
      battery: { percent: lastBatteryPercent, isCharging: lastBatteryIsCharging }
    };
    
    if (menuBarWin && !menuBarWin.isDestroyed()) {
      menuBarWin.webContents.send('system-data-update', payload);
    }
    if (ccWin && !ccWin.isDestroyed() && ccWin.isVisible()) {
      ccWin.webContents.send('system-data-update', payload);
    }
  } catch (err) {
    console.error('System data polling error:', err);
  }
}

function startSystemDataPolling() {}

// IPC Handlers Registration
ipcMain.on('toggle-control-center', (event, rect) => {
  if (!ccWin) {
    createControlCenterWindow();
  }
  
  if (ccWin.isVisible()) {
    ccWin.hide();
  } else {
    const x = Math.round(rect.right - 290);
    const y = Math.round(rect.bottom + 4);
    ccWin.setBounds({ x, y, width: 290, height: 350 });
    ccWin.show();
    ccWin.focus();
  }
});

ipcMain.on('close-cc-window', () => {
  if (ccWin) ccWin.hide();
});

ipcMain.handle('get-volume', async () => {
  try {
    const loudness = require('loudness');
    return await loudness.getVolume();
  } catch (e) {
    return 50;
  }
});

ipcMain.on('set-volume', async (event, val) => {
  try {
    const loudness = require('loudness');
    await loudness.setVolume(val);
    if (menuBarWin && !menuBarWin.isDestroyed()) {
      menuBarWin.webContents.send('volume-sync', val);
    }
    if (ccWin && !ccWin.isDestroyed()) {
      ccWin.webContents.send('volume-sync', val);
    }
  } catch (e) {}
});

ipcMain.handle('get-brightness', async () => {
  return await getBrightness();
});

ipcMain.on('set-brightness', async (event, val) => {
  await setBrightness(val);
});

ipcMain.handle('toggle-wifi', async (event, on) => {
  const success = await toggleWifi(on);
  return { success };
});

ipcMain.handle('toggle-bluetooth', async (event, on) => {
  const success = await toggleBluetooth(on);
  return { success };
});

ipcMain.handle('get-dnd', () => {
  return dndActive;
});

ipcMain.on('set-dnd', (event, on) => {
  dndActive = on;
});

ipcMain.handle('spotlight-search', async (event, query) => {
  if (!query || query.trim() === '') {
    return { apps: [], files: [] };
  }
  
  const queryLower = query.toLowerCase().trim();
  const matchedApps = [];
  
  if (fs.existsSync(appsJsonPath)) {
    try {
      const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
      const appsData = JSON.parse(raw);
      const allApps = [...(appsData.apps || []), ...(appsData.custom || [])];
      for (const app of allApps) {
        if (app.name && app.name.toLowerCase().includes(queryLower)) {
          matchedApps.push(app);
          if (matchedApps.length >= 5) break;
        }
      }
    } catch (e) {}
  }
  
  const matchedFiles = [];
  try {
    const homeDir = app.getPath('home');
    const dirs = [
      path.join(homeDir, 'Desktop'),
      path.join(homeDir, 'Documents')
    ];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.toLowerCase().includes(queryLower)) {
          matchedFiles.push({
            name: file,
            path: path.join(dir, file)
          });
          if (matchedFiles.length >= 5) break;
        }
      }
      if (matchedFiles.length >= 5) break;
    }
  } catch (e) {}
  
  return { apps: matchedApps, files: matchedFiles };
});

ipcMain.handle('open-file', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('export-settings', async () => {
  const result = await dialog.showSaveDialog({
    title: 'Export Settings',
    defaultPath: 'settings_backup.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });
  if (result.canceled || !result.filePath) return { success: false };
  try {
    let appsData = {};
    if (fs.existsSync(appsJsonPath)) {
      const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
      appsData = JSON.parse(raw);
    }
    const backup = {
      type: 'macos-dock-backup',
      version: '1.0.0',
      settings: settings,
      apps: appsData,
      config: config
    };
    await fs.promises.writeFile(result.filePath, JSON.stringify(backup, null, 2), 'utf8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('import-settings', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Import Settings',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return { success: false };
  try {
    const raw = await fs.promises.readFile(result.filePaths[0], 'utf8');
    const backup = JSON.parse(raw);
    if (backup.type !== 'macos-dock-backup' || !backup.settings || !backup.config) {
      return { success: false, error: 'Invalid settings backup schema.' };
    }
    
    const timestamp = Date.now();
    if (fs.existsSync(settingsPath)) {
      await fs.promises.copyFile(settingsPath, `${settingsPath}.bak_${timestamp}`);
    }
    if (fs.existsSync(appsJsonPath)) {
      await fs.promises.copyFile(appsJsonPath, `${appsJsonPath}.bak_${timestamp}`);
    }
    if (fs.existsSync(configPath)) {
      await fs.promises.copyFile(configPath, `${configPath}.bak_${timestamp}`);
    }
    
    settings = backup.settings;
    config = backup.config;
    await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    if (backup.apps && Object.keys(backup.apps).length > 0) {
      await fs.promises.writeFile(appsJsonPath, JSON.stringify(backup.apps, null, 2), 'utf8');
    }
    
    if (menuBarWin && !menuBarWin.isDestroyed()) menuBarWin.reload();
    if (dockWin && !dockWin.isDestroyed()) dockWin.reload();
    if (drawerWin && !drawerWin.isDestroyed()) drawerWin.reload();
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.reload();
    if (ccWin && !ccWin.isDestroyed()) ccWin.reload();
    
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.on('add-to-dock', async (event, appId, appInfo) => {
  try {
    await loadConfig();
    if (!config.pinned.includes(appId)) {
      config.pinned.push(appId);
    }
    
    config.apps = config.apps || {};
    if (!config.apps[appId]) {
      const exeName = path.basename(appInfo.exec || appInfo.win);
      config.apps[appId] = {
        name: appInfo.name,
        win: exeName,
        mac: '',
        process: exeName
      };
    }
    
    await saveConfig(); // [FIX] Replaced raw fs.writeFileSync with saveConfig()
    await broadcastConfigUpdate();
  } catch (err) {
    console.error('Failed to add to dock:', err);
  }
});

ipcMain.on('remove-from-dock', async (event, appId) => {
  try {
    await loadConfig();
    config.pinned = config.pinned.filter(id => id !== appId);
    await saveConfig(); // [FIX] Replaced raw fs.writeFileSync with saveConfig()
    await broadcastConfigUpdate();
  } catch (err) {
    console.error('Failed to remove from dock:', err);
  }
});

ipcMain.on('keep-in-dock', async (event, appId) => {
  try {
    await loadConfig();
    if (!config.pinned.includes(appId)) {
      config.pinned.push(appId);
      
      if (fs.existsSync(appsJsonPath)) {
        try {
          const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
          const appsData = JSON.parse(raw);
          const allApps = [...(appsData.apps || []), ...(appsData.custom || [])];
          const app = allApps.find(a => a.id === appId);
          if (app) {
            config.apps = config.apps || {};
            const exeName = path.basename(app.exec);
            config.apps[appId] = {
              name: app.name,
              win: exeName,
              mac: '',
              process: exeName,
              iconPath: app.iconPath || ''
            };
          }
        } catch (e) {
          console.error('Failed to read apps.json for keep-in-dock:', e);
        }
      }
    }
    await saveConfig(); // [FIX] Replaced raw fs.writeFileSync with saveConfig()
    await broadcastConfigUpdate();
  } catch (err) {
    console.error('Failed to keep in dock:', err);
  }
});

ipcMain.on('set-badge', async (event, appId, count) => {
  try {
    await loadConfig();
    config.badges = config.badges || {};
    if (count <= 0) {
      delete config.badges[appId];
    } else {
      config.badges[appId] = count;
    }
    await saveConfig(); // [FIX] Replaced raw fs.writeFileSync with saveConfig()
    await broadcastConfigUpdate();
  } catch (err) {
    console.error('Failed to set badge:', err);
  }
});

async function broadcastConfigUpdate() {
  if (dockWin && !dockWin.isDestroyed()) {
    let appIconsMap = {};
    try {
      if (fs.existsSync(appsJsonPath)) {
        const raw = await fs.promises.readFile(appsJsonPath, 'utf8');
        const data = JSON.parse(raw);
        const allApps = [...(data.apps || []), ...(data.custom || [])];
        for (const app of allApps) {
          if (app.iconPath) {
            appIconsMap[app.id] = app.iconPath;
          }
        }
      }
    } catch (e) {}
    dockWin.webContents.send('config-changed', { config, appIconsMap });
  }
}

// ==========================================
// CENTERED SPOTLIGHT SEARCH WINDOW
// ==========================================
let spotlightWin = null;

function createSpotlightWindow() {
  if (spotlightWin) return;
  
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
  const winWidth = 600;
  const winHeight = 400;
  const x = Math.round((screenWidth - winWidth) / 2);
  const y = Math.round((screenHeight - winHeight) / 3);

  spotlightWin = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'spotlight-preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  spotlightWin.loadFile(path.join(__dirname, 'spotlight.html'));

  spotlightWin.on('blur', () => {
    spotlightWin.hide();
  });

  spotlightWin.on('closed', () => {
    spotlightWin = null;
  });
}

function toggleSpotlight() {
  if (!spotlightWin) {
    createSpotlightWindow();
  }
  
  if (spotlightWin.isVisible()) {
    spotlightWin.hide();
  } else {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;
    const winWidth = 600;
    const winHeight = 400;
    const x = Math.round((screenWidth - winWidth) / 2);
    const y = Math.round((screenHeight - winHeight) / 3);
    spotlightWin.setBounds({ x, y, width: winWidth, height: winHeight });
    
    spotlightWin.show();
    spotlightWin.focus();
    spotlightWin.webContents.send('focus-input');
  }
}

ipcMain.on('toggle-spotlight', () => {
  toggleSpotlight();
});

ipcMain.on('close-spotlight', () => {
  if (spotlightWin) spotlightWin.hide();
});

