const path = require('node:path');
const fs = require('node:fs');

const VALID_IPC_CHANNELS = new Set([
  'get-settings',
  'save-settings',
  'register-shortcut',
  'check-shortcut-conflict',
  'restore-defaults',
  'get-apps',
  'override-app-icon',
  'reset-app-icon',
  'get-config',
  'read-raw-config',
  'write-raw-config',
  'set-pinned-app-exec',
  'set-dock-app-icon',
  'reset-dock-app-icon',
  'set-dock-icon-size',
  'save-auto-hide',
  'save-dock-hiding-mode',
  'get-hide-settings',
  'save-hide-settings',
  'test-dock-hide',
  'test-menubar-hide',
  'export-settings',
  'import-settings',
  'export-theme',
  'import-theme',
  'apply-builtin-theme',
  'revert-last-import',
  'get-theme-config',
  'get-displays',
  'get-ram-usage',
  'clear-icon-cache',
  'refresh-app',
  'open-error-log',
  'open-config-folder',
  'read-experimental-flags',
  'save-experimental-flags',
  'read-raw-settings',
  'write-raw-settings',
  'get-debug-info',
  'set-verbose-logging',
  'set-volume',
  'set-brightness',
  'toggle-wifi',
  'toggle-bluetooth',
  'get-dnd',
  'set-dnd',
  'spotlight-search',
  'launch-app',
  'open-file',
  'get-volume',
  'toggle-spotlight',
  'escape-pressed',
  'get-about-info',
  'get-running-apps',
  'force-quit-app',
  'forward-shortcut',
  'window-action',
  'apple-action',
  'show-about',
  'show-force-quit',
  'refresh-apps',
  'close-welcome',
  'save-geo-prefs',
  'toggle-notification-center',
  'take-screenshot',
  'toggle-control-center',
  'close-cc-window',
  'close-notification-center',
  'hide-drawer',
  'selectCustomApp',
  'save-favorites',
  'add-to-dock',
  'remove-from-dock',
  'save-folders',
  'get-folders',
  'close-spotlight',
  'overlay-selection',
  'overlay-cancel',
  'close-toast',
  'open-settings',
  'save-config',
  'set-dock-width',
  'set-ignore-mouse',
  'quit-app',
  'show-in-finder',
  'set-dock-hover',
  'toggle-drawer',
  'keep-in-dock',
  'set-badge',
  'set-dock-height',
  'get-open-windows',
  'focus-window',
  'context-menu-state',
  'read-raw-apps',
  'write-raw-apps',
  'get-displays-detailed',
  'get-battery-info',
  'get-system-info',
  'open-external-url',
  'set-window-height',
  'process-update',
  'active-app-changed',
  'set-collapse-state',
  'settings-changed',
  'system-data-update',
  'volume-sync',
  'theme-changed',
  'apps-updated',
  'config-updated',
  'notification-settings-changed',
  'open-drawer',
  'close-drawer',
  'close-context-menu',
  'play-genie',
  'toast-data',
  'focus-input',
  'get-widgets',
  'save-widgets',
  'add-widget',
  'remove-widget',
  'update-widget',
  'toggle-widget-access-panel',
  'set-widget-edit-mode',
  'get-widget-active-summary',
  'select-photo-folder',
  'widget-action',
  'get-media-metadata',
  'media-control',
  'show-widget-toast',
  'taskbar-get-state',
  'taskbar-hide',
  'taskbar-show',
  'taskbar-restore',
  'taskbar-write-restore-script',
  'force-reset-ui',
  'user-interaction',
  'modal-state'
]);

function containsDangerousKeys(obj) {
  if (!obj || typeof obj !== 'object') return false;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return true;
      }
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (containsDangerousKeys(obj[key])) return true;
      }
    }
  }
  return false;
}

function safeParseJSON(jsonString) {
  if (typeof jsonString !== 'string') {
    throw new TypeError('Expected string for JSON parsing');
  }
  const parsed = JSON.parse(jsonString);
  if (containsDangerousKeys(parsed)) {
    throw new Error('Security Error: JSON contains prohibited keys');
  }
  return parsed;
}

function validateFilePath(userPath, allowedExtensions = []) {
  if (typeof userPath !== 'string' || !userPath.trim()) {
    throw new Error('Invalid path provided');
  }
  const normalizedPath = userPath.trim();
  if (normalizedPath.includes('\0')) {
    throw new Error('Null bytes not allowed in path');
  }
  const resolved = path.resolve(normalizedPath);
  if (allowedExtensions.length > 0) {
    const ext = path.extname(resolved).toLowerCase();
    const normalizedAllowed = allowedExtensions.map(e => e.toLowerCase().startsWith('.') ? e.toLowerCase() : '.' + e.toLowerCase());
    if (!normalizedAllowed.includes(ext)) {
      throw new Error(`Invalid file extension "${ext}". Allowed: ${normalizedAllowed.join(', ')}`);
    }
  }
  return resolved;
}

module.exports = {
  VALID_IPC_CHANNELS,
  containsDangerousKeys,
  safeParseJSON,
  validateFilePath
};
