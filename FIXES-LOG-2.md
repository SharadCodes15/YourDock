# Fixes Log 2

Documenting targeted bug fixes for the Electron app.

## 1. FIX: 12 Orphaned Widget IPC Channels
- **Root Cause**: Widget subsystem IPC channels (`get-widgets`, `add-widget`, `remove-widget`, `update-widget`, `set-widget-edit-mode`, `toggle-widget-access-panel`, `get-widget-active-summary`, `select-photo-folder`, `widget-action`, `get-media-metadata`, `media-control`, and `save-widgets`) were defined in `src/main/widgets/index.js` inside `initWidgetsSubsystem()`, but `initWidgetsSubsystem()` was being initialized in `main.js` *after* `healthCheck.runStartupHealthCheck(...)` was called on app startup. Additionally, `save-widgets` handler was missing from `src/main/widgets/index.js`.
- **Fix**: Added missing `save-widgets` IPC handler to `src/main/widgets/index.js`, and moved `require('./src/main/widgets').initWidgetsSubsystem()` in `main.js` to execute before `runStartupHealthCheck(...)`.
- **Verification**: Startup Health Check runs with `ipc_registry` passing (0 orphaned channels).

## 2. FIX: ReferenceError: startNormalApp is not defined
- **Root Cause**: `startNormalApp()` function was defined locally inside `app.whenReady().then(...)` callback scope, preventing top-level IPC handlers (such as `complete-onboarding`) from referencing it.
- **Fix**: Extracted `startNormalApp()` function to top-level module scope in `main.js` so it is accessible globally, and wrapped `complete-onboarding` IPC handler in a try/catch block for graceful error handling.
- **Verification**: Completed and skipped Onboarding flow; normal startup windows (Dock + Menu Bar) spawn without console errors.

## 3. FIX: Menu Bar Click Responsiveness & Rapid Click Handling
- **Root Cause**: Rapid back-to-back clicks on Menu Bar items triggered overlapping async IPC calls and un-debounced dropdown transitions, causing in-flight conflict and temporary UI slowness.
- **Fix**: Added an in-flight click debouncer (`handleDebouncedClick` with ~150ms window) per element/key in `index.html` across all interactive menu items (Apple menu items, File/Edit/View/Window/Help dropdowns, Control Center, Spotlight, Notification Center). Ensured `closeAllDropdowns()` completely resets active dropdown state before opening new popovers.
- **Verification**: Rapid clicking across 5+ menu items stays smooth and responsive with clean dropdown cleanup.

## 4. FIX: Settings Page Unresponsive on Load
- **Root Cause**: A duplicate block-level declaration of `const sidebarItems` at line 3247 of `settings.html` threw a `SyntaxError: Identifier 'sidebarItems' has already been declared`, which aborted script execution on page load, rendering all tab switching and setting bindings completely unresponsive.
- **Fix**: Removed the redeclaration of `const sidebarItems` at line 3247 and reused the existing top-level `sidebarItems` variable.
- **Verification**: Syntax checker parsed the page successfully and the Settings window tab switching functions normally.

## 5. FIX: Dropdown Menus Close Automatically When Clicked Inside
- **Root Cause**: Clicks inside dropdown menus (like toggle switches, sliders, lists, calendar days) bubbled up to their parent `.menu-item` container, which triggered the item's click listener. The listener saw `activeDropdown === item` and closed the dropdown immediately.
- **Fix**: Added a guard `if (e.target.closest('.dropdown-menu')) return;` at the beginning of the `.menu-item.interactive` click listener. This allows clicks to proceed normally inside the dropdown without triggering close. Additionally, added click listeners on `.dropdown-item` to close the menu for non-toggle clicks, and automatically route any clicked "Settings..." option to open the main Settings window.
- **Verification**: User can interact with sliders, WiFi toggle, and calendar days without the menu bar getting stuck or closing prematurely. Clicking a settings dropdown item successfully opens the settings window.

## 6. FEATURE: Keep Menus Open on Cursor Leave & Manual Hiding buttons
- **Root Cause**: When the Menu Bar auto-hide was enabled, moving the cursor out of the Menu Bar window boundaries triggered `cursor-leave-timeout` and hid the Menu Bar immediately, even if the user had an active dropdown menu open.
- **Fix**: Updated `isAnyOverlayOpen()` in [main.js](file:///e:/sideProjects/dock/main.js) to treat an open dropdown menu (where Menu Bar window height > 28px) as a blocking overlay, which blocks `menuBarHideController` from auto-hiding the window. Added a customizable checkbox `"Keep Menus Open on Leave"` in Hiding settings to toggle this behavior, and added two manual buttons `"Toggle Menu Bar State"` and `"Toggle Dock State"` to allow testing the auto-hiding triggers instantly inside Settings.
- **Verification**: Auto-hiding menu bar stays open while user is navigating or interacting with a dropdown menu, and automatically hides after closing it. Testing buttons function normally.

## 7. IMPROVEMENT: Async Await Conversion for Window Resizing & Toggles
- **Root Cause**: Window sizing (`set-window-height`) and window toggles (Control Center, Spotlight, Settings, Notifications, Apple action, and close-other-windows) were using asynchronous fire-and-forget `ipcRenderer.send()` messages. Because the renderer did not wait for these operations to complete in the OS, subsequent UI rendering or mouse ignore states were applied prematurely, causing lag or unresponsive visual states.
- **Fix**: Converted all Menu Bar window-manipulating IPC channels from `ipcRenderer.send()` to `ipcRenderer.invoke()` in [preload.js](file:///e:/sideProjects/dock/preload.js), and registered them as `ipcMain.handle()` in [main.js](file:///e:/sideProjects/dock/main.js) (returning a 30ms timeout promise for `set-window-height` to ensure OS level resize is complete). Used `async/await` in [index.html](file:///e:/sideProjects/dock/index.html) click and hover listeners to await these operations.
- **Verification**: All window actions and toggles are perfectly synchronized, resulting in instant responsiveness under repeated fast clicking.
