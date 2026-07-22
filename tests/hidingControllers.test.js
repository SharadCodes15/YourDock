const test = require('node:test');
const assert = require('node:assert/strict');
const { createHideStateMachine, STATES } = require('../src/shared/hideStateMachine');
const { createDockHideController } = require('../dockHideController');
const { createMenuBarHideController } = require('../menuBarHideController');
const { DEFAULT_DOCK_HIDE_SETTINGS, DEFAULT_MENUBAR_HIDE_SETTINGS, migrateSettings } = require('../src/shared/settingsSchema');

test('stateMachine - independent state transitions and queued animation reversals', (t, done) => {
  const sm = createHideStateMachine({
    name: 'TestMachine',
    initialState: STATES.VISIBLE,
    animationDurationMs: 50
  });

  assert.equal(sm.getState(), STATES.VISIBLE);

  // Trigger hide transition -> moves to HIDING
  sm.hide('test-leave');
  assert.equal(sm.getState(), STATES.HIDING);

  // Trigger show mid-animation -> queues reverse transition
  sm.show('test-re-enter');
  assert.equal(sm.getState(), STATES.HIDING);
  assert.equal(sm.isPending(), true);

  // After animation completes, state transitions to VISIBLE via queued reverse transition
  setTimeout(() => {
    assert.equal(sm.getState(), STATES.VISIBLE);
    assert.equal(sm.isPending(), false);
    sm.destroy();
    done();
  }, 120);
});

test('dockHideController - synthetic event sequence (leave -> timer -> child UI open -> lock -> escape)', (t, done) => {
  let childOpen = false;
  let forceClosed = false;

  const controller = createDockHideController({
    getWindow: () => ({ isDestroyed: () => false, isVisible: () => true, getBounds: () => ({ x: 0, y: 1000, width: 1920, height: 80 }), webContents: { send: () => {} } }),
    getDockPosition: () => 'bottom',
    isFocusedAppFullscreen: () => true,
    isChildUIOpen: () => childOpen,
    forceCloseChildUI: () => { forceClosed = true; childOpen = false; }
  });

  controller.updateSettings({ hideDelayMs: 50 });

  // 1. Cursor leaves bounds -> hide delay timer starts
  controller.handleCursorTick({ x: 500, y: 100 });
  
  // 2. Child UI opens before timer fires
  childOpen = true;

  setTimeout(() => {
    // Hide timer fired but was blocked because child UI was open
    assert.equal(controller.getState(), STATES.VISIBLE);

    // 3. Child UI closes
    childOpen = false;

    // 4. Cursor leaves again
    controller.handleCursorTick({ x: 500, y: 100 });

    setTimeout(() => {
      // Hide timer and animation complete -> transitions to HIDDEN
      assert.equal(controller.getState(), STATES.HIDDEN);

      // 5. Lock screen forces hide
      controller.lockScreen();
      assert.equal(controller.getState(), STATES.HIDDEN);

      // 6. Unlock restores state
      controller.unlockScreen();
      
      // 7. Force hide via Escape
      childOpen = true;
      controller.forceHide('escape-key');
      assert.equal(controller.getState(), STATES.HIDDEN);
      assert.equal(forceClosed, true);

      controller.destroy();
      done();
    }, 350);
  }, 100);
});

test('isolation - changing Dock settings does not alter Menu Bar controller state or config', () => {
  const dockCtrl = createDockHideController();
  const mbCtrl = createMenuBarHideController();

  const initialMbSettings = mbCtrl.getSettings();

  dockCtrl.updateSettings({
    enabled: false,
    triggerMode: 'fullscreen-only',
    hotspotWidth: 'wide',
    revealDelayMs: 'normal',
    hideDelayMs: 800
  });

  const updatedMbSettings = mbCtrl.getSettings();

  assert.deepEqual(updatedMbSettings, initialMbSettings);
  assert.equal(mbCtrl.getState(), STATES.VISIBLE);

  dockCtrl.destroy();
  mbCtrl.destroy();
});

test('overrides - Escape key forces both controllers to HIDDEN even when enabled: false', () => {
  let dockForceClosed = false;
  let mbForceClosed = false;

  const dockCtrl = createDockHideController({
    getWindow: () => ({ isDestroyed: () => false, isVisible: () => true, getBounds: () => ({ x: 0, y: 1000, width: 1920, height: 80 }), webContents: { send: () => {} } }),
    forceCloseChildUI: () => { dockForceClosed = true; }
  });

  const mbCtrl = createMenuBarHideController({
    getWindow: () => ({ isDestroyed: () => false, isVisible: () => true, getBounds: () => ({ x: 0, y: 0, width: 1920, height: 30 }), webContents: { send: () => {} } }),
    forceCloseChildUI: () => { mbForceClosed = true; }
  });

  // Disable auto-hide in settings
  dockCtrl.updateSettings({ enabled: false });
  mbCtrl.updateSettings({ enabled: false });

  // Verify Escape forces both to HIDDEN
  dockCtrl.forceHide('escape-key');
  mbCtrl.forceHide('escape-key');

  assert.equal(dockCtrl.getState(), STATES.HIDDEN);
  assert.equal(mbCtrl.getState(), STATES.HIDDEN);
  assert.equal(dockForceClosed, true);
  assert.equal(mbForceClosed, true);

  dockCtrl.destroy();
  mbCtrl.destroy();
});

test('settings - migration populates dockHideSettings and menuBarHideSettings independently', () => {
  const rawSettings = {
    hiding: {
      enabled: false,
      delay: 600
    }
  };

  const migrated = migrateSettings(rawSettings);

  assert.ok(migrated.dockHideSettings);
  assert.ok(migrated.menuBarHideSettings);
  assert.equal(migrated.dockHideSettings.enabled, false);
  assert.equal(migrated.dockHideSettings.hideDelayMs, 600);
  assert.equal(migrated.menuBarHideSettings.enabled, false);
  assert.equal(migrated.menuBarHideSettings.hideDelayMs, 600);

  // Mutating one object does not affect the other
  migrated.dockHideSettings.hideDelayMs = 300;
  assert.equal(migrated.menuBarHideSettings.hideDelayMs, 600);
});
