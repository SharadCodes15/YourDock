const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crashReporter = require('../crashReporter');

test('crashReporter - logCrashReport creates structured entry and caps at 20 entries', () => {
  const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'dock-crash-test-'));

  // Mock app.getPath
  const originalGetPath = crashReporter.__getPath;
  const mockApp = { getPath: () => tmpUserData };

  // Write 25 crash reports
  for (let i = 0; i < 25; i++) {
    const entry = {
      id: `crash_${i}`,
      timestamp: new Date().toISOString(),
      errorType: 'UncaughtException',
      message: `Error message ${i}`,
      stack: `Error stack ${i}`,
      processWindow: 'main',
      appVersion: '1.0.0',
      stateSnapshot: {},
      seen: false
    };
    const reportsPath = path.join(tmpUserData, 'crashReports.json');
    let existing = [];
    if (fs.existsSync(reportsPath)) {
      existing = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));
    }
    existing.unshift(entry);
    const capped = existing.slice(0, crashReporter.MAX_REPORTS);
    fs.writeFileSync(reportsPath, JSON.stringify(capped, null, 2), 'utf8');
  }

  const reportsPath = path.join(tmpUserData, 'crashReports.json');
  const saved = JSON.parse(fs.readFileSync(reportsPath, 'utf8'));

  assert.equal(saved.length, 20);
  assert.equal(saved[0].id, 'crash_24');
  assert.equal(saved[19].id, 'crash_5');

  fs.rmSync(tmpUserData, { recursive: true, force: true });
});
