# Desktop Widgets System Architecture & Documentation

## Overview

The Desktop Widget System is a completely isolated, lightweight subsystem built for this Electron application. It provides customizable desktop widgets (Clock, Calendar, Weather, System Monitor, Sticky Notes, Quick Launch, Countdown, Now Playing, Photo Slideshow, Quote of the Moment) while ensuring **zero RAM and CPU cost when no widgets are placed**.

---

## Core Architecture & Zero-Cost Guarantee

1. **Single Fullscreen Host Window**:
   - Rather than creating a separate `BrowserWindow` per widget (which consumes 50MB+ RAM per window), all placed widgets are rendered as absolutely positioned DOM elements inside **one single transparent `BrowserWindow`**.
   - The host window is frameless, fullscreen-sized, and click-through (`setIgnoreMouseEvents(true, { forward: true })`) except directly over placed widget elements or controls.

2. **Lazy Lifecycle & Auto-Destruction**:
   - **Zero Widgets Placed = Zero Windows & Zero Timers**: The host window is **not created** until the first widget is added to the desktop.
   - When the user removes the last active widget, the host window is **fully destroyed** (`win.destroy()`) and nullified. All background timers, renderer intervals, and IPC listeners are completely unregistered.
   - App RAM usage with 0 widgets placed is strictly identical to app RAM usage before the feature was added.

3. **Per-Type Active Instance Tracking**:
   - Background update loops (such as System Monitor 2s refresh or Weather 30m fetch) run ONLY if `activeCount(widgetType) > 0`.
   - Managed via `src/main/widgets/widgetRegistry.js`. When the count for a type drops to 0, its update loop is automatically stopped.

4. **Window State Pausing**:
   - When the host window is minimized or hidden, all widget timers pause automatically (`widgets-pause-timers`) and resume when restored.

---

## Native API Limitations Note: Safe Desktop Z-Ordering

> [!NOTE]
> True "pinned to desktop background layer behind desktop icons" behavior on Windows (like Wallpaper Engine) requires a native C++ Win32 API hack that reparents the window to Windows' internal `WorkerW` / `Progman` window hierarchy using `SetParent`.
> Per architectural safety directions, native C++ platform hacks are avoided to maintain Electron stability across system updates.
> This subsystem uses Electron's safe, cross-platform window z-ordering:
> - The host window runs as a standard non-`alwaysOnTop` transparent window.
> - When application windows are focused, the widget host naturally falls behind them.

---

## Access Panel & Edit Mode

1. **Widget Access Panel**:
   - **Trigger**: Global hotkey (`Ctrl+Shift+W` default suggestion) or IPC event.
   - **Styling**: Slides in from the right edge (~330px wide) with macOS glassmorphism backdrop blur.
   - **No-Icon Design**: Lists available widget types using **live mini rendered previews** (scaled real DOM instances) instead of static icons or thumbnails.
   - Cards feature an "Add to Desktop" button.

2. **KDE-Plasma Edit Mode**:
   - **VIEW Mode**: Widgets display cleanly and pass desktop clicks through empty background space.
   - **EDIT Mode**: Entered when Access Panel opens or via "Edit Mode" toggle. Placed widgets show dashed borders, move drag bars, resize handles (bottom-right), delete buttons ("×"), and inline settings gear buttons ("⚙").
   - Position, size, and settings automatically persist to `widgets.json`.

---

## Data Model & Configuration (`widgets.json`)

All widget configurations are stored in a dedicated `widgets.json` file inside `app.getPath('userData')`:

```json
{
  "editMode": false,
  "widgets": [
    {
      "id": "widget_1700000000000_abc12",
      "type": "clock",
      "x": 100,
      "y": 100,
      "width": 220,
      "height": 140,
      "settings": {
        "face": "digital",
        "showSeconds": true,
        "fontColor": "#ffffff"
      }
    }
  ]
}
```

---

## Summary of the 10 Widget Types

| # | Widget Type | Description | Refresh & Polling |
|---|---|---|---|
| 1 | **Clock** | Digital/Analog face with optional seconds hand & color picker | 1s interval (only when placed) |
| 2 | **Mini Calendar** | Month grid with current date highlight & navigation | Date rollover check |
| 3 | **Weather** | Current temp & condition (reuses Open-Meteo integration) | 30 min cache |
| 4 | **System Monitor** | CPU% and RAM% live mini bars | 2s interval (pauses when hidden) |
| 5 | **Sticky Note** | Rich color paper notes with debounced 500ms auto-save | Event-driven text input |
| 6 | **Quick Launch Tile** | 2x2 or 3x3 app shortcut launcher grid | Click-driven, zero polling |
| 7 | **Countdown Timer** | Target date/time countdown with finish alert | 1s interval (only when placed) |
| 8 | **Now Playing** | Media title, artist & playback controls | Smart polling (2s active / 10s idle) |
| 9 | **Photo Slideshow** | Album folder viewer with Ken Burns pan/zoom | Configurable (default 10s) |
| 10 | **Quote of the Moment** | Bundled local quote list (zero network calls) | 1 hour rotation or click |

---

## Performance Settings Integration

A read-only status row is exposed in **Settings → Performance**:
`Active widgets: N (types: clock, weather, ...)`
allowing memory-conscious users to monitor widget resource usage in real time.
