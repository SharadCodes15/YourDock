const test = require('node:test');
const assert = require('node:assert/strict');
const WidgetRegistry = require('../src/main/widgets/widgetRegistry');

test('widgetRegistry - tracks active instance count per widget type accurately', () => {
  const registry = new WidgetRegistry();

  assert.equal(registry.getActiveCount('clock'), 0);
  assert.equal(registry.isTypeActive('clock'), false);

  registry.registerInstance('clock', 'w1');
  assert.equal(registry.getActiveCount('clock'), 1);
  assert.equal(registry.isTypeActive('clock'), true);

  registry.registerInstance('clock', 'w2');
  assert.equal(registry.getActiveCount('clock'), 2);

  registry.unregisterInstance('w1');
  assert.equal(registry.getActiveCount('clock'), 1);

  registry.unregisterInstance('w2');
  assert.equal(registry.getActiveCount('clock'), 0);
  assert.equal(registry.isTypeActive('clock'), false);
});

test('widgetRegistry - triggers start and stop listeners on 0 -> 1 and 1 -> 0 count transitions', () => {
  const registry = new WidgetRegistry();
  let startFired = 0;
  let stopFired = 0;

  registry.onTypeStart('weather', () => { startFired++; });
  registry.onTypeStop('weather', () => { stopFired++; });

  registry.registerInstance('weather', 'w1');
  assert.equal(startFired, 1);
  assert.equal(stopFired, 0);

  // Second instance of same type should NOT fire start again
  registry.registerInstance('weather', 'w2');
  assert.equal(startFired, 1);
  assert.equal(stopFired, 0);

  // Unregistering 1 instance leaves 1 remaining -> should NOT fire stop
  registry.unregisterInstance('w1');
  assert.equal(stopFired, 0);

  // Unregistering last instance -> MUST fire stop
  registry.unregisterInstance('w2');
  assert.equal(stopFired, 1);
});

test('widgetRegistry - generates accurate active summary string', () => {
  const registry = new WidgetRegistry();
  assert.equal(registry.getActiveSummary(), 'Active widgets: 0');

  registry.registerInstance('clock', 'w1');
  registry.registerInstance('weather', 'w2');

  const summary = registry.getActiveSummary();
  assert.ok(summary.includes('Active widgets: 2'));
  assert.ok(summary.includes('clock'));
  assert.ok(summary.includes('weather'));
});
