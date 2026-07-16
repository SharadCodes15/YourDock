const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('config - read-write round-trip data integrity', () => {
  const tempConfigPath = path.join(__dirname, 'temp_config_test.json');
  
  const testConfig = {
    pinned: ["finder", "safari", "messages", "trash"],
    autoHide: true,
    badges: {
      finder: 5,
      messages: 12
    },
    launchCounts: {
      finder: 42
    }
  };

  try {
    // Write configuration to temporary file
    fs.writeFileSync(tempConfigPath, JSON.stringify(testConfig, null, 2), 'utf8');
    
    // Read configuration back
    const rawData = fs.readFileSync(tempConfigPath, 'utf8');
    const readConfig = JSON.parse(rawData);
    
    // Assert read data matches written data
    assert.deepStrictEqual(readConfig, testConfig);
    assert.strictEqual(readConfig.autoHide, true);
    assert.strictEqual(readConfig.badges.messages, 12);
    assert.strictEqual(readConfig.launchCounts.finder, 42);
  } finally {
    // Cleanup temporary file
    if (fs.existsSync(tempConfigPath)) {
      fs.unlinkSync(tempConfigPath);
    }
  }
});
