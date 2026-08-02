const { exec } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * WALLPAPER PINNER (Windows)
 *
 * Parents the widget host window to the desktop's wallpaper WorkerW so widgets
 * live behind every app (wallpaper / "z-index -1") instead of overlapping them.
 *
 * Uses the same PowerShell + embedded C# P/Invoke pattern as taskbarReplacement.js
 * so no native npm dependency is required. Failure is non-fatal: the host window
 * simply stays a normal transparent window (current behaviour) with a moveBottom
 * fallback so it still sinks below regular app windows.
 */

const WS_CHILD = 0x40000000;
function getCSharpTypeDef() {
  return [
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class WallpaperPin {',
    '  [DllImport("user32.dll", CharSet = CharSet.Unicode)]',
    '  public static extern IntPtr FindWindow(string cls, string win);',
    '  [DllImport("user32.dll")]',
    '  public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string cls, string win);',
    '  [DllImport("user32.dll")]',
    '  public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);',
    '  [DllImport("user32.dll", SetLastError = true)]',
    '  public static extern bool SetParent(IntPtr h, IntPtr p);',
    '  [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr", SetLastError = true)]',
    '  public static extern IntPtr SetWindowLongPtr(IntPtr h, int i, IntPtr v);',
    '  [DllImport("user32.dll", SetLastError = true)]',
    '  public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);',
    '  public static int Pin(string hwndHex) {',
    '    IntPtr target;',
    '    try { target = new IntPtr(Convert.ToInt64(hwndHex, 16)); } catch { return 0; }',
    '    IntPtr progman = FindWindow("Progman", null);',
    '    if (progman == IntPtr.Zero) return 0;',
    '    SendMessage(progman, 0x052C, IntPtr.Zero, IntPtr.Zero);',
    '    IntPtr defViewWorker = IntPtr.Zero;',
    '    IntPtr w = IntPtr.Zero;',
    '    while ((w = FindWindowEx(IntPtr.Zero, w, "WorkerW", null)) != IntPtr.Zero) {',
    '      if (FindWindowEx(w, IntPtr.Zero, "SHELLDLL_DefView", null) != IntPtr.Zero) { defViewWorker = w; break; }',
    '    }',
    '    if (defViewWorker == IntPtr.Zero) return 0;',
    '    IntPtr host = IntPtr.Zero;',
    '    IntPtr w2 = IntPtr.Zero;',
    '    bool past = false;',
    '    while ((w2 = FindWindowEx(IntPtr.Zero, w2, "WorkerW", null)) != IntPtr.Zero) {',
    '      if (past) { host = w2; break; }',
    '      if (w2 == defViewWorker) past = true;',
    '    }',
    '    if (host == IntPtr.Zero) host = defViewWorker;',
    '    SetParent(target, host);',
    '    SetWindowLongPtr(target, -16, new IntPtr(' + WS_CHILD + '));',
    '    SetWindowPos(target, IntPtr.Zero, 0, 0, 0, 0, 0x0040 | 0x0020 | 0x0001 | 0x0002);',
    '    return 1;',
    '  }',
    '}'
  ].join('\n');
}

function buildPsScript(hwndHex) {
  return [
    'Add-Type -TypeDefinition @"',
    getCSharpTypeDef(),
    '"@',
    "[WallpaperPin]::Pin('" + hwndHex + "')",
    ''
  ].join('\n');
}

function pinWindowToWallpaper(win) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32' || !win || win.isDestroyed()) {
      resolve(false);
      return;
    }
    try {
      const hwndBuf = win.getNativeWindowHandle();
      if (!hwndBuf || hwndBuf.length === 0) {
        resolve(false);
        return;
      }
      const hwndHex = hwndBuf.length >= 8
        ? hwndBuf.readBigUInt64LE(0).toString(16)
        : hwndBuf.readUInt32LE(0).toString(16);

      const tmpDir = require('electron').app.getPath('temp');
      const tmpScript = path.join(tmpDir, '_dock_wallpaper.ps1');
      fs.promises.writeFile(tmpScript, buildPsScript(hwndHex), 'utf8').then(() => {
        exec(
          `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpScript}"`,
          { timeout: 15000 },
          async (err) => {
            try { await fs.promises.unlink(tmpScript); } catch (e) {}
            if (err) {
              console.error('[Wallpaper] pin error:', err.message);
              resolve(false);
              return;
            }
            resolve(true);
          }
        );
      }).catch((writeErr) => {
        console.error('[Wallpaper] failed to write temp script:', writeErr);
        resolve(false);
      });
    } catch (err) {
      console.error('[Wallpaper] pinWindowToWallpaper error:', err.message);
      resolve(false);
    }
  });
}

module.exports = { pinWindowToWallpaper, getCSharpTypeDef, buildPsScript };
