/**
 * Pure, generic State Machine Factory for Hide/Show behavior.
 * States: VISIBLE, HIDDEN, SHOWING, HIDING
 * Zero shared state across instances.
 */

const STATES = {
  VISIBLE: 'VISIBLE',
  HIDDEN: 'HIDDEN',
  SHOWING: 'SHOWING',
  HIDING: 'HIDING'
};

function createHideStateMachine(config = {}) {
  const {
    name = 'Controller',
    initialState = STATES.VISIBLE,
    animationDurationMs = 250,
    onStateChange = null,
    onStartShowing = null,
    onShowComplete = null,
    onStartHiding = null,
    onHideComplete = null,
    onForceHide = null,
    getDebug = () => false
  } = config;

  let state = initialState;
  let pendingTransition = null;
  let animationTimer = null;

  function logTransition(from, to, reason) {
    if (getDebug()) {
      console.log(`[${name}] ${from} -> ${to} (reason: ${reason})`);
    }
  }

  function setState(newState, reason) {
    if (state === newState) return;
    const oldState = state;
    state = newState;
    logTransition(oldState, newState, reason);
    if (typeof onStateChange === 'function') {
      try { onStateChange(newState, oldState, reason); } catch (e) { console.error(`[${name}] onStateChange error:`, e); }
    }
  }

  function clearTimer() {
    if (animationTimer) {
      clearTimeout(animationTimer);
      animationTimer = null;
    }
  }

  function show(reason = 'user-trigger') {
    if (state === STATES.VISIBLE) return;

    if (state === STATES.HIDING) {
      pendingTransition = { type: 'SHOWING', reason };
      return;
    }

    if (state === STATES.HIDDEN) {
      setState(STATES.SHOWING, reason);
      if (typeof onStartShowing === 'function') {
        try { onStartShowing(reason); } catch (e) { console.error(`[${name}] onStartShowing error:`, e); }
      }

      clearTimer();
      animationTimer = setTimeout(() => {
        animationTimer = null;
        setState(STATES.VISIBLE, `${reason}-complete`);
        if (typeof onShowComplete === 'function') {
          try { onShowComplete(); } catch (e) { console.error(`[${name}] onShowComplete error:`, e); }
        }

        // Process queued reverse transition if requested while showing
        if (pendingTransition) {
          const next = pendingTransition;
          pendingTransition = null;
          if (next.type === 'HIDING') {
            hide(next.reason);
          }
        }
      }, animationDurationMs);
    }
  }

  function hide(reason = 'user-trigger') {
    if (state === STATES.HIDDEN) return;

    if (state === STATES.SHOWING) {
      pendingTransition = { type: 'HIDING', reason };
      return;
    }

    if (state === STATES.VISIBLE) {
      setState(STATES.HIDING, reason);
      if (typeof onStartHiding === 'function') {
        try { onStartHiding(reason); } catch (e) { console.error(`[${name}] onStartHiding error:`, e); }
      }

      clearTimer();
      animationTimer = setTimeout(() => {
        animationTimer = null;
        setState(STATES.HIDDEN, `${reason}-complete`);
        if (typeof onHideComplete === 'function') {
          try { onHideComplete(); } catch (e) { console.error(`[${name}] onHideComplete error:`, e); }
        }

        // Process queued reverse transition if requested while hiding
        if (pendingTransition) {
          const next = pendingTransition;
          pendingTransition = null;
          if (next.type === 'SHOWING') {
            show(next.reason);
          }
        }
      }, animationDurationMs);
    }
  }

  function forceHide(reason = 'force-override') {
    clearTimer();
    pendingTransition = null;
    const oldState = state;
    state = STATES.HIDDEN;
    if (oldState !== STATES.HIDDEN) {
      logTransition(oldState, STATES.HIDDEN, reason);
      if (typeof onStateChange === 'function') {
        try { onStateChange(STATES.HIDDEN, oldState, reason); } catch (e) {}
      }
    }
    if (typeof onForceHide === 'function') {
      try { onForceHide(reason); } catch (e) { console.error(`[${name}] onForceHide error:`, e); }
    }
  }

  function getState() {
    return state;
  }

  function isPending() {
    return pendingTransition !== null;
  }

  function destroy() {
    clearTimer();
    pendingTransition = null;
  }

  return {
    STATES,
    getState,
    show,
    hide,
    forceHide,
    isPending,
    destroy
  };
}

module.exports = {
  STATES,
  createHideStateMachine
};
