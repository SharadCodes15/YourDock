const { exec } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

let settingsRef = null;
let isEnabled = false;

const MENUBAR_HEIGHT = 28;

function initialize(opts) {
  settingsRef = opts.getSettings || (() => ({}));
  isEnabled = opts.enabled !== false;
}

function setEnabled(val) {
  isEnabled = val;
}

function isConstrainingEnabled() {
  return isEnabled;
}

function getSafeAreaBounds() {
  if (!settingsRef) return null;
  const s = settingsRef();
  const primaryDisplay = require('electron').screen.getPrimaryDisplay();
  const { x: dx, y: dy, width: screenW, height: screenH } = primaryDisplay.bounds;

  const dockHideSettings = s.dockHideSettings || {};
  const menuBarHideSettings = s.menuBarHideSettings || {};
  const hiding = s.hiding || {};

  const dockEnabled = dockHideSettings.enabled !== false;
  const menuBarEnabled = menuBarHideSettings.enabled !== false;

  const globalHideOff = !hiding.enabled;
  const menuBarAlwaysVisible = !menuBarEnabled || globalHideOff;
  const dockAlwaysVisible = !dockEnabled || globalHideOff;

  if (!menuBarAlwaysVisible && !dockAlwaysVisible) {
    return null;
  }

  let top = dy;
  let bottom = dy + screenH;
  let left = dx;
  let right = dx + screenW;

  if (menuBarAlwaysVisible) {
    top = dy + MENUBAR_HEIGHT;
  }

  const dockPos = (s.general && s.general.dockPosition) || 'bottom';
  const dockThickness = getDockThickness(s);

  if (dockAlwaysVisible) {
    if (dockPos === 'bottom') {
      bottom = dy + screenH - dockThickness;
    } else if (dockPos === 'left') {
      left = dx + dockThickness;
    } else if (dockPos === 'right') {
      right = dx + screenW - dockThickness;
    }
  }

  if (top >= bottom || left >= right) return null;

  const bounds = { x: left, y: top, width: right - left, height: bottom - top };
  console.log('[WindowManager] Safe area:', JSON.stringify(bounds));
  return bounds;
}

function getDockThickness(settings) {
  const sizePreset = (settings.general && settings.general.dockSize) || 'medium';
  if (sizePreset === 'small') return 62;
  if (sizePreset === 'large') return 102;
  return 82;
}

function constrainWindow(processName) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' || !processName || !isEnabled) {
      resolve(false);
      return;
    }

    const safeArea = getSafeAreaBounds();
    if (!safeArea) {
      console.log('[WindowManager] No safe area — skipping constrain');
      resolve(false);
      return;
    }

    const proc = processName.replace(/\.exe$/i, '').toLowerCase();
    const tmpScript = path.join(require('electron').app.getPath('temp'), '_dock_constrain.ps1');
    const psContent = buildPsScript(proc, safeArea);

    let attempts = 0;
    const maxAttempts = 5;

    function tryConstrain() {
      attempts++;
      fs.promises.writeFile(tmpScript, psContent, 'utf8').then(() => {
        exec(
          `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpScript}"`,
          { timeout: 10000 },
          async (err, stdout, stderr) => {
            try { await fs.promises.unlink(tmpScript); } catch (e) {}
            if (err) {
              if (stderr) console.error('[WindowManager] PS stderr:', stderr);
              if (attempts < maxAttempts) {
                setTimeout(tryConstrain, 2000);
              } else {
                console.error('[WindowManager] constrain failed after', maxAttempts, 'attempts:', err.message);
                resolve(false);
              }
            } else {
              if (stdout.trim()) console.log('[WindowManager] PS output:', stdout.trim());
              resolve(true);
            }
          }
        );
      }).catch(() => {
        if (attempts < maxAttempts) {
          setTimeout(tryConstrain, 2000);
        } else {
          resolve(false);
        }
      });
    }

    setTimeout(tryConstrain, 2000);
  });
}

function buildPsScript(proc, safeArea) {
  return [
    `$ErrorActionPreference = 'SilentlyContinue'`,
    `$p = Get-Process -Name '${proc}' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } | Select-Object -First 1`,
    `if (-not $p) { exit 1 }`,
    `$h = $p.MainWindowHandle`,
    `$sig = @'`,
    `  using System;`,
    `  using System.Runtime.InteropServices;`,
    `  public class W32 {`,
    `    [DllImport("user32.dll")]`,
    `    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);`,
    `    [DllImport("user32.dll")]`,
    `    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);`,
    `    [StructLayout(LayoutKind.Sequential)]`,
    `    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }`,
    `  }`,
    `'@`,
    `Add-Type -TypeDefinition $sig -ErrorAction SilentlyContinue | Out-Null`,
    `$rect = New-Object W32+RECT`,
    `if ([W32]::GetWindowRect($h, [ref]$rect)) {`,
    `  $w = $rect.Right - $rect.Left`,
    `  $h2 = $rect.Bottom - $rect.Top`,
    `  $newW = [Math]::Min($w, ${safeArea.width})`,
    `  $newH = [Math]::Min($h2, ${safeArea.height})`,
    `  $newX = ${safeArea.x} + ([Math]::Max(0, ${safeArea.width} - $newW) / 2)`,
    `  $newY = ${safeArea.y} + ([Math]::Max(0, ${safeArea.height} - $newH) / 2)`,
    `  $swpNoZOrder = 0x0004`,
    `  [W32]::SetWindowPos($h, [IntPtr]::Zero, [int]$newX, [int]$newY, $newW, $newH, $swpNoZOrder) | Out-Null`,
    `  Write-Output "moved"`,
    `} else {`,
    `  exit 2`,
    `}`
  ].join('\n');
}

module.exports = {
  initialize,
  setEnabled,
  isConstrainingEnabled,
  getSafeAreaBounds,
  constrainWindow
};
