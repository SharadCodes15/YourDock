const test = require('node:test');
const assert = require('node:assert');
const focusForwarder = require('../focusForwarder');

test('focusForwarder - skip-list correctly filters and tracks windows', () => {
  // Test case 1: Own App window (should be skipped)
  const ownWindow = {
    id: 12345,
    title: 'Menu Bar Settings',
    owner: {
      processId: 1001,
      name: 'electron.exe',
      path: 'C:\\path\\to\\electron.exe'
    }
  };
  
  focusForwarder.updateLastFocusedWindow(ownWindow);
  // It should not track own-app windows, so getLastFocusedWindow should return null or remain unmodified
  assert.strictEqual(focusForwarder.getLastFocusedWindow(), null);

  // Test case 2: System window (should be skipped)
  const systemWindow = {
    id: 54321,
    title: 'Taskbar',
    owner: {
      processId: 2002,
      name: 'explorer.exe',
      path: 'C:\\Windows\\explorer.exe'
    }
  };
  
  focusForwarder.updateLastFocusedWindow(systemWindow);
  assert.strictEqual(focusForwarder.getLastFocusedWindow(), null);

  // Test case 3: Regular external window (should be tracked)
  const externalWindow = {
    id: 99999,
    title: 'Document - Notepad',
    owner: {
      processId: 3003,
      name: 'notepad.exe',
      path: 'C:\\Windows\\System32\\notepad.exe'
    }
  };
  
  focusForwarder.updateLastFocusedWindow(externalWindow);
  const lastFocused = focusForwarder.getLastFocusedWindow();
  assert.notStrictEqual(lastFocused, null);
  assert.strictEqual(lastFocused.id, 99999);
  assert.strictEqual(lastFocused.processName, 'notepad.exe');
  assert.strictEqual(lastFocused.title, 'Document - Notepad');
});
