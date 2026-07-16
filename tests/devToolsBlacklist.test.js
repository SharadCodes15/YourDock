const test = require('node:test');
const assert = require('node:assert');

// Logic for blacklist matching from appscanner
function isBlacklisted(name, target, blacklist, hideDevTools = true) {
  const nameLower = name.toLowerCase();
  const targetLower = target.toLowerCase();
  const exeBasename = targetLower.split('\\').pop().split('/').pop();

  const nameKeywords = blacklist.nameKeywords || [];
  const devToolKeywords = blacklist.devToolKeywords || [];
  const exeBlacklist = (blacklist.exeBlacklist || []).map(e => e.toLowerCase());

  // Base blacklist
  if (nameKeywords.some(kw => nameLower.includes(kw) || targetLower.includes(kw))) {
    return true;
  }

  // Dev tools
  if (hideDevTools) {
    if (devToolKeywords.some(kw => nameLower.includes(kw) || targetLower.includes(kw))) {
      return true;
    }
    if (exeBlacklist.includes(exeBasename)) {
      return true;
    }
  }

  return false;
}

test('devToolsBlacklist - matching logic filters names, paths, and executables', () => {
  const mockBlacklist = {
    nameKeywords: ['uninstall', 'remove'],
    devToolKeywords: ['node.js', 'docker'],
    exeBlacklist: ['cmd.exe', 'powershell.exe']
  };

  // Case 1: Base blacklist name match
  assert.strictEqual(isBlacklisted('Uninstall Helper', 'C:\\app\\helper.exe', mockBlacklist), true);

  // Case 2: Base blacklist target path match
  assert.strictEqual(isBlacklisted('My App', 'C:\\uninstall-dir\\app.exe', mockBlacklist), true);

  // Case 3: Dev-tool name match (with hideDevTools=true)
  assert.strictEqual(isBlacklisted('Docker Desktop', 'C:\\docker\\desktop.exe', mockBlacklist), true);

  // Case 4: Dev-tool name match (with hideDevTools=false)
  assert.strictEqual(isBlacklisted('Docker Desktop', 'C:\\docker\\desktop.exe', mockBlacklist, false), false);

  // Case 5: Exe blacklist match
  assert.strictEqual(isBlacklisted('Command Line', 'C:\\windows\\system32\\cmd.exe', mockBlacklist), true);

  // Case 6: Regular app (should not be blacklisted)
  assert.strictEqual(isBlacklisted('Visual Studio Code', 'C:\\VSCode\\code.exe', mockBlacklist), false);
});
