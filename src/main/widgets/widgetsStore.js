const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

function getWidgetsPath() {
  const userDataPath = app ? app.getPath('userData') : path.join(process.cwd(), 'userData');
  return path.join(userDataPath, 'widgets.json');
}

// Default dimension & settings presets per widget type
const DEFAULT_WIDGET_PRESETS = {
  'clock': { width: 220, height: 140, settings: { face: 'digital', showSeconds: true, fontColor: '#ffffff', fontSize: 24 } },
  'calendar': { width: 260, height: 240, settings: { accentColor: '#007aff' } },
  'weather': { width: 240, height: 160, settings: { city: '' } },
  'system-monitor': { width: 260, height: 150, settings: { refreshIntervalMs: 2000 } },
  'sticky-note': { width: 220, height: 200, settings: { text: 'New Note', color: '#fef08a' } },
  'quick-launch': { width: 220, height: 220, settings: { grid: '2x2', apps: [] } },
  'countdown': { width: 240, height: 140, settings: { title: 'Countdown', targetTime: Date.now() + 3600000, notifyOnFinish: true } },
  'now-playing': { width: 280, height: 140, settings: { pollIntervalMs: 2000 } },
  'slideshow': { width: 300, height: 220, settings: { folderPath: '', intervalSec: 10, kenBurns: true } },
  'quote': { width: 280, height: 150, settings: { fontColor: '#ffffff', fontStyle: 'normal' } }
};

let memoryStore = null;

function loadStoreFromFile(customFilePath = null) {
  const filePath = customFilePath || getWidgetsPath();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(content);
      return {
        widgets: Array.isArray(parsed.widgets) ? parsed.widgets : [],
        editMode: Boolean(parsed.editMode)
      };
    }
  } catch (err) {
    console.error('[widgetsStore] Failed to read widgets.json:', err.message);
  }
  return { widgets: [], editMode: false };
}

function saveStoreToFile(storeData, customFilePath = null) {
  const filePath = customFilePath || getWidgetsPath();
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(storeData, null, 2), 'utf8');
  } catch (err) {
    console.error('[widgetsStore] Failed to write widgets.json:', err.message);
  }
}

class WidgetsStore {
  constructor(customFilePath = null) {
    this.customFilePath = customFilePath;
    this.data = loadStoreFromFile(this.customFilePath);
  }

  getWidgets() {
    return this.data.widgets;
  }

  saveWidgets(widgets) {
    this.data.widgets = Array.isArray(widgets) ? widgets : [];
    saveStoreToFile(this.data, this.customFilePath);
    return this.data.widgets;
  }

  getEditMode() {
    return this.data.editMode;
  }

  setEditMode(editMode) {
    this.data.editMode = Boolean(editMode);
    saveStoreToFile(this.data, this.customFilePath);
    return this.data.editMode;
  }

  addWidget(type, initialPos = {}) {
    const preset = DEFAULT_WIDGET_PRESETS[type] || { width: 220, height: 160, settings: {} };
    const id = `widget_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    
    // Stagger initial position if not specified
    const offset = (this.data.widgets.length * 30) % 300;
    const newWidget = {
      id,
      type,
      x: typeof initialPos.x === 'number' ? initialPos.x : 100 + offset,
      y: typeof initialPos.y === 'number' ? initialPos.y : 100 + offset,
      width: initialPos.width || preset.width,
      height: initialPos.height || preset.height,
      settings: Object.assign({}, preset.settings, initialPos.settings || {})
    };

    this.data.widgets.push(newWidget);
    saveStoreToFile(this.data, this.customFilePath);
    return newWidget;
  }

  removeWidget(id) {
    const initialLen = this.data.widgets.length;
    this.data.widgets = this.data.widgets.filter(w => w.id !== id);
    if (this.data.widgets.length !== initialLen) {
      saveStoreToFile(this.data, this.customFilePath);
    }
    return this.data.widgets;
  }

  updateWidget(id, updates) {
    const widget = this.data.widgets.find(w => w.id === id);
    if (!widget) return null;

    if (typeof updates.x === 'number') widget.x = updates.x;
    if (typeof updates.y === 'number') widget.y = updates.y;
    if (typeof updates.width === 'number') widget.width = updates.width;
    if (typeof updates.height === 'number') widget.height = updates.height;
    if (updates.settings && typeof updates.settings === 'object') {
      widget.settings = Object.assign({}, widget.settings, updates.settings);
    }

    saveStoreToFile(this.data, this.customFilePath);
    return widget;
  }
}

module.exports = {
  WidgetsStore,
  DEFAULT_WIDGET_PRESETS
};
