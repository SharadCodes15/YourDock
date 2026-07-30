# Widget Interaction Bugs - Diagnostics and Fixes

## 1. Click-Through Issue (Root Cause)
### Diagnostics
- The transparent fullscreen Widget Host Window was created with `setIgnoreMouseEvents(true, { forward: true })` to allow clicking through empty spaces to reach the desktop/other apps.
- When the Widget Access Panel (which is a separate transparent window placed in front of it) was opened, the Host Window still kept forwarding mouse events.
- In Electron, when a fullscreen window has mouse-event-ignore forwarding active, mouse actions over overlapping transparent windows (such as the Access Panel) are bypassed and forwarded straight to the operating system desktop, rendering buttons and controls on the Access Panel unclickable.
- Furthermore, the renderer-side region-tracking mousemove event was only fired when the cursor moved *inside* the Host Window. Since the mouse was over the Access Panel window, no mousemove events were captured by the Host Window, leaving the click-through state in a stale and blocking condition.

### Fix
- Introduced a single source-of-truth function `updateClickThroughState()` in the main process (`src/main/widgets/index.js`).
- This function dynamically disables click-through on the Host Window (`setIgnoreMouseEvents(false)`) if:
  1. The Access Panel is open.
  2. Edit Mode is active.
  3. Any widget settings popover is open.
- In normal VIEW mode (no panels/popovers active), it safely restores the selective ignore-with-forward mode.
- Ensured this click-through check is evaluated on every state transition (adding/removing widgets, toggling edit mode, opening/closing the access panel or settings popovers).

---

## 2. Access Panel Close Button & Click-Outside
### Diagnostics
- The Access Panel's close button was bound to the `toggle-widget-access-panel` IPC channel. This channel toggled the state instead of explicitly closing it.
- There was no click-outside handler, meaning the panel remained open if the user clicked elsewhere.

### Fix
- Implemented a canonical `closePanel()` function in the renderer (`src/renderer/widgets/access-panel.js`) that invokes a new, dedicated `'close-widget-access-panel'` IPC handler.
- Consolidated both the close button and the `Escape` key handlers to call this canonical function.
- Added a `blur` event listener to `panelWindow` in the main process (`src/main/widgets/widgetAccessPanel.js`). If the panel window loses focus (e.g. user clicks outside on the desktop or another app), it calls `closeAccessPanel()` to cleanly exit Edit Mode and close the panel.

---

## 3. Settings Toggles and Input Responsiveness
### Diagnostics
- When a widget's settings (such as Clock face style, text color, Countdown title, or Sticky Note text) were changed, the change was saved to the store which then fired a global `widgets-updated` message to the Host Window renderer.
- The renderer handled this by clearing the canvas (`canvasEl.innerHTML = ''`) and rebuilding all widgets.
- This complete rebuild tore down and recreated the DOM, causing:
  - Active dropdown selects to immediately collapse.
  - Text input elements to lose focus (blurring) after typing a single character.
  - Dropdown values to lose focus and appear unresponsive.

### Fix
- Refactored `renderWidgets()` in `src/renderer/widgets/host.js` to update the DOM in-place:
  1. Removed widgets are cleanly unmounted (triggering cleanups) and deleted from the DOM.
  2. Placed widgets have their styles (position, size, edit/view classes) updated on the existing element in-place.
  3. The widget's inner content is only re-rendered if the settings change structurally by comparing current settings with `dataset.renderedSettings`.
  4. When a widget settings input changes, it immediately updates its local `dataset.renderedSettings` alongside the local re-render, so the subsequent global update event is treated as a no-op for that widget and does not trigger a redraw. This keeps input fields, dropdown selects, and color picker controls focused and active while editing.
