const { exec } = require('child_process');

let lastFocusedExternalWindow = null;

// Track active window: call this from pollActiveApp when a change is detected
function updateLastFocusedWindow(activeWindow) {
  if (!activeWindow || !activeWindow.owner) return;

  const ownerPath = (activeWindow.owner.path || '').toLowerCase();
  const ownerName = (activeWindow.owner.name || '').toLowerCase();
  const title = (activeWindow.title || '').toLowerCase();

  // Skip this app's own windows
  const isOwnApp = ownerName.includes('electron') || 
                    ownerPath.includes('electron.exe') ||
                    title.includes('menu bar settings') ||
                    title.includes('launcher') ||
                    title.includes('control center') ||
                    title.includes('spotlight') ||
                    title.includes('about this mac') ||
                    title.includes('force quit applications') ||
                    title.includes('macos-top-menu-bar');

  // Skip system windows like Explorer shell (desktop/taskbar), Task Manager, conhost, etc.
  const isSystemApp = ownerName === 'explorer.exe' || 
                      ownerName === 'taskmgr.exe' || 
                      ownerName === 'shellexperiencehost.exe' ||
                      ownerName === 'searchhost.exe' ||
                      ownerName === 'conhost.exe';

  if (!isOwnApp && !isSystemApp && activeWindow.title) {
    lastFocusedExternalWindow = {
      id: activeWindow.id, // HWND on Windows
      processId: activeWindow.owner.processId,
      title: activeWindow.title,
      processName: activeWindow.owner.name
    };
  }
}

// Refocus last external window using PowerShell, then execute callback
function refocusAndExecute(callback) {
  if (!lastFocusedExternalWindow) {
    return Promise.resolve({ success: false, reason: 'no_active_app' });
  }

  const hwnd = lastFocusedExternalWindow.id;
  
  // PowerShell to restore and bring the window to the foreground
  const psScript = `
    $sig = '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);';
    $t = Add-Type -MemberDefinition $sig -Name 'WU' -Namespace 'W32' -PassThru -ErrorAction SilentlyContinue;
    if ($t) {
      $t::ShowWindow([IntPtr]${hwnd}, 9); // 9 = SW_RESTORE
      $t::SetForegroundWindow([IntPtr]${hwnd});
    }
  `.replace(/\r?\n/g, ' ').trim();

  return new Promise((resolve) => {
    exec(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`, (err) => {
      if (err) {
        console.error('Failed to refocus window via PowerShell:', err);
        return resolve({ success: false, reason: 'error', error: err.message });
      }

      // Wait 100ms for focus switch to settle before running callback
      setTimeout(async () => {
        try {
          await callback();
          resolve({ success: true });
        } catch (callbackErr) {
          console.error('Focus Forwarder callback failed:', callbackErr);
          resolve({ success: false, reason: 'callback_error', error: callbackErr.message });
        }
      }, 100);
    });
  });
}

// Map key string to nut-js Key constant
function mapKeyString(keyStr) {
  const { Key } = require('@nut-tree-fork/nut-js');
  const k = keyStr.toLowerCase();
  switch (k) {
    case 'ctrl':
    case 'control': return Key.LeftControl;
    case 'shift': return Key.LeftShift;
    case 'alt': return Key.LeftAlt;
    case 'n': return Key.N;
    case 'o': return Key.O;
    case 's': return Key.S;
    case 'p': return Key.P;
    case 'w': return Key.W;
    case 'z': return Key.Z;
    case 'y': return Key.Y;
    case 'x': return Key.X;
    case 'c': return Key.C;
    case 'v': return Key.V;
    case 'a': return Key.A;
    case 'f': return Key.F;
    case 'f1': return Key.F1;
    case 'plus':
    case 'equal': return Key.Equal;
    case 'minus': return Key.Minus;
    case '0': return Key.Num0;
    default:
      const matchName = Object.keys(Key).find(name => name.toLowerCase() === k);
      if (matchName) return Key[matchName];
      return null;
  }
}

// Forward simulated shortcut
async function forwardShortcut(comboStr) {
  return refocusAndExecute(async () => {
    try {
      const { keyboard, Key } = require('@nut-tree-fork/nut-js');
      const keys = comboStr.split('+').map(k => mapKeyString(k.trim())).filter(k => k !== null);
      if (keys.length === 0) return;
      
      const modifiers = [];
      let regularKey = null;

      for (const key of keys) {
        if (key === Key.LeftControl || key === Key.LeftShift || key === Key.LeftAlt) {
          modifiers.push(key);
        } else {
          regularKey = key;
        }
      }

      if (regularKey) {
        // Press modifiers
        for (const mod of modifiers) {
          await keyboard.pressKey(mod);
        }
        // Tap regular key
        await keyboard.type(regularKey);
        // Release modifiers
        for (const mod of modifiers) {
          await keyboard.releaseKey(mod);
        }
      }
    } catch (err) {
      if (global.DEBUG) {
        console.error('[DEBUG] Failed to send simulated keys:', err);
      }
    }
  });
}

// Direct Window Actions (Minimize / Maximize)
async function performWindowAction(action) {
  if (!lastFocusedExternalWindow) {
    return { success: false, reason: 'no_active_app' };
  }

  const hwnd = lastFocusedExternalWindow.id;
  let psScript = '';

  if (action === 'minimize') {
    psScript = `
      $sig = '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);';
      $t = Add-Type -MemberDefinition $sig -Name 'WU' -Namespace 'W32' -PassThru -ErrorAction SilentlyContinue;
      if ($t) { $t::ShowWindow([IntPtr]${hwnd}, 6); }
    `;
  } else if (action === 'maximize') {
    psScript = `
      $sig = @'
      [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
      [DllImport("user32.dll")] public static extern bool GetWindowPlacement(IntPtr hWnd, ref WINDOWPLACEMENT lpwpl);
      public struct POINT { public int X; public int Y; }
      public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
      public struct WINDOWPLACEMENT {
          public int length;
          public int flags;
          public int showCmd;
          public POINT ptMinPosition;
          public POINT ptMaxPosition;
          public RECT rcNormalPosition;
      }
      '@;
      $t = Add-Type -MemberDefinition $sig -Name 'WU' -Namespace 'W32' -PassThru -ErrorAction SilentlyContinue;
      if ($t) {
        $wp = New-Object WU+WINDOWPLACEMENT;
        $wp.length = [System.Runtime.InteropServices.Marshal]::SizeOf($wp);
        [void]$t::GetWindowPlacement([IntPtr]${hwnd}, [ref]$wp);
        if ($wp.showCmd -eq 3) {
          $t::ShowWindow([IntPtr]${hwnd}, 9); // SW_RESTORE
        } else {
          $t::ShowWindow([IntPtr]${hwnd}, 3); // SW_MAXIMIZE
        }
      }
    `;
  }

  psScript = psScript.replace(/\r?\n/g, ' ').trim();

  return new Promise((resolve) => {
    exec(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`, (err) => {
      if (err) {
        console.error(`Failed to perform ${action} on window via PowerShell:`, err);
        return resolve({ success: false, reason: 'error', error: err.message });
      }
      resolve({ success: true });
    });
  });
}

module.exports = {
  updateLastFocusedWindow,
  forwardShortcut,
  performWindowAction,
  getLastFocusedWindow: () => lastFocusedExternalWindow
};
