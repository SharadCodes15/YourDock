/**
 * Settings Schema & Migration Utilities for Independent Hiding Controllers
 */

const DEFAULT_DOCK_HIDE_SETTINGS = {
  enabled: true,
  triggerMode: 'always', // 'always' | 'fullscreen-only'
  hotspotWidth: 'medium', // 'narrow' | 'medium' | 'wide'
  revealDelayMs: 'instant', // 'instant' | 'short' | 'normal'
  hideDelayMs: 400
};

const DEFAULT_MENUBAR_HIDE_SETTINGS = {
  enabled: true,
  triggerMode: 'always', // 'always' | 'fullscreen-only'
  hotspotWidth: 'medium', // 'narrow' | 'medium' | 'wide'
  revealDelayMs: 'instant', // 'instant' | 'short' | 'normal'
  hideDelayMs: 400
};

const HOTSPOT_WIDTH_MAP = {
  narrow: 100,
  medium: 200,
  wide: 350
};

const REVEAL_DELAY_MAP = {
  instant: 0,
  short: 150,
  normal: 300
};

function resolveHotspotPixels(presetStr) {
  if (typeof presetStr === 'number' && presetStr > 0) return presetStr;
  return HOTSPOT_WIDTH_MAP[presetStr] || HOTSPOT_WIDTH_MAP.medium;
}

function resolveRevealDelayMs(presetStr) {
  if (typeof presetStr === 'number' && presetStr >= 0) return presetStr;
  return REVEAL_DELAY_MAP[presetStr] !== undefined ? REVEAL_DELAY_MAP[presetStr] : REVEAL_DELAY_MAP.instant;
}

function sanitizeHideSettings(input, defaults) {
  const result = { ...defaults, ...(input || {}) };
  if (typeof result.enabled !== 'boolean') result.enabled = defaults.enabled;
  if (!['always', 'fullscreen-only'].includes(result.triggerMode)) result.triggerMode = defaults.triggerMode;
  if (!['narrow', 'medium', 'wide'].includes(result.hotspotWidth)) result.hotspotWidth = defaults.hotspotWidth;
  if (!['instant', 'short', 'normal'].includes(result.revealDelayMs)) result.revealDelayMs = defaults.revealDelayMs;
  
  let delay = Number(result.hideDelayMs);
  if (isNaN(delay)) delay = defaults.hideDelayMs;
  result.hideDelayMs = Math.max(200, Math.min(800, delay));
  return result;
}

function migrateSettings(settings = {}) {
  const updated = { ...settings };
  if (!updated.general) updated.general = {};
  if (updated.general.magnificationEnabled === undefined) {
    updated.general.magnificationEnabled = true;
  }
  if (!updated.hiding) {
    updated.hiding = {
      enabled: true,
      mode: 'collapsed',
      sensitivity: 100,
      delay: 400,
      pillWidth: 180,
      menuBarIsland: false
    };
  }
  const legacyHiding = updated.hiding;

  if (!updated.dockHideSettings) {
    updated.dockHideSettings = sanitizeHideSettings({
      enabled: legacyHiding.enabled !== undefined ? legacyHiding.enabled : DEFAULT_DOCK_HIDE_SETTINGS.enabled,
      triggerMode: DEFAULT_DOCK_HIDE_SETTINGS.triggerMode,
      hotspotWidth: DEFAULT_DOCK_HIDE_SETTINGS.hotspotWidth,
      revealDelayMs: DEFAULT_DOCK_HIDE_SETTINGS.revealDelayMs,
      hideDelayMs: legacyHiding.delay !== undefined ? legacyHiding.delay : DEFAULT_DOCK_HIDE_SETTINGS.hideDelayMs
    }, DEFAULT_DOCK_HIDE_SETTINGS);
  } else {
    updated.dockHideSettings = sanitizeHideSettings(updated.dockHideSettings, DEFAULT_DOCK_HIDE_SETTINGS);
  }

  if (!updated.menuBarHideSettings) {
    updated.menuBarHideSettings = sanitizeHideSettings({
      enabled: legacyHiding.enabled !== undefined ? legacyHiding.enabled : DEFAULT_MENUBAR_HIDE_SETTINGS.enabled,
      triggerMode: DEFAULT_MENUBAR_HIDE_SETTINGS.triggerMode,
      hotspotWidth: DEFAULT_MENUBAR_HIDE_SETTINGS.hotspotWidth,
      revealDelayMs: DEFAULT_MENUBAR_HIDE_SETTINGS.revealDelayMs,
      hideDelayMs: legacyHiding.delay !== undefined ? legacyHiding.delay : DEFAULT_MENUBAR_HIDE_SETTINGS.hideDelayMs
    }, DEFAULT_MENUBAR_HIDE_SETTINGS);
  } else {
    updated.menuBarHideSettings = sanitizeHideSettings(updated.menuBarHideSettings, DEFAULT_MENUBAR_HIDE_SETTINGS);
  }

  return updated;
}

module.exports = {
  DEFAULT_DOCK_HIDE_SETTINGS,
  DEFAULT_MENUBAR_HIDE_SETTINGS,
  HOTSPOT_WIDTH_MAP,
  REVEAL_DELAY_MAP,
  resolveHotspotPixels,
  resolveRevealDelayMs,
  sanitizeHideSettings,
  migrateSettings
};
