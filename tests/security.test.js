const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { VALID_IPC_CHANNELS, containsDangerousKeys, safeParseJSON, validateFilePath } = require('../src/shared/constants');

test('security - IPC channel whitelist contains core channels', () => {
  assert.ok(VALID_IPC_CHANNELS.has('get-settings'));
  assert.ok(VALID_IPC_CHANNELS.has('save-settings'));
  assert.ok(VALID_IPC_CHANNELS.has('force-quit-app'));
  assert.ok(VALID_IPC_CHANNELS.has('launch-app'));
  assert.ok(VALID_IPC_CHANNELS.has('spotlight-search'));
  assert.ok(!VALID_IPC_CHANNELS.has('malicious-unregistered-channel'));
});

test('security - prototype pollution detector flags dangerous keys', () => {
  assert.equal(containsDangerousKeys({ safeKey: 'value' }), false);
  assert.equal(containsDangerousKeys(JSON.parse('{"__proto__": {"admin": true}}')), true);
  assert.equal(containsDangerousKeys(JSON.parse('{"constructor": {"prototype": {"polluted": true}}}')), true);

  const safeObject = safeParseJSON('{"theme": "dark", "blur": 12}');
  assert.equal(safeObject.theme, 'dark');

  assert.throws(() => {
    safeParseJSON('{"__proto__": {"admin": true}}');
  }, /Security Error/);
});

test('security - validateFilePath validates absolute paths and blocks null bytes', () => {
  const samplePath = path.join(__dirname, 'security.test.js');
  const validated = validateFilePath(samplePath, ['.js']);
  assert.equal(validated, samplePath);

  assert.throws(() => {
    validateFilePath(samplePath, ['.json']);
  }, /Invalid file extension/);

  assert.throws(() => {
    validateFilePath('file\0path.exe');
  }, /Null bytes not allowed/);
});

test('security - force-quit process name sanitization and validation logic', () => {
  const isProcessAllowed = (targetName, runningList) => {
    if (typeof targetName !== 'string' || !targetName.trim()) return false;
    const safeName = path.basename(targetName.trim()).toLowerCase();
    return runningList.some(app => 
      app.processName.toLowerCase() === safeName ||
      app.name.toLowerCase() === safeName
    );
  };

  const sampleRunningApps = [
    { pid: 1234, processName: 'notepad.exe', name: 'Notepad' },
    { pid: 5678, processName: 'chrome.exe', name: 'Google Chrome' }
  ];

  assert.equal(isProcessAllowed('notepad.exe', sampleRunningApps), true);
  assert.equal(isProcessAllowed('C:\\Windows\\notepad.exe', sampleRunningApps), true);
  assert.equal(isProcessAllowed('malicious_hack.exe', sampleRunningApps), false);
  assert.equal(isProcessAllowed('system.exe', sampleRunningApps), false);
});
