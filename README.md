# 🚀 YourDock

<div align="center">

> **A modern macOS-inspired Dock and Menu Bar for Windows & Linux built with Electron.js**

![Electron](https://img.shields.io/badge/Electron-37+-47848F?style=for-the-badge&logo=electron&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**Lightweight • Beautiful • Customizable • Native Feel**

</div>

---

## 📖 Overview

**YourDock** is a lightweight desktop dock inspired by **macOS**, designed for **Windows** and **Linux**. It provides a smooth application launcher, customizable dock, top menu bar, and a robust widget system while maintaining low RAM usage.

Built entirely using:

- ⚡ Electron.js
- 🌐 HTML5
- 🎨 CSS3
- 📜 Vanilla JavaScript

No frontend frameworks are used, making the project easy to understand, customize, and extend.

---

# 📷 Preview

Place your screenshots inside the project root and reference them below.

<!-- Main application screenshot -->
![Demo](Demo_v2.0.0.png)

<!-- Placeholder for Widgets Panel screenshot -->
<!-- ![Widgets Panel](widgets_preview.png) -->

<!-- Placeholder for Control Center screenshot -->
<!-- ![Control Center](controlcenter_preview.png) -->

<!-- Placeholder for Settings Panel screenshot -->
<!-- ![Settings Panel](settings_preview.png) -->

---

# ✨ Features

## 🖥 Dock

- macOS inspired dock
- Smooth hover magnification
- Running application indicators
- Pin favorite applications
- Drag & reorder dock icons
- Launch applications directly
- Smart app ordering
- Auto hide dock
- Dock transparency
- Blur effects
- Rounded modern design
- Lightweight performance
- Native system integration

---

## 📌 Menu Bar

- macOS style top menu bar
- System tray integration
- Clock & Date
- Battery Indicator
- WiFi Status
- Bluetooth Indicator
- Volume Control
- Notifications
- Application Menus
- Quick Access Controls

---

## ⚙ Settings

The application includes a modern Settings page with multiple configuration categories.

### General

- Launch at Login
- Show in Dock / Taskbar
- Start Minimized to Tray
- Smart Ordering in Dock
- Enable Location
- Location Permission
- Pinned App Executables

---

### Appearance

- Light Theme
- Dark Theme
- Accent Colors
- Blur Effects
- Transparency
- Rounded Corners
- Dock Size
- Icon Size

---

### Hiding

- Auto Hide Dock & Menu Bar with state-machine-backed hide/reveal transition control
- Custom Reveal Delays and Edge Hotspot activation
- Hiding watchdog safety daemon to prevent stuck/partially hidden states
- Escape-key global override to instantly hide active panel layers
- Intelligent Hide

---

### Menu Items

- Customize Menu Bar
- Rearrange Items
- Show/Hide Icons
- Quick Toggles

---

### App Icons

- Change Dock Icons
- Custom Icons
- Icon Labels
- Icon Animation
- Indicator Style

---

### Displays

- Multi Monitor Support
- Dock Position
- Primary Display
- Display Scaling
- Auto Detect Displays

---

### Shortcuts

- Keyboard Shortcuts
- Global Hotkeys
- Open Dock
- Open Settings
- Launch Applications

---

### Performance

- Hardware Acceleration
- Animation Speed
- Memory Optimization
- Low Power Mode
- Startup Optimization

---

### About

- Version Information
- Updates
- Credits
- License
- Project Information

---

## 🧩 Widgets System

- **Widget Access Panel**: A dedicated overlay displaying multiple integrated widgets.
- **Widget Host Windows**: Floating, customizable desktop widgets.
- **Included Widgets**:
  - 📅 **Calendar**: View monthly layout.
  - ⏰ **Clock**: Modern time display.
  - 🌤️ **Weather**: Current weather updates.
  - 📊 **System Monitor**: CPU, RAM, and system resource indicators.
  - 📝 **Sticky Notes**: Quick notepad on your desktop.
  - 🚀 **Quick Launch**: Desktop app shortcuts.
  - ⏳ **Countdown**: Event timers.
  - 🎵 **Now Playing**: Current music track controller.
  - 🖼️ **Photo Slideshow**: Image carousel.
  - 💬 **Quote of the Day**: Inspirational updates.

---

## 🛠 Tech Stack

| Technology | Usage |
|------------|------|
| Electron.js | Desktop Application |
| HTML5 | UI Structure |
| CSS3 | Styling |
| JavaScript | Application Logic |

---

# 📂 Project Structure

```
dock
├── Demo.png
├── README.md
├── about.html
├── appscanner.js
├── build
│   ├── icon.ico
│   └── icon.png
├── closeOnEscape.js
├── configPaths.js
├── controlcenter-preload.js
├── controlcenter.html
├── devToolsBlacklist.json
├── dock
│   ├── apps.json
│   ├── config.json
│   ├── drawer-preload.js
│   ├── drawer.html
│   ├── icons
│   ├── icons-cache
│   ├── index.html
│   ├── main.js
│   ├── package.json
│   └── preload.js
├── dockHideController.js
├── experimental-flags.json
├── focusForwarder.js
├── forcequit.html
├── main.js
├── menuBarHideController.js
├── notificationcenter-preload.js
├── notificationcenter.html
├── package.json
├── preload.js
├── screenshot-overlay-preload.js
├── screenshot-overlay.html
├── screenshot-toast-preload.js
├── screenshot-toast.html
├── screenshot.js
├── settings-preload.js
├── settings.html
├── settings.json
├── spotlight-preload.js
├── spotlight.html
├── src
│   ├── main
│   │   ├── config
│   │   ├── ipc
│   │   ├── state
│   │   ├── system
│   │   ├── widgets
│   │   │   ├── index.js
│   │   │   ├── widgetAccessPanel.js
│   │   │   ├── widgetHostWindow.js
│   │   │   ├── widgetRegistry.js
│   │   │   └── widgetsStore.js
│   │   └── windows
│   ├── renderer
│   └── shared
│       ├── constants.js
│       ├── hideStateMachine.js
│       └── settingsSchema.js
├── startupVisibility.js
├── taskbarReplacement.js
├── tests
├── theme-export.js
├── watchdog.js
├── weather.js
├── welcome.html
└── windowManager.js
```

---

# 🚀 Installation
1> 📥 Download

Download the latest version from the **Releases** page:

https://github.com/SharadCodes15/YourDock/releases/latest

2 >
Clone the repository

```bash
git clone https://github.com/SharadCodes15/YourDock.git
```

Go into the project

```bash
cd YourDock
```

Install dependencies

```bash
npm install
```

Run

```bash
npm start
```

---

# 📦 Build

To bundle and package the application into production-ready executables, use the following scripts:

Build unpacked directory (for local testing):
```bash
npm run pack
```

Build production installers and distributions:
```bash
npm run dist
```

Build portable executable (Windows):
```bash
npm run dist:portable
```

---

# 🎯 Roadmap

- [x] Dock
- [x] Menu Bar
- [x] Settings Window
- [x] Dock Animations
- [x] Blur Effects
- [x] Tray Support
- [x] Multi Display Support
- [x] Auto Hide & Transition State Machine
- [x] Widgets System
  - [x] Weather Widget
  - [x] Calendar
  - [x] System Monitor
  - [x] Music Controls (Now Playing)
- [x] Notification Center
- [x] Taskbar Replacement
- [ ] Virtual Desktops
- [ ] Plugin System
- [ ] Themes Marketplace
- [ ] Custom CSS Support

---

# 💡 Why YourDock?

- Extremely lightweight
- Minimal RAM usage
- Fast startup
- Clean UI
- Fully customizable
- Modern animations
- Electron based
- Easy to contribute
- Beginner friendly codebase

---

# 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create your feature branch

```bash
git checkout -b feature/NewFeature
```

Commit your changes

```bash
git commit -m "Add amazing feature"
```

Push to the branch

```bash
git push origin feature/NewFeature
```

Open a Pull Request.

---


# ❤️ Acknowledgements

Inspired by

- macOS Dock
- macOS Menu Bar
- MyDockFinder
- Modern Desktop UI Design

---

<div align="center">

### ⭐ If you like this project, give it a Star!

Made with ❤️ using Electron.js

</div>
