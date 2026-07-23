const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

test('taskbar - restore batch script references ps1 file with no variable interpolation', () => {
  const { getRestoreScriptContent } = require('../taskbarReplacement');
  const content = getRestoreScriptContent();

  assert.ok(content.startsWith('@echo off'));
  assert.ok(content.includes('restore-taskbar.ps1'));
  assert.ok(!content.includes('${'));
  assert.ok(!content.includes('APPDATA'));
  assert.ok(!content.includes('USERPROFILE'));
});

test('taskbar - restore ps1 script has static C# type definition with correct class names', () => {
  const { getRestorePowerShellContent } = require('../taskbarReplacement');
  const content = getRestorePowerShellContent();

  assert.ok(content.includes('Shell_TrayWnd'));
  assert.ok(content.includes('Shell_SecondaryTrayWnd'));
  assert.ok(content.includes('Add-Type'));
  assert.ok(content.includes('FindWindow'));
  assert.ok(content.includes('ShowWindow'));
  assert.ok(!content.includes('${'));
});

test('taskbar - restore script is writable to disk', () => {
  const { writeRestoreScript } = require('../taskbarReplacement');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskbar-test-'));
  try {
    const scriptPath = writeRestoreScript(tmpDir);
    assert.ok(scriptPath);
    assert.ok(fs.existsSync(scriptPath));
    assert.ok(fs.existsSync(path.join(tmpDir, 'restore-taskbar.ps1')));
    const batContent = fs.readFileSync(scriptPath, 'utf8');
    assert.ok(batContent.includes('@echo off'));
    const psContent = fs.readFileSync(path.join(tmpDir, 'restore-taskbar.ps1'), 'utf8');
    assert.ok(psContent.includes('Shell_TrayWnd'));
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
  }
});

test('taskbar - isTaskbarHidden returns boolean', () => {
  const { isTaskbarHidden } = require('../taskbarReplacement');
  const result = isTaskbarHidden();
  assert.equal(typeof result, 'boolean');
});
