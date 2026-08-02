const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { runStartupHealthCheck } = require('../healthCheck');
const { VALID_IPC_CHANNELS } = require('../src/shared/constants');

test('healthCheck - runStartupHealthCheck executes all 4 checks and returns expected shape', () => {
  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'dock-health-test-'));

  // Create valid sample JSON files
  fs.writeFileSync(path.join(tmpUserData, 'settings.json'), JSON.stringify({ general: {} }));
  fs.writeFileSync(path.join(tmpUserData, 'config.json'), JSON.stringify({ pinned: [] }));
  fs.writeFileSync(path.join(tmpUserData, 'apps.json'), JSON.stringify({ apps: [] }));
  fs.writeFileSync(path.join(tmpUserData, 'widgets.json'), JSON.stringify({ widgets: [] }));

  // Mock ipcMain with all valid channels registered
  const mockIpcMain = {
    eventNames: () => Array.from(VALID_IPC_CHANNELS),
    _invokeHandlers: new Map()
  };

  const result = runStartupHealthCheck({
    userDataPath: tmpUserData,
    ipcMain: mockIpcMain,
    settings: { general: {} }
  });

  assert.equal(typeof result.success, 'boolean');
  assert.equal(typeof result.durationMs, 'number');
  assert.ok(Array.isArray(result.checks));
  assert.equal(result.checks.length, 4);

  // Clean up
  fs.rmSync(tmpUserData, { recursive: true, force: true });
});

test('healthCheck - flags corrupted JSON config file', () => {
  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'dock-health-corrupt-'));

  fs.writeFileSync(path.join(tmpUserData, 'settings.json'), '{ invalid json ...');

  const mockIpcMain = {
    eventNames: () => Array.from(VALID_IPC_CHANNELS),
    _invokeHandlers: new Map()
  };

  const result = runStartupHealthCheck({
    userDataPath: tmpUserData,
    ipcMain: mockIpcMain,
    settings: { general: {} }
  });

  assert.equal(result.success, false);
  assert.ok(result.issues.some(i => i.includes('settings.json')));

  const configCheck = result.checks.find(c => c.id === 'config_files');
  assert.equal(configCheck.status, 'fail');

  fs.rmSync(tmpUserData, { recursive: true, force: true });
});

test('healthCheck - flags orphaned IPC channels missing listeners', () => {
  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'dock-health-ipc-'));

  // Mock ipcMain with NO channels registered
  const mockIpcMain = {
    eventNames: () => [],
    _invokeHandlers: new Map()
  };

  const result = runStartupHealthCheck({
    userDataPath: tmpUserData,
    ipcMain: mockIpcMain,
    settings: { general: {} }
  });

  assert.equal(result.success, false);
  assert.ok(result.issues.some(i => i.includes('orphaned IPC channel')));

  const ipcCheck = result.checks.find(c => c.id === 'ipc_registry');
  assert.equal(ipcCheck.status, 'fail');

  fs.rmSync(tmpUserData, { recursive: true, force: true });
});
