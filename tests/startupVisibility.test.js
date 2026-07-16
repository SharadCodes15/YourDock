const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldShowWindowsAtStartup } = require('../startupVisibility');

test('shows windows by default on startup', () => {
  assert.equal(shouldShowWindowsAtStartup({}), true);
});

test('hides windows when startup should be minimized', () => {
  assert.equal(shouldShowWindowsAtStartup({ startMinimized: true }), false);
});

test('respects explicit false flag', () => {
  assert.equal(shouldShowWindowsAtStartup({ showWindowsOnStartup: false }), false);
});
