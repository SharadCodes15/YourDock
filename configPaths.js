const { app } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const userDataPath = app.getPath('userData');

const settingsPath = path.join(userDataPath, 'settings.json');
const appsJsonPath = path.join(userDataPath, 'apps.json');
const configPath = path.join(userDataPath, 'config.json');

const iconsDir = path.join(userDataPath, 'icons');
const iconsCacheDir = path.join(userDataPath, 'icons-cache');

// devToolsBlacklist.json is bundled in the app and copied to userData on first run so it's always editable/extensible.
const devToolsBlacklistPath = path.join(userDataPath, 'devToolsBlacklist.json');

function initializePaths() {
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  if (!fs.existsSync(iconsCacheDir)) {
    fs.mkdirSync(iconsCacheDir, { recursive: true });
  }

  // Source paths for default templates (relative to app folder or resources folder if packaged)
  const isPackaged = app.isPackaged;
  const baseDir = isPackaged ? process.resourcesPath : __dirname;

  const defaultSettingsSrc = path.join(baseDir, 'settings.json');
  const defaultAppsSrc = path.join(baseDir, 'dock', 'apps.json');
  const defaultConfigSrc = path.join(baseDir, 'dock', 'config.json');
  const defaultBlacklistSrc = path.join(baseDir, 'devToolsBlacklist.json');

  // Copy if not exists in userData
  if (!fs.existsSync(settingsPath) && fs.existsSync(defaultSettingsSrc)) {
    try { fs.copyFileSync(defaultSettingsSrc, settingsPath); } catch (e) { console.error('Failed to copy settings.json template:', e); }
  }
  if (!fs.existsSync(appsJsonPath) && fs.existsSync(defaultAppsSrc)) {
    try { fs.copyFileSync(defaultAppsSrc, appsJsonPath); } catch (e) { console.error('Failed to copy apps.json template:', e); }
  }
  if (!fs.existsSync(configPath) && fs.existsSync(defaultConfigSrc)) {
    try { fs.copyFileSync(defaultConfigSrc, configPath); } catch (e) { console.error('Failed to copy config.json template:', e); }
  }
  if (!fs.existsSync(devToolsBlacklistPath) && fs.existsSync(defaultBlacklistSrc)) {
    try { fs.copyFileSync(defaultBlacklistSrc, devToolsBlacklistPath); } catch (e) { console.error('Failed to copy devToolsBlacklist.json template:', e); }
  }
}

module.exports = {
  settingsPath,
  appsJsonPath,
  configPath,
  iconsDir,
  iconsCacheDir,
  devToolsBlacklistPath,
  initializePaths
};
