const { exec } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

let isHidden = false;
let restoreScriptPath = null;

const TASKBAR_CLASSES = ['Shell_TrayWnd', 'Shell_SecondaryTrayWnd'];
const SW_HIDE = 0;
const SW_SHOW = 1;

function getCSharpTypeDef() {
  return [
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class Taskbar {',
    '  [DllImport("user32.dll", CharSet = CharSet.Unicode)]',
    '  public static extern IntPtr FindWindow(string cls, string win);',
    '  [DllImport("user32.dll")]',
    '  public static extern int ShowWindow(IntPtr h, int c);',
    '}'
  ].join('\n');
}

function getPsScriptContent(show) {
  const cmdVal = show ? SW_SHOW : SW_HIDE;
  const calls = TASKBAR_CLASSES.map(c =>
    `[Taskbar]::ShowWindow([Taskbar]::FindWindow('${c}', $null), ${cmdVal})`
  ).join('\n');
  return [
    'Add-Type -TypeDefinition @"',
    getCSharpTypeDef(),
    '"@',
    calls,
    ''
  ].join('\n');
}

function getRestorePowerShellContent() {
  const calls = TASKBAR_CLASSES.map(c =>
    `[Taskbar]::ShowWindow([Taskbar]::FindWindow('${c}', $null), ${SW_SHOW})`
  ).join('\n');
  return [
    'Add-Type -TypeDefinition @"',
    getCSharpTypeDef(),
    '"@',
    calls,
    ''
  ].join('\n');
}

function getRestoreBatchContent() {
  return [
    '@echo off',
    'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0restore-taskbar.ps1"',
    'echo Taskbar restore command executed.',
    'pause',
    ''
  ].join('\r\n');
}

function runTaskbarScript(show) {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false);
      return;
    }
    const tmpDir = require('electron').app ? require('electron').app.getPath('temp') : (process.env.TEMP || __dirname);
    const tmpScript = path.join(tmpDir, '_dock_taskbar.ps1');
    const content = getPsScriptContent(show);
    fs.promises.writeFile(tmpScript, content, 'utf8').then(() => {
      exec(
        `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpScript}"`,
        { timeout: 15000 },
        async (err) => {
          try { await fs.promises.unlink(tmpScript); } catch (e) {}
          if (err) {
            const msg = err.message || String(err);
            console.error('[TaskbarReplacement] script error:', msg);
            resolve(false);
          } else {
            resolve(true);
          }
        }
      );
    }).catch((writeErr) => {
      console.error('[TaskbarReplacement] failed to write temp script:', writeErr);
      resolve(false);
    });
  });
}

function writeRestoreScript(targetDir) {
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const psPath = path.join(targetDir, 'restore-taskbar.ps1');
    const batPath = path.join(targetDir, 'restore-taskbar.bat');
    const psContent = getRestorePowerShellContent();
    const batContent = getRestoreBatchContent();
    fs.writeFileSync(psPath, psContent, 'utf8');
    fs.writeFileSync(batPath, batContent, 'utf8');
    restoreScriptPath = batPath;
    return batPath;
  } catch (err) {
    console.error('[TaskbarReplacement] Failed to write restore script:', err);
    return null;
  }
}

function isTaskbarHidden() {
  return isHidden;
}

function hideTaskbar() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false);
      return;
    }
    isHidden = true;
    runTaskbarScript(false).then((success) => {
      if (!success) {
        isHidden = false;
      }
      resolve(success);
    });
  });
}

function showTaskbar() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false);
      return;
    }
    runTaskbarScript(true).then((success) => {
      isHidden = false;
      resolve(success);
    });
  });
}

function restoreTaskbarSafe() {
  try {
    showTaskbar().catch(() => {});
    isHidden = false;
  } catch (err) {
    console.error('[TaskbarReplacement] restoreTaskbarSafe error:', err);
  }
}

function getRestoreScriptPath() {
  return restoreScriptPath;
}

function getRestoreScriptContent() {
  return getRestoreBatchContent();
}

module.exports = {
  hideTaskbar,
  showTaskbar,
  isTaskbarHidden,
  restoreTaskbarSafe,
  writeRestoreScript,
  getRestoreScriptPath,
  getRestoreScriptContent,
  getRestorePowerShellContent
};
