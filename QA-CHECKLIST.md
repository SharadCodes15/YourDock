# Quality Assurance Checklist

This checklist provides a set of manual tests to verify the robustness, aesthetics, and correctness of the macOS Dock & Menu Bar application.

---

## 1. Robustness & Stability Audits

### Global Error Handling
- [ ] Rename the settings file in `%APPDATA%/macos-top-menu-bar` to trigger an error. Check that the app logs the stack trace to `logs/error.log` and doesn't crash the main process.
- [ ] Induce a simulated rejection/error in preload. Check that it doesn't cause a blank window crash.

### White-Flash Prevention
- [ ] Launch the Settings panel, Drawer, and Control Center. Confirm that there is **zero white flash** on startup.
- [ ] Verify that every BrowserWindow uses the `'ready-to-show'` event and only displays once fully painted.

---

## 2. Core User Experience Features

### First-Run Wizard
- [ ] Clear `%APPDATA%/macos-top-menu-bar` folder.
- [ ] Start the application. Verify that the welcome window wizard appears.
- [ ] Click "Scan" and verify that it registers apps.
- [ ] Click "Launch" to verify that the welcome wizard closes and the main Dock + Menu Bar show up.

### Dock Positioning & Size Presets
- [ ] Open Settings → Dock.
- [ ] Change Dock Position to **Left**. Verify that:
  - The Dock snaps to the left side of the screen.
  - The icons stack vertically in a column.
  - Magnification scales along the vertical axis (compares mouse Y).
  - Tooltips pop out to the right of the Dock.
- [ ] Change Dock Position to **Right**. Verify that:
  - The Dock snaps to the right side of the screen.
  - Tooltips pop out to the left of the Dock.
- [ ] Change Dock presets (**Small, Medium, Large**). Verify that the icon sizes scale smoothly.

### Dock Hiding Modes (4 Snapped Behaviors)
- [ ] Open Settings → Hiding.
- [ ] Set **Dock Hiding Mode** to **Always Visible**. Verify that:
  - The Dock stays fully on screen.
  - Moving the cursor away does not trigger collapse/hide.
- [ ] Set **Dock Hiding Mode** to **Dynamic Island (Collapse to Pill)**. Verify that:
  - Moving the cursor away collapses the Dock into a 180px wide pill showing 6px.
- [ ] Set **Dock Hiding Mode** to **Direct Hide (Always Hide Completely)**. Verify that:
  - Moving the cursor away hides the Dock completely off-screen.
  - Hovering over the snap edge brings it back.
- [ ] Set **Dock Hiding Mode** to **Direct Hide (Only when apps are open)**. Verify that:
  - If a window is on screen (e.g., Settings), moving the cursor away hides the Dock completely.
  - If all windows are minimized (empty desktop), the Dock stays visible/expanded (never hides).

### Drag-and-Drop Folders (Launchpad-style)
- [ ] Open the App Drawer.
- [ ] Drag one app icon onto another. Verify that:
  - A folder tile is created containing a stacked 2x2 preview of the app icons.
  - The original separate app icons are removed from the grid.
- [ ] Drag another app icon onto the folder tile to add it.
- [ ] Click the folder tile. Verify that the Launchpad-style modal overlay fades and scales in.
- [ ] Double-click the folder name inside the overlay and rename it. Check that the title updates.
- [ ] Right-click an icon inside the folder overlay and click "Remove from folder". Verify it returns to the main grid.

---

## 3. Motion & Animation Adjustments

### Fluid Easing
- [ ] Hover over icons in the Dock. Confirm that magnification uses a smooth `cubic-bezier(0.16, 1, 0.3, 1)` easing.
- [ ] Expand and collapse the Menu Bar. Verify the transition is fluid.
- [ ] Toggle dropdown menus (e.g. Apple Menu). Check that they slide and fade in 120ms.

### Reduce Motion Toggle
- [ ] Open Settings → Appearance.
- [ ] Toggle **Reduce Motion** ON.
- [ ] Verify that:
  - All animations (dock magnification, drawer fade-ins, CC scale animations) are instantly disabled app-wide.
  - Bounces and slide effects cease.
- [ ] Toggle **Reduce Motion** OFF. Verify that transitions return immediately.

---

## 4. Helper Buttons & Shortcuts

### Error Log Viewer
- [ ] Open Settings → Performance.
- [ ] Click the **View Error Log** button. Confirm that:
  - If a log file exists, it opens in the OS default text editor.
  - If no log file exists, an informational message box appears.

### Global Hotkey to Toggle Drawer
- [ ] Open Settings → Shortcuts.
- [ ] Click the "Open Drawer Shortcut" input, press keys (e.g. `Ctrl+Alt+D`), and save.
- [ ] Press the hotkey combination. Verify the Drawer toggles visibility successfully.
