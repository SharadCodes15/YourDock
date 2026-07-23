# Taskbar Replacement — Safety & Recovery Guide

## Risk Statement

Replacing the real Windows taskbar with this app's Dock + Menu Bar involves calling `ShowWindow(SW_HIDE)` on the `Shell_TrayWnd` window. If this app crashes or becomes unresponsive while the real taskbar is hidden, the user could be left without a visible taskbar.

## How Restoration Works

The safety net has **five independent layers**, any one of which can restore the taskbar:

### Layer 1: Standalone Restore Script (on disk)
Before the taskbar is ever hidden, a `restore-taskbar.bat` script is written to:
- `%APPDATA%\macOS Dock and Menu Bar\restore-taskbar.bat` (userData folder)
- `%USERPROFILE%\Desktop\restore-taskbar.bat` (Desktop)

This script requires zero dependencies — it contains a hardcoded PowerShell command that shows both the primary and secondary taskbars. Run it by:
- Double-clicking the file on your Desktop
- Opening a Command Prompt and typing the full path to the file
- Pressing `Win+R`, typing the path, and pressing Enter

### Layer 2: System Tray Icon Menu
Right-click the app's tray icon (in the notification area/system tray). Select **"Restore Windows Taskbar"** from the context menu. This button is always present, regardless of whether the taskbar is currently hidden.

### Layer 3: Global Hotkey
Press **`Ctrl+Shift+Alt+T`** at any time. This hotkey is registered as early as possible during app startup and is independent of whether other features have initialized. It force-restores the taskbar regardless of the app's internal state.

### Layer 4: Automatic Crash/Quit Handlers
The app automatically restores the taskbar when any of these events occur:
- **Before app quit**: The `before-quit` event triggers taskbar restoration
- **Unhandled exception**: A main-process crash restores the taskbar before showing the error dialog
- **Unhandled promise rejection**: Taskbar is restored as part of the error logging
- **Renderer crash**: If the Dock or Menu Bar renderer process crashes while taskbar replacement is active, the real taskbar is immediately restored

### Layer 5: Startup Safety Check
On every app startup, if the settings contain a stale `taskbarReplacementEnabled: true` flag (from a previous session that crashed before it could clean up), the app immediately restores the taskbar and clears the flag — it never trusts that "it was hidden last session" means it should stay hidden.

## Manual Recovery Steps

If the app itself becomes completely unresponsive:

1. **Try the tray icon**: Right-click the app's icon in the system tray notification area — even if the main windows are frozen, the tray context menu often still works.
2. **Use the global hotkey**: Press `Ctrl+Shift+Alt+T` — this keyboard shortcut is registered at the OS level and works even if the app's event loop is busy.
3. **Run the restore script directly**: Navigate to your Desktop or `%APPDATA%\macOS Dock and Menu Bar\` and double-click `restore-taskbar.bat`.
4. **Task Manager**: If nothing else works:
   - Press `Ctrl+Shift+Esc` to open Task Manager
   - Find `electron.exe` or `macOS Dock and Menu Bar` in the process list
   - Right-click and select "End Task"
   - **Note**: Ending the app process automatically triggers the `before-quit` handler which restores the taskbar
5. **Restart Explorer**: As a last resort:
   - Open Task Manager (`Ctrl+Shift+Esc`)
   - Click "File" → "Run new task"
   - Type `cmd` and check "Create this task with administrative privileges"
   - In the command prompt, type: `taskkill /f /im explorer.exe && start explorer.exe`
   - This restarts Windows Explorer, which will re-create the taskbar

## Verified Safe Conditions

- Calling restore when the taskbar is already visible is safe — `ShowWindow(SW_SHOW)` on an already-visible window is a no-op.
- The `restoreTaskbarSafe()` function wraps everything in try/catch. It cannot throw.
- The restore script contains static content only — no variable interpolation from user input.
