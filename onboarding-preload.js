const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('onboardingAPI', {
  scanApps: () => ipcRenderer.invoke('onboarding-scan-apps'),
  applyBuiltinTheme: (name) => ipcRenderer.invoke('apply-builtin-theme', name),
  completeOnboarding: (skipped) => ipcRenderer.invoke('complete-onboarding', { skipped }),
  getThemeConfig: () => ipcRenderer.invoke('get-theme-config')
});
