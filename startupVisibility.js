function shouldShowWindowsAtStartup({ showWindowsOnStartup = true, startMinimized = false } = {}) {
  return showWindowsOnStartup !== false && !startMinimized;
}

module.exports = {
  shouldShowWindowsAtStartup
};
