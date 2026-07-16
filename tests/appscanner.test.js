const test = require('node:test');
const assert = require('node:assert');
const { processScannedApps } = require('../appscanner');

test('appscanner - processScannedApps returns expected shape, applies blacklist, and de-duplicates', () => {
  const mockSettings = {
    general: {
      hideDevTools: true
    }
  };

  const mockBlacklist = {
    nameKeywords: ['uninstall', 'remove', 'readme', 'help'],
    devToolKeywords: ['node.js', 'git bash', 'docker'],
    exeBlacklist: ['cmd.exe', 'powershell.exe', 'node.exe']
  };

  const rawShortcuts = [
    { name: 'Google Chrome', target: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' },
    { name: 'Git Bash', target: 'C:\\Program Files\\Git\\git-bash.exe' }, // matches dev-tool keyword
    { name: 'Node.js Command Prompt', target: 'C:\\Program Files\\nodejs\\node.exe' }, // matches dev-tool keyword & exe blacklist
    { name: 'Google Chrome Copy', target: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' }, // duplicate target
    { name: 'Uninstall App', target: 'C:\\Program Files\\App\\uninstall.exe' }, // matches name keyword 'uninstall'
    { name: 'My Document', target: 'C:\\Users\\test\\Documents\\info.txt' }, // invalid extension (not exe/lnk/bat/cmd/msc)
    { name: 'Command Prompt', target: 'C:\\Windows\\System32\\cmd.exe' }, // matches exe blacklist
    { name: 'Sublime Text', target: 'C:\\Program Files\\Sublime Text\\sublime_text.exe' }
  ];

  const results = processScannedApps(rawShortcuts, mockSettings, mockBlacklist);

  // Assert expected length
  assert.strictEqual(results.length, 2);

  // Assert expected shape and alphabetical sorting (Google Chrome before Sublime Text)
  assert.strictEqual(results[0].name, 'Google Chrome');
  assert.strictEqual(results[0].id, 'googlechrome');
  assert.strictEqual(results[0].exec, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
  assert.strictEqual(results[0].icon, '');

  assert.strictEqual(results[1].name, 'Sublime Text');
  assert.strictEqual(results[1].id, 'sublimetext');
  assert.strictEqual(results[1].exec, 'C:\\Program Files\\Sublime Text\\sublime_text.exe');
  assert.strictEqual(results[1].icon, '');
});

test('appscanner - processScannedApps respects hideDevTools disabled setting', () => {
  const mockSettings = {
    general: {
      hideDevTools: false // do NOT hide dev tools
    }
  };

  const mockBlacklist = {
    nameKeywords: ['uninstall'],
    devToolKeywords: ['node.js'],
    exeBlacklist: ['node.exe']
  };

  const rawShortcuts = [
    { name: 'Node.js Command Prompt', target: 'C:\\Program Files\\nodejs\\node.exe' }, // dev tool, but hideDevTools is false
    { name: 'Uninstall App', target: 'C:\\Program Files\\App\\uninstall.exe' } // base name keyword, always filtered
  ];

  const results = processScannedApps(rawShortcuts, mockSettings, mockBlacklist);

  // 'Node.js Command Prompt' should pass because hideDevTools is false
  // 'Uninstall App' should be excluded because nameKeywords are always filtered
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].name, 'Node.js Command Prompt');
});
