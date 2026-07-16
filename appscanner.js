const path = require('node:path');

/**
 * Parses and filters the raw start menu apps list.
 * @param {Array} parsed Raw shortcut list [{ name, target }]
 * @param {Object} settings User settings object
 * @param {Object} devToolsBlacklist Blacklist configuration
 * @returns {Array} List of filtered and formatted app objects
 */
function processScannedApps(parsed, settings, devToolsBlacklist) {
  const nameKeywords = devToolsBlacklist.nameKeywords || [];
  const devToolKeywords = devToolsBlacklist.devToolKeywords || [];
  const exeBlacklist = (devToolsBlacklist.exeBlacklist || []).map(e => e.toLowerCase());

  const seenExePaths = new Set();
  const apps = [];

  for (const entry of parsed) {
    if (!entry || !entry.name || !entry.target) continue;

    const nameLower = entry.name.toLowerCase();
    const targetLower = (entry.target || '').toLowerCase();

    // Base blacklist filter (always applied — junk entries like uninstall/readme/help)
    const isBlacklisted = nameKeywords.some(kw => nameLower.includes(kw) || targetLower.includes(kw));
    if (isBlacklisted) continue;

    // Multi-signal dev-tool filtering — only when hideDevTools setting is ON (default true)
    const hideDevTools = !(settings.general && settings.general.hideDevTools === false);
    if (hideDevTools) {
      // Signal 1: Dev-tool name/path keyword match
      const isDevTool = devToolKeywords.some(kw => nameLower.includes(kw) || targetLower.includes(kw));
      if (isDevTool) continue;

      // Signal 2: Target exe is a known console/runtime executable
      const exeBasename = path.basename(targetLower);
      const isBlacklistedExe = exeBlacklist.includes(exeBasename);
      if (isBlacklistedExe) continue;
    }

    // Must have a real executable target (skip URLs, empty targets, folders)
    if (!entry.target || (!targetLower.endsWith('.exe') && !targetLower.endsWith('.msc') && !targetLower.endsWith('.cmd') && !targetLower.endsWith('.bat'))) continue;

    // De-duplicate by target exe path (case-insensitive)
    const dedupeKey = targetLower.replace(/\\/g, '/');
    if (seenExePaths.has(dedupeKey)) continue;
    seenExePaths.add(dedupeKey);

    const id = entry.name.toLowerCase().replace(/[^a-z0-9]/g, '') || `app_${apps.length}`;

    apps.push({
      id: id,
      name: entry.name,
      icon: '',
      exec: entry.target
    });
  }

  // Sort alphabetically by name
  apps.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return apps;
}

module.exports = {
  processScannedApps
};
