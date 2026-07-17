const fs = require('node:fs');

const REQUIRED_TOP_KEYS = ['name', 'theme', 'accentColor', 'glassIntensity', 'cornerRadius'];

function bundleTheme(settings, themeName) {
  const theme = {
    name: themeName || 'Exported Theme',
    theme: settings.appearance.theme || 'dark',
    accentColor: settings.appearance.accentColor || '#007aff',
    glassIntensity: settings.appearance.glassIntensity || 'Standard',
    cornerRadius: settings.appearance.cornerRadius || 12,
    colors: {
      dockBgTint: (settings.appearance.colors || {}).dockBgTint || '',
      menuBarBgTint: (settings.appearance.colors || {}).menuBarBgTint || '',
      notificationCenterBgTint: (settings.appearance.colors || {}).notificationCenterBgTint || '',
      accentOverride: (settings.appearance.colors || {}).accentOverride || '',
      badgeColor: (settings.appearance.colors || {}).badgeColor || '',
      textColorOverride: (settings.appearance.colors || {}).textColorOverride || ''
    },
    cornerRadius: settings.appearance.cornerRadius || 12
  };
  return theme;
}

function validateThemeFile(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'File does not contain a valid JSON object.' };
  }
  for (const key of REQUIRED_TOP_KEYS) {
    if (!(key in data)) {
      return { valid: false, error: `Missing required field "${key}".` };
    }
  }
  if (!data.colors || typeof data.colors !== 'object') {
    return { valid: false, error: 'Missing required "colors" object.' };
  }
  const expectedColors = ['dockBgTint', 'menuBarBgTint', 'notificationCenterBgTint', 'accentOverride', 'badgeColor', 'textColorOverride'];
  for (const ck of expectedColors) {
    if (!(ck in data.colors)) {
      return { valid: false, error: `Missing color field "${ck}".` };
    }
  }
  return { valid: true };
}

function applyThemeToSettings(settings, theme) {
  settings.appearance.theme = theme.theme;
  settings.appearance.accentColor = theme.accentColor;
  settings.appearance.glassIntensity = theme.glassIntensity;
  settings.appearance.cornerRadius = theme.cornerRadius;
  if (!settings.appearance.colors) settings.appearance.colors = {};
  settings.appearance.colors.dockBgTint = theme.colors.dockBgTint || '';
  settings.appearance.colors.menuBarBgTint = theme.colors.menuBarBgTint || '';
  settings.appearance.colors.notificationCenterBgTint = theme.colors.notificationCenterBgTint || '';
  settings.appearance.colors.accentOverride = theme.colors.accentOverride || '';
  settings.appearance.colors.badgeColor = theme.colors.badgeColor || '';
  settings.appearance.colors.textColorOverride = theme.colors.textColorOverride || '';
  return settings;
}

module.exports = { bundleTheme, validateThemeFile, applyThemeToSettings };
