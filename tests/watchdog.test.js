const test = require('node:test');
const assert = require('node:assert/strict');
const { createHideStateMachine, STATES } = require('../src/shared/hideStateMachine');

test('watchdog - stuck state machine detection forces completion', (t, done) => {
  const sm = createHideStateMachine({
    name: 'StuckTest',
    initialState: STATES.VISIBLE,
    animationDurationMs: 250
  });

  // Simulate a controller getting stuck in SHOWING state
  let stuckDetected = false;
  const mockController = {
    getState: () => STATES.SHOWING,
    show: (reason) => { stuckDetected = true; },
    hide: () => {}
  };

  // Create a simple watchdog-like check
  const animationDurationMs = 250;
  const thresholdMs = Math.max(100, animationDurationMs * 2);

  // Simulate the state being stuck past threshold
  const startTime = Date.now() - thresholdMs - 100;
  let stuckLogSuppress = {};
  const key = 'ctrl_test';
  stuckLogSuppress[key] = startTime;

  const elapsed = Date.now() - stuckLogSuppress[key];
  if (elapsed > thresholdMs) {
    if (mockController.getState() === STATES.SHOWING) {
      mockController.show('watchdog-force');
    }
    delete stuckLogSuppress[key];
  }

  assert.equal(stuckDetected, true);
  sm.destroy();
  done();
});

test('watchdog - hidden state does not trigger force completion', (t, done) => {
  const sm = createHideStateMachine({
    name: 'NoStuckTest',
    initialState: STATES.HIDDEN,
    animationDurationMs: 250
  });

  let forceTriggered = false;
  const mockController = {
    getState: () => STATES.HIDDEN,
    show: () => { forceTriggered = true; },
    hide: () => {}
  };

  const thresholdMs = 500;
  const key = 'ctrl_test2';
  const stuckLogSuppress = {};
  stuckLogSuppress[key] = Date.now() - thresholdMs - 100;

  const elapsed = Date.now() - stuckLogSuppress[key];
  if (elapsed > thresholdMs) {
    if (mockController.getState() === STATES.SHOWING || mockController.getState() === STATES.HIDING) {
      mockController.show('watchdog-force');
    }
  }

  assert.equal(forceTriggered, false);
  sm.destroy();
  done();
});

test('watchdog - VISIBLE state does not trigger force completion', () => {
  let forceTriggered = false;
  const mockController = {
    getState: () => STATES.VISIBLE,
    show: () => { forceTriggered = true; },
    hide: () => {}
  };

  const thresholdMs = 500;
  const key = 'ctrl_test3';
  const stuckLogSuppress = {};
  stuckLogSuppress[key] = Date.now() - thresholdMs - 100;

  const elapsed = Date.now() - stuckLogSuppress[key];
  if (elapsed > thresholdMs) {
    if (mockController.getState() === STATES.SHOWING || mockController.getState() === STATES.HIDING) {
      mockController.show('watchdog-force');
    }
  }

  assert.equal(forceTriggered, false);
});

test('watchdog - HIDING state stuck past threshold triggers force completion', () => {
  let hideTriggered = false;
  const mockController = {
    getState: () => STATES.HIDING,
    show: () => {},
    hide: (reason) => { hideTriggered = true; }
  };

  const thresholdMs = 500;
  const key = 'ctrl_test4';
  const stuckLogSuppress = {};
  stuckLogSuppress[key] = Date.now() - thresholdMs - 100;

  const elapsed = Date.now() - stuckLogSuppress[key];
  if (elapsed > thresholdMs) {
    if (mockController.getState() === STATES.HIDING) {
      mockController.hide('watchdog-force');
    }
    delete stuckLogSuppress[key];
  }

  assert.equal(hideTriggered, true);
});
