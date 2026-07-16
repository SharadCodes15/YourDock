# Building and Running macOS Dock & Menu Bar

This document explains how to set up, test, run, and distribute the application.

## Prerequisites

- **Node.js**: Version 18 or newer.
- **OS**: Windows (optimized for Windows 10/11).

## Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run in Development Mode**:
   ```bash
   npm start
   ```

3. **Run Automated Tests**:
   ```bash
   npm test
   ```

---

## Distributing / Packaging

The project is configured with `electron-builder` to package the app for Windows.

### Build Outputs
- **NSIS Installer**: A standard Windows installer (`.exe`) with wizard, shortcut options, and an uninstaller.
- **Portable Executable**: A standalone `.exe` that runs immediately without installation.

### Packaging Commands

1. **Build Both (Installer + Portable)**:
   ```bash
   npm run dist
   ```
   The compiled binaries will be output to the `dist/` directory.

2. **Build Portable Only**:
   ```bash
   npm run dist:portable
   ```

3. **Verify Build Folder Layout**:
   ```bash
   npm run pack
   ```
   This generates the unpacked application directory inside `dist/win-unpacked` for inspection without producing a final `.exe` installer.

---

## App Data and Paths

When running in development or package mode, the application stores persistent databases (`settings.json`, `apps.json`, cached app icons, error logs) inside the OS-designated app data path to avoid permission issues:
`C:\Users\<Username>\AppData\Roaming\macos-top-menu-bar`
