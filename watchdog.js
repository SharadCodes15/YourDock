const STATES = require('./src/shared/hideStateMachine').STATES;
const fs = require('node:fs');
const path = require('node:path');
const logsDir = path.join(__dirname, 'logs');
const errorLogPath = path.join(logsDir, 'error.log');

function logErrorToFile(error) {
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    const stack = error instanceof Error ? error.stack : String(error);
    const logMessage = `[${timestamp}] [WATCHDOG] ${stack}\n\n`;
    fs.appendFileSync(errorLogPath, logMessage, 'utf8');
  } catch (err) {
    console.error('Watchdog failed to write log:', err);
  }
}

function createWatchdog(config = {}) {
  const {
    stateControllers = [],
    onModalStuck = null,
    onResetUI = null,
    getOpenModals = () => [],
    getLastUserInteractionTime = () => Date.now(),
    tickIntervalMs = 15000,
    animationDurationMs = 250,
    modalStuckThresholdMs = 10 * 60 * 1000,
    getDebug = () => false
  } = config;

  let interval = null;
  let lastTickTime = 0;
  let stuckLogSuppress = {};

  function checkStateMachines() {
    const thresholdMs = Math.max(100, animationDurationMs * 2);
    for (const ctrl of stateControllers) {
      if (!ctrl || typeof ctrl.getState !== 'function') continue;
      try {
        const state = ctrl.getState();
        if (state === STATES.SHOWING || state === STATES.HIDING) {
          const key = `ctrl_${Math.random().toString(36).substr(2, 9)}`;
          if (!stuckLogSuppress[key]) {
            stuckLogSuppress[key] = Date.now();
          }
          const elapsed = Date.now() - stuckLogSuppress[key];
          if (elapsed > thresholdMs) {
            const msg = `[Watchdog] Force-completing transition for controller stuck in ${state} for ${elapsed}ms`;
            console.warn(msg);
            logErrorToFile(new Error(msg));
            if (state === STATES.SHOWING) {
              ctrl.show('watchdog-force');
            } else {
              ctrl.hide('watchdog-force');
            }
            delete stuckLogSuppress[key];
          }
        } else {
          for (const k of Object.keys(stuckLogSuppress)) {
            delete stuckLogSuppress[k];
          }
        }
      } catch (err) {
        console.error('[Watchdog] stateMachine check error:', err);
      }
    }
  }

  function checkModals() {
    try {
      const modals = typeof getOpenModals === 'function' ? getOpenModals() : [];
      if (!Array.isArray(modals) || modals.length === 0) return;
      const lastInteraction = typeof getLastUserInteractionTime === 'function' ? getLastUserInteractionTime() : Date.now();
      const now = Date.now();
      for (const modal of modals) {
        if (!modal || !modal.id || !modal.openSince) continue;
        const openDuration = now - modal.openSince;
        if (openDuration > modalStuckThresholdMs && (now - lastInteraction) > modalStuckThresholdMs) {
          const msg = `[Watchdog] Modal "${modal.id}" open for ${Math.round(openDuration / 60000)}min with no recent interaction`;
          logErrorToFile(new Error(msg));
          if (typeof onModalStuck === 'function') {
            try { onModalStuck(modal); } catch (e) { console.error('[Watchdog] onModalStuck error:', e); }
          }
        }
      }
    } catch (err) {
      console.error('[Watchdog] modal check error:', err);
    }
  }

  function tick() {
    lastTickTime = Date.now();
    checkStateMachines();
    checkModals();
  }

  function start() {
    if (interval) return;
    interval = setInterval(tick, tickIntervalMs);
    if (getDebug()) console.log('[Watchdog] started (interval=' + tickIntervalMs + 'ms)');
  }

  function stop() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  function forceResetUI() {
    console.log('[Watchdog] Force Reset UI triggered');
    for (const ctrl of stateControllers) {
      if (!ctrl || typeof ctrl.getState !== 'function') continue;
      try {
        const state = ctrl.getState();
        if (state === STATES.HIDDEN) {
          ctrl.show('force-reset-ui');
        } else if (state === STATES.SHOWING || state === STATES.HIDING) {
          ctrl.show('force-reset-ui');
        }
      } catch (err) {
        console.error('[Watchdog] forceResetUI error:', err);
      }
    }
    if (typeof onResetUI === 'function') {
      try { onResetUI(); } catch (e) { console.error('[Watchdog] onResetUI error:', e); }
    }
  }

  function destroy() {
    stop();
    stuckLogSuppress = {};
  }

  return {
    start,
    stop,
    tick,
    forceResetUI,
    destroy,
    get isRunning() { return interval !== null; }
  };
}

module.exports = { createWatchdog };
