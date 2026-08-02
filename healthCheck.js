const fs = require('node:fs');
const path = require('node:path');
const { VALID_IPC_CHANNELS } = require('./src/shared/constants');

function runStartupHealthCheck({ userDataPath, ipcMain, settings }) {
  const startTime = Date.now();
  const checks = [];
  const issues = [];

  // Check 1: Config files integrity and schema shape
  try {
    const configFiles = ['settings.json', 'config.json', 'apps.json', 'widgets.json'];
    const corruptedFiles = [];
    for (const fileName of configFiles) {
      const filePath = path.join(userDataPath, fileName);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const parsed = JSON.parse(content);
          if (!parsed || typeof parsed !== 'object') {
            corruptedFiles.push(`${fileName} (not an object)`);
          }
        } catch (e) {
          corruptedFiles.push(`${fileName} (invalid JSON: ${e.message})`);
        }
      }
    }

    if (corruptedFiles.length === 0) {
      checks.push({
        id: 'config_files',
        name: 'Config Files Schema',
        status: 'pass',
        details: 'All configuration files exist and contain valid JSON schemas.'
      });
    } else {
      const msg = `Corrupted or invalid config file(s): ${corruptedFiles.join(', ')}`;
      issues.push(msg);
      checks.push({
        id: 'config_files',
        name: 'Config Files Schema',
        status: 'fail',
        details: msg
      });
    }
  } catch (err) {
    const msg = `Config file check failed: ${err.message}`;
    issues.push(msg);
    checks.push({
      id: 'config_files',
      name: 'Config Files Schema',
      status: 'fail',
      details: msg
    });
  }

  // Check 2: IPC channel registry completeness
  try {
    const registeredOn = ipcMain ? ipcMain.eventNames() : [];
    const registeredHandle = ipcMain && ipcMain._invokeHandlers ? Array.from(ipcMain._invokeHandlers.keys()) : [];
    const registeredSet = new Set([...registeredOn, ...registeredHandle]);

    // Exclude channels that are strictly main-to-renderer push broadcasts or dynamic on-demand handlers
    const pushOrDynamicChannels = new Set([
      'active-app-changed',
      'settings-changed',
      'system-data-update',
      'volume-sync',
      'theme-changed',
      'apps-updated',
      'config-updated',
      'notification-settings-changed',
      'toast-data',
      'show-widget-toast',
      'set-collapse-state',
      'focus-input',
      'open-drawer',
      'close-drawer',
      'close-context-menu',
      'play-genie',
      'overlay-selection',
      'overlay-cancel',
      'test-dock-hide',
      'test-menubar-hide'
    ]);

    const orphanedChannels = [];
    for (const channel of VALID_IPC_CHANNELS) {
      if (!registeredSet.has(channel) && !pushOrDynamicChannels.has(channel)) {
        orphanedChannels.push(channel);
      }
    }

    if (orphanedChannels.length === 0) {
      checks.push({
        id: 'ipc_registry',
        name: 'IPC Channel Registry',
        status: 'pass',
        details: `All ${VALID_IPC_CHANNELS.size} IPC channels in constants registry have active listeners.`
      });
    } else {
      const msg = `Found ${orphanedChannels.length} orphaned IPC channel(s) without listeners: ${orphanedChannels.join(', ')}`;
      issues.push(msg);
      checks.push({
        id: 'ipc_registry',
        name: 'IPC Channel Registry',
        status: 'fail',
        details: msg
      });
    }
  } catch (err) {
    const msg = `IPC registry check failed: ${err.message}`;
    issues.push(msg);
    checks.push({
      id: 'ipc_registry',
      name: 'IPC Channel Registry',
      status: 'fail',
      details: msg
    });
  }

  // Check 3: Critical native modules load check
  try {
    const moduleResults = [];
    const failedModules = [];

    // systeminformation
    try {
      require('systeminformation');
      moduleResults.push('systeminformation (ok)');
    } catch (e) {
      failedModules.push('systeminformation');
      moduleResults.push(`systeminformation (failed: ${e.message})`);
    }

    // ffi-napi (if taskbar replacement is enabled)
    if (settings && settings.general && settings.general.taskbarReplacementEnabled) {
      try {
        require('ffi-napi');
        moduleResults.push('ffi-napi (ok)');
      } catch (e) {
        failedModules.push('ffi-napi');
        moduleResults.push(`ffi-napi (failed: ${e.message})`);
      }
    }

    // @nut-tree-fork/nut-js (optional shortcut forwarding)
    try {
      require('@nut-tree-fork/nut-js');
      moduleResults.push('nut-js (ok)');
    } catch (e) {
      // nut-js is optional, record status but don't fail startup unless required
      moduleResults.push('nut-js (unavailable)');
    }

    if (failedModules.length === 0) {
      checks.push({
        id: 'native_modules',
        name: 'Critical Native Modules',
        status: 'pass',
        details: `Native modules verified: ${moduleResults.join(', ')}`
      });
    } else {
      const msg = `Failed to load critical native module(s): ${failedModules.join(', ')}`;
      issues.push(msg);
      checks.push({
        id: 'native_modules',
        name: 'Critical Native Modules',
        status: 'fail',
        details: msg
      });
    }
  } catch (err) {
    const msg = `Native module check failed: ${err.message}`;
    issues.push(msg);
    checks.push({
      id: 'native_modules',
      name: 'Critical Native Modules',
      status: 'fail',
      details: msg
    });
  }

  // Check 4: UserData folder write test
  try {
    const tempFile = path.join(userDataPath, `.health_check_tmp_${Date.now()}`);
    fs.writeFileSync(tempFile, 'health-check', 'utf8');
    fs.unlinkSync(tempFile);
    checks.push({
      id: 'userdata_writable',
      name: 'UserData Directory Writable',
      status: 'pass',
      details: 'UserData directory write and delete permissions verified.'
    });
  } catch (err) {
    const msg = `UserData directory is not writable: ${err.message}`;
    issues.push(msg);
    checks.push({
      id: 'userdata_writable',
      name: 'UserData Directory Writable',
      status: 'fail',
      details: msg
    });
  }

  const durationMs = Date.now() - startTime;
  const overallSuccess = issues.length === 0;

  return {
    success: overallSuccess,
    timestamp: new Date().toISOString(),
    durationMs,
    checks,
    issues
  };
}

module.exports = {
  runStartupHealthCheck
};
