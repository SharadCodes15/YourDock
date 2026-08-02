const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFile } = require('node:child_process');

test('wallpaperPinner - C# helper references the correct Win32 wallpaper APIs', () => {
  const { getCSharpTypeDef } = require('../src/main/widgets/wallpaperPinner');
  const def = getCSharpTypeDef();

  assert.ok(def.includes('public class WallpaperPin'));
  assert.ok(def.includes('FindWindow("Progman"'));
  assert.ok(def.includes('WorkerW'));
  assert.ok(def.includes('SHELLDLL_DefView'));
  assert.ok(def.includes('0x052C'));       // WM_SPAWNWORKERW
  assert.ok(def.includes('SetParent'));
  assert.ok(def.includes('SetWindowLongPtr'));
  assert.ok(def.includes('SetWindowPos'));
  assert.ok(!def.includes('${'));
});

test('wallpaperPinner - generated PowerShell script is well-formed', () => {
  const { buildPsScript } = require('../src/main/widgets/wallpaperPinner');
  const content = buildPsScript('00000000001A2B3C');

  assert.ok(content.startsWith('Add-Type -TypeDefinition @"'));
  assert.ok(content.includes('"@'));
  assert.ok(content.includes("[WallpaperPin]::Pin('00000000001A2B3C')"));
  assert.ok(!content.includes('${'));
});

test('wallpaperPinner - C# type definition compiles via Add-Type (win32 only)', { skip: process.platform !== 'win32' }, (t, done) => {
  const { getCSharpTypeDef } = require('../src/main/widgets/wallpaperPinner');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallpaper-test-'));
  const psPath = path.join(tmpDir, 'compile.ps1');
  const script = [
    'Add-Type -TypeDefinition @"',
    getCSharpTypeDef(),
    '"@',
    "if (-not ('WallpaperPin' -as [type])) { exit 1 }",
    'exit 0'
  ].join('\n');
  fs.writeFileSync(psPath, script, 'utf8');

  const timer = setTimeout(() => {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
    done(new Error('Add-Type compile timed out'));
  }, 60000);

  execFile('powershell', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psPath], { timeout: 50000 }, (err) => {
    clearTimeout(timer);
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
    if (err) {
      done(new Error('Add-Type failed: ' + err.message));
      return;
    }
    done();
  });
});
