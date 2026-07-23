# Security Hardening — Round 2 Audit

## Scope
This audit covers the additions made since the initial security pass: the taskbar-replacement module, the new IPC channels, the watchdog module, and the animation smoothness changes.

## Findings

### 1. Native Code Surface (taskbarReplacement.js)
- **Approach**: Instead of `ffi-napi` (which would add a native compilation dependency for Electron v31), the module uses PowerShell with inline C# P/Invoke — this keeps the native API surface in a sandboxed child process.
- **Invocation scope**: `hideTaskbar()` and `showTaskbar()` are called ONLY from the main process. No renderer, preload, or IPC handler directly invokes them — the IPC handlers (`taskbar-hide`, `taskbar-show`) call through the module, never expose the PowerShell command string to any renderer.
- **Minimal API surface**: Only `FindWindowW` and `ShowWindow` are called (via C# DllImport). No broader Win32 API surface is exposed.

### 2. IPC Channel Audit
- New channels: `taskbar-get-state`, `taskbar-hide`, `taskbar-show`, `taskbar-write-restore-script`, `force-reset-ui`, `user-interaction`, `modal-state`
- All channels added to `VALID_IPC_CHANNELS` whitelist in `src/shared/constants.js`
- All channels follow the existing pattern: main-process-only handlers, validated payloads (where applicable)
- `taskbar-write-restore-script` returns file paths, not script content — no script content is ever sent to a renderer
- `modal-state` accepts `{ id, open }` — `id` is used only for diagnostic logging, no path or execution

### 3. JSON Integrity Checks
- New `integrityCheckJSONFile()` at startup: validates `settings.json`, `widgets.json`, `apps.json`, `config.json` parse as valid JSON
- If a file is corrupted, it is backed up with a `.bak.<timestamp>` suffix, then reset to schema defaults
- Schema defaults are minimal safe shapes defined in `integrityCheckJSONFile()`

### 4. Restore Script Security (taskbarReplacement.js)
- `getRestoreScriptContent()` generates STATIC content only — no variable interpolation from user or renderer input
- The script is a `.bat` file containing a hardcoded PowerShell command
- No arguments, no template strings with user data
- Written to userData and Desktop directories (write-only, never read back from user-controlled location)

### 5. Widget System Audit
- Widget host window and access panel still use `nodeIntegration: true` / `contextIsolation: false` — this was flagged in round 1 and remains a known risk
- Mitigation: no new IPC channels added for widgets; the taskbar-replacement module is not accessible from widget windows

### 6. Preload Scripts
- No new preload methods expose dangerous capabilities
- `userInteraction()` and `modalState()` are fire-and-forget signals with no return values
- Taskbar methods (`taskbarHide`, `taskbarShow`, `taskbarGetState`, `taskbarWriteRestoreScript`) are only exposed in `settings-preload.js` (Settings window), not in any general renderer preload

## Conclusion
The additions follow the existing contextIsolation/whitelisted-preload/validated-payload pattern. The taskbar native calls are properly confined to the main process. The restore script uses static content only. JSON integrity checks provide defense-in-depth against corrupted persistent state. The known widget host window risk is unchanged from round 1.
