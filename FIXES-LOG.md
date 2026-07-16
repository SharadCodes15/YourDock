# Fixes & Stability Log

This log outlines the improvements and stability passes implemented to make the macOS Dock & Menu Bar application production-ready.

---

## 1. Directory Path & Packaging Safety Pass
- **Issue**: Bundling files directly with `__dirname` caused read-only ASAR runtime write failures on packaged builds.
- **Fix**: Created `configPaths.js` to resolve paths dynamically. All user configurations, database assets (`settings.json`, `apps.json`, `config.json`), log directories, and downloaded icons are resolved using `app.getPath('userData')`.
- **Details**:
  - Automatically loads and migrates templates from the app directory to the user space.
  - Reset config JSON files to clean templates to avoid hardcoded machine leaks.

---

## 2. Global Exception Safety
- **Issue**: Unhandled promise rejections or uncaught exceptions crashed the main process.
- **Fix**: Wrapped the application entry point inside global uncaught/unhandled handlers.
  - Stack traces are logged with local timestamps to `%APPDATA%/macos-top-menu-bar/logs/error.log`.
  - Non-crashing dialogues are presented in case of fatal initialization issues.
  - Patched `ipcMain` handlers to catch and report IPC exceptions gracefully.

---

## 3. White-Flash & Slower-Device Safeguards
- **Issue**: Slower systems experienced an ugly white flash or layout repaint shift when displaying new windows.
- **Fix**: Configured Settings, Drawer, Control Center, About, and Force Quit windows to initialize with `show: false`. Exposed the `'ready-to-show'` event from Electron to trigger `.show()` only after layout rendering finishes.

---

## 4. UI Polish & Customizations
- **Settings Panel Additions**:
  - Integrated Dock position settings (Bottom, Left, Right).
  - Integrated Dock size preset options (Small, Medium, Large).
  - Integrated a global accessibility toggle for "Reduce Motion" (appends `.reduce-motion` selector app-wide).
  - Added a hotkey input for toggling the Drawer globally.
  - Added a "View Error Log" button linking directly to the local logs path.
- **Visual Easing Curves**:
  - Replaced mechanical linear CSS transitions with springy `cubic-bezier(0.16, 1, 0.3, 1)` easing curves.
  - Configured dropdown menus to slide and fade in 120ms.
- **Launchpad-style Folders**:
  - Added drag-and-drop merging of applications inside the Drawer.
  - Persistent schema mappings added in `apps.json` under `folders`.
  - Double-click rename functionality implemented for folders.

---

## 5. Main Process & Preload Integration Bug Fixes
- **Issue (Launcher Apps Empty)**: A block-scoped `const data` declaration inside an `if` block in the `get-apps` IPC handler caused a `ReferenceError` when accessed outside, resulting in an empty apps grid on startup/refresh.
  - **Fix**: Moved the declaration of `data` outside the conditional scope in `main.js`.
- **Issue (Dock Quit Application Bug)**: Clicking "Quit" for a scanned app in the Dock context menu closed the entire Dock process instead of closing the scanned app.
  - **Fix**: Corrected the `quitApp` IPC method in `dock/preload.js` to accept and correctly forward the `appId` parameter to `main.js`.

