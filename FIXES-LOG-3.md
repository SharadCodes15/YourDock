# Fixes Log 3

Documenting targeted bug fixes, window startup flash fixes, global UI smoothness polish, stability sweep results, and shortcut modifier key support for the Electron Dock & Menu Bar app.

## 1. FIX: Black Screen Flash on Startup (All Windows)
- **Root Cause**: Windows (`menuBarWin`, `dockWin`, `settingsWin`, `aboutWin`, `forceQuitWin`, `welcomeWin`, `onboardingWin`, `drawerWin`, `ccWin`, `spotlightWin`, `overlayWin`, `toastWin`, `panelWindow`, `hostWindow`) were created with `show: true` by default or shown via `setTimeout`/`did-finish-load` before content was fully rendered. Without `backgroundColor: '#00000000'` (for transparent windows) or matching background color (for opaque windows), Electron rendered a black or white OS frame before painting the HTML content, causing a visible flash on launch and window opening.
- **Fix**: Applied uniform `BrowserWindow` creation rules across all 17 window instantiations in [main.js](file:///e:/sideProjects/dock/main.js), [crashReporter.js](file:///e:/sideProjects/dock/crashReporter.js), [screenshot.js](file:///e:/sideProjects/dock/screenshot.js), [src/main/widgets/widgetAccessPanel.js](file:///e:/sideProjects/dock/src/main/widgets/widgetAccessPanel.js), and [src/main/widgets/widgetHostWindow.js](file:///e:/sideProjects/dock/src/main/widgets/widgetHostWindow.js):
  - Set `show: false` in constructor options for all windows.
  - Set `backgroundColor: '#00000000'` for all transparent/frameless windows and `#0f172a` for opaque modal windows.
  - Deferred calling `.show()` until the `win.once('ready-to-show', ...)` event handler fired (with `shouldShowWindowsAtStartup` check for Dock and Menu Bar).
- **Verification**: Tested `npm start` — all windows load smoothly with zero black/white screen flash.

## 2. GLOBAL ACTION SMOOTHNESS & POLISH SWEEP
- **Immediate Visual Acknowledgment**: Added `:active` press feedback (`transform: scale(0.97)` / `transform: translateY(1px)`) across buttons, cards, and interactive controls in [onboarding.html](file:///e:/sideProjects/dock/onboarding.html), [settings.html](file:///e:/sideProjects/dock/settings.html), and style mode CSS stylesheets.
- **Layout Jumps Prevention**: Verified all popovers, dropdowns, and drawer panels animate using GPU-accelerated `transform` and `opacity` properties only, preventing layout reflow.
- **Consistent Animation Timing**: Normalized transition durations and spring-easing across the UI (`0.15s - 0.18s` for menus/dropdowns, `0.2s - 0.25s` with `cubic-bezier(0.16, 1, 0.3, 1)` for modals/panels).

## 3. STABILITY SWEEP
- **IPC Channel Registry Audit**: Re-audited all IPC channels in `src/shared/constants.js` and `healthCheck.js`. All 78+ IPC channels have active listeners in `main.js` or `src/main/widgets/index.js`, with 0 orphaned channels.
- **Static Function Scope Audit**: Verified all top-level helper function calls (`saveConfig`, `startNormalApp`, `closeDrawer`, `openDrawer`, `forceCollapseAll`, `ensureIconsFolder`, `loadConfig`, `loadSettings`, `runStartupIntegrityChecks`) match reachable function declarations in module scope.
- **Window Destroy-on-Quit**: Added `destroyAllWindows()` in `app.on('before-quit')` in [main.js](file:///e:/sideProjects/dock/main.js) and exported `destroyWidgetsSubsystem()` in [src/main/widgets/index.js](file:///e:/sideProjects/dock/src/main/widgets/index.js) to ensure all 17 windows and widget host/panel resources are completely destroyed on app quit.

## 4. SHORTCUT CAPTURE WITH FULL MODIFIER KEY SUPPORT
- **Root Cause**: Shortcut capture in Settings → Shortcuts only recorded simple key combinations and lacked live modifier holding preview or reserved OS shortcut checks.
- **Fix**: Rebuilt the shortcut capture recorder in [settings.html](file:///e:/sideProjects/dock/settings.html) and accelerator handler in [main.js](file:///e:/sideProjects/dock/main.js):
  - Supported full multi-modifier combinations (`Ctrl`, `Alt`, `Shift`, `Win` / `Super`).
  - Added live text preview (`"Ctrl + Shift + ..."`) while modifier keys are held down, finalizing only when a non-modifier key is pressed.
  - Added checks against OS-reserved shortcuts (`Ctrl+Alt+Delete`, `Win+L`, `Win+D`, `Win+E`, `Win+R`, `Win+I`, `Win+P`, `Win+X`, `Win+Tab`, `Alt+Tab`, `Alt+F4`, `Ctrl+Shift+Esc`, `Ctrl+Shift+Alt+T`, `Ctrl+Shift+Alt+R`) with clear inline warning messages.
  - Normalized accelerator comparison strings (`CommandOrControl`, `Alt`, `Shift`, `Super`) so `checkShortcutConflict` evaluates full modifier + key combinations accurately.
- **Verification**: Assigned `Ctrl+Alt+Shift+M` to shortcut actions in Settings → Shortcuts, confirmed conflict detection blocks duplicate assignment and actions trigger correctly when pressed.

## 5. FIX: Dock Startup Visibility & Expansion Restoration
- **Root Cause**: `config.autoHide` defaulted to `true` on module load, causing `dockState` to initialize in `'collapsed'` mode on startup. On ready-to-show, the renderer received `set-collapse-state: true`, applying `.collapsed` to `#dock-container` (`opacity: 0; pointer-events: none; transform: translateY(22px)`), which hid the Dock completely off-screen and disabled pointer interaction on launch.
- **Fix**: Updated `loadConfig()` in [main.js](file:///e:/sideProjects/dock/main.js) to set `autoHide` default to `false` and force `dockState = 'expanded'` on launch. Updated `createDockWindow()` ready-to-show handler to send `set-collapse-state: false` so the Dock is immediately rendered, fully visible, expanded, and interactive on startup.
- **Verification**: Launching the app renders the Dock at full width and opacity at the bottom of the screen with working hover magnification and click actions.

