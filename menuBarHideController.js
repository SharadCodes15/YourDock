/**
 * Independent Menu Bar Hide Controller
 * Self-contained state, timers, polling, settings, and bounds checking for Menu Bar auto-hide.
 */

const { screen } = require('electron');
const { createHideStateMachine, STATES } = require('./src/shared/hideStateMachine');
const { DEFAULT_MENUBAR_HIDE_SETTINGS, resolveHotspotPixels, resolveRevealDelayMs, sanitizeHideSettings } = require('./src/shared/settingsSchema');

function createMenuBarHideController(options = {}) {
  const {
    getWindow = () => null,
    isMenuBarIsland = () => false,
    isFocusedAppFullscreen = () => true,
    isChildUIOpen = () => false,
    forceCloseChildUI = () => {},
    onWindowVisibilityChange = () => {},
    getCursorPoint = () => (screen && typeof screen.getCursorScreenPoint === 'function' ? screen.getCursorScreenPoint() : { x: 0, y: 0 }),
    getDebug = () => false
  } = options;

  let settings = { ...DEFAULT_MENUBAR_HIDE_SETTINGS };
  let pollInterval = null;
  let hideDelayTimer = null;
  let revealDelayTimer = null;
  let consecutiveHotspotHits = 0;
  let preLockState = STATES.VISIBLE;

  const stateMachine = createHideStateMachine({
    name: 'MenuBar',
    initialState: STATES.VISIBLE,
    animationDurationMs: 250,
    getDebug,
    onStateChange: (newState, oldState, reason) => {
      if (newState === STATES.HIDDEN) {
        startPolling();
      } else {
        stopPolling();
      }
      onWindowVisibilityChange(newState, oldState, reason);
    },
    onStartHiding: (reason) => {
      const win = getWindow();
      if (win && typeof win.isDestroyed === 'function' && !win.isDestroyed()) {
        if (isMenuBarIsland()) {
          if (win.webContents && typeof win.webContents.send === 'function') {
            win.webContents.send('set-collapse-state', true);
          }
        } else if (typeof win.hide === 'function') {
          win.hide();
        }
      }
    },
    onStartShowing: (reason) => {
      const win = getWindow();
      if (win && typeof win.isDestroyed === 'function' && !win.isDestroyed()) {
        if (typeof win.isVisible === 'function' && !win.isVisible() && typeof win.show === 'function') {
          win.show();
        }
        if (isMenuBarIsland()) {
          if (win.webContents && typeof win.webContents.send === 'function') {
            win.webContents.send('set-collapse-state', false);
          }
        }
      }
    },
    onHideComplete: () => {
      const win = getWindow();
      if (win && typeof win.isDestroyed === 'function' && !win.isDestroyed() && !isMenuBarIsland()) {
        if (typeof win.isVisible === 'function' && win.isVisible() && typeof win.hide === 'function') {
          win.hide();
        }
      }
    },
    onForceHide: (reason) => {
      try { forceCloseChildUI(); } catch (e) {}
      const win = getWindow();
      if (win && typeof win.isDestroyed === 'function' && !win.isDestroyed()) {
        if (isMenuBarIsland()) {
          if (win.webContents && typeof win.webContents.send === 'function') {
            win.webContents.send('set-collapse-state', true);
          }
        } else if (typeof win.hide === 'function') {
          win.hide();
        }
      }
    }
  });

  function updateSettings(newSettings) {
    settings = sanitizeHideSettings(newSettings, DEFAULT_MENUBAR_HIDE_SETTINGS);
    if (!settings.enabled) {
      clearHideDelayTimer();
      clearRevealDelayTimer();
      stopPolling();
      if (stateMachine.getState() !== STATES.VISIBLE) {
        stateMachine.show('disabled-setting');
      }
    }
  }

  function getSettings() {
    return { ...settings };
  }

  function clearHideDelayTimer() {
    if (hideDelayTimer) {
      clearTimeout(hideDelayTimer);
      hideDelayTimer = null;
    }
  }

  function clearRevealDelayTimer() {
    if (revealDelayTimer) {
      clearTimeout(revealDelayTimer);
      revealDelayTimer = null;
    }
  }

  function isCursorInHotspot(cursor, displayBounds, widthPx) {
    const halfWidth = Math.round(widthPx / 2);
    const screenX = displayBounds.x;
    const screenY = displayBounds.y;
    const screenWidth = displayBounds.width;
    const centerX = screenX + Math.round(screenWidth / 2);

    return (
      cursor.x >= centerX - halfWidth &&
      cursor.x <= centerX + halfWidth &&
      cursor.y >= screenY &&
      cursor.y <= screenY + 8
    );
  }

  function isCursorInUnionBounds(cursor, extraBoundsList = []) {
    const win = getWindow();
    if (!win || (typeof win.isDestroyed === 'function' && win.isDestroyed())) return false;
    const bounds = typeof win.getBounds === 'function' ? win.getBounds() : { x: 0, y: 0, width: 0, height: 0 };

    if (
      cursor.x >= bounds.x &&
      cursor.x <= bounds.x + bounds.width &&
      cursor.y >= bounds.y &&
      cursor.y <= bounds.y + bounds.height
    ) {
      return true;
    }

    for (const rect of extraBoundsList) {
      if (!rect) continue;
      if (
        cursor.x >= rect.x &&
        cursor.x <= rect.x + rect.width &&
        cursor.y >= rect.y &&
        cursor.y <= rect.y + rect.height
      ) {
        return true;
      }
    }
    return false;
  }

  function startPolling() {
    if (pollInterval) return;
    consecutiveHotspotHits = 0;
    pollInterval = setInterval(() => {
      if (stateMachine.getState() !== STATES.HIDDEN) {
        stopPolling();
        return;
      }

      if (!settings.enabled) return;

      const cursor = getCursorPoint();
      const display = (screen && typeof screen.getDisplayNearestPoint === 'function' ? screen.getDisplayNearestPoint(cursor) : null) || (screen && typeof screen.getPrimaryDisplay === 'function' ? screen.getPrimaryDisplay() : { bounds: { x: 0, y: 0, width: 1920, height: 1080 } });
      const widthPx = resolveHotspotPixels(settings.hotspotWidth);

      // In click mode the pill is revealed by clicking the button, never by hovering
      if (settings.revealMode === 'click') {
        consecutiveHotspotHits = 0;
        return;
      }

      if (isCursorInHotspot(cursor, display.bounds, widthPx)) {
        consecutiveHotspotHits++;
        const requiredHits = Math.max(1, Math.round(resolveRevealDelayMs(settings.revealDelayMs) / 100));

        if (consecutiveHotspotHits >= requiredHits) {
          consecutiveHotspotHits = 0;
          stateMachine.show('hotspot-hover');
        }
      } else {
        consecutiveHotspotHits = 0;
      }
    }, 100);
  }

  function stopPolling() {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    consecutiveHotspotHits = 0;
  }

  function handleCursorTick(cursorPoint, extraChildBounds = []) {
    if (!settings.enabled) return;

    // Check trigger mode
    if (settings.triggerMode === 'fullscreen-only' && !isFocusedAppFullscreen()) {
      if (stateMachine.getState() !== STATES.VISIBLE) {
        stateMachine.show('fullscreen-exit');
      }
      return;
    }

    const state = stateMachine.getState();

    if (state === STATES.VISIBLE || state === STATES.SHOWING) {
      const inBounds = isCursorInUnionBounds(cursorPoint, extraChildBounds);

      if (!inBounds) {
        if (!hideDelayTimer) {
          hideDelayTimer = setTimeout(() => {
            hideDelayTimer = null;
            // Check blocking conditions at moment timer fires
            if (isChildUIOpen()) return;
            const currentCursor = getCursorPoint();
            if (isCursorInUnionBounds(currentCursor, extraChildBounds)) return;

            stateMachine.hide('cursor-leave-timeout');
          }, settings.hideDelayMs);
        }
      } else {
        clearHideDelayTimer();
      }
    }
  }

  function lockScreen() {
    preLockState = stateMachine.getState();
    stateMachine.forceHide('lock-screen');
  }

  function unlockScreen() {
    if (settings.enabled && preLockState === STATES.VISIBLE) {
      stateMachine.show('unlock-screen');
    }
  }

  function destroy() {
    clearHideDelayTimer();
    clearRevealDelayTimer();
    stopPolling();
    stateMachine.destroy();
  }

  return {
    getState: stateMachine.getState,
    show: stateMachine.show,
    hide: stateMachine.hide,
    forceHide: stateMachine.forceHide,
    updateSettings,
    getSettings,
    handleCursorTick,
    lockScreen,
    unlockScreen,
    destroy
  };
}

module.exports = {
  createMenuBarHideController
};
