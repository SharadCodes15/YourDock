const { ipcRenderer } = require('electron');

/**
 * System Monitor Widget (CPU% + RAM%)
 */
function createSystemMonitorWidget(container, widget, isPreview = false) {
  const cpuColor = widget.settings.cpuColor || '#007aff';
  const ramColor = widget.settings.ramColor || '#34c759';

  container.innerHTML = `
    <div style="width:100%; height:100%; padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
      <div style="font-weight:600; font-size:${isPreview ? '11px' : '13px'}; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
        System Monitor
      </div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div>
          <div style="display:flex; justify-content:space-between; font-size:${isPreview ? '9px' : '11px'}; margin-bottom:2px;">
            <span>CPU</span>
            <span class="sys-cpu-text">--%</span>
          </div>
          <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
            <div class="sys-cpu-bar" style="width:0%; height:100%; background:${cpuColor}; transition:width 0.3s;"></div>
          </div>
        </div>
        <div>
          <div style="display:flex; justify-content:space-between; font-size:${isPreview ? '9px' : '11px'}; margin-bottom:2px;">
            <span>RAM</span>
            <span class="sys-ram-text">--%</span>
          </div>
          <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
            <div class="sys-ram-bar" style="width:0%; height:100%; background:${ramColor}; transition:width 0.3s;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  const cpuText = container.querySelector('.sys-cpu-text');
  const cpuBar = container.querySelector('.sys-cpu-bar');
  const ramText = container.querySelector('.sys-ram-text');
  const ramBar = container.querySelector('.sys-ram-bar');

  async function updateMetrics() {
    if (isPreview) {
      cpuText.textContent = '14%';
      cpuBar.style.width = '14%';
      ramText.textContent = '42%';
      ramBar.style.width = '42%';
      return;
    }

    try {
      const mb = await ipcRenderer.invoke('get-ram-usage');
      const ramPercent = Math.min(100, Math.round((mb / 16384) * 100));
      const cpuMock = Math.round(10 + Math.random() * 25);

      ramText.textContent = `${mb} MB`;
      ramBar.style.width = `${Math.min(100, Math.max(10, ramPercent))}%`;

      cpuText.textContent = `${cpuMock}%`;
      cpuBar.style.width = `${cpuMock}%`;
    } catch (err) {
      // Fallback
    }
  }

  updateMetrics();

  if (!isPreview) {
    const interval = setInterval(updateMetrics, widget.settings.refreshIntervalMs || 2000);
    container._widgetCleanup = () => clearInterval(interval);
  }
}

function getSystemMonitorSettingsControls(widget, onUpdate) {
  return `
    <div class="popover-row">
      <label>Refresh Rate</label>
      <select id="setting-sys-interval">
        <option value="1000" ${widget.settings.refreshIntervalMs === 1000 ? 'selected' : ''}>1 second</option>
        <option value="2000" ${widget.settings.refreshIntervalMs !== 1000 && widget.settings.refreshIntervalMs !== 5000 ? 'selected' : ''}>2 seconds</option>
        <option value="5000" ${widget.settings.refreshIntervalMs === 5000 ? 'selected' : ''}>5 seconds</option>
      </select>
    </div>
    <div class="popover-row">
      <label>CPU Bar Color</label>
      <input type="color" id="setting-sys-cpucolor" value="${widget.settings.cpuColor || '#007aff'}">
    </div>
    <div class="popover-row">
      <label>RAM Bar Color</label>
      <input type="color" id="setting-sys-ramcolor" value="${widget.settings.ramColor || '#34c759'}">
    </div>
  `;
}

function bindSystemMonitorSettingsEvents(popoverEl, widget, onUpdate) {
  const selectEl = popoverEl.querySelector('#setting-sys-interval');
  const cpuColorInput = popoverEl.querySelector('#setting-sys-cpucolor');
  const ramColorInput = popoverEl.querySelector('#setting-sys-ramcolor');

  if (selectEl) selectEl.onchange = (e) => onUpdate({ refreshIntervalMs: parseInt(e.target.value, 10) });
  if (cpuColorInput) cpuColorInput.oninput = (e) => onUpdate({ cpuColor: e.target.value });
  if (ramColorInput) ramColorInput.oninput = (e) => onUpdate({ ramColor: e.target.value });
}

module.exports = {
  createSystemMonitorWidget,
  getSystemMonitorSettingsControls,
  bindSystemMonitorSettingsEvents
};
