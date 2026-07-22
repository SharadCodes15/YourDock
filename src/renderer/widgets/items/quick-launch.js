const { ipcRenderer } = require('electron');

/**
 * Quick Launch Tile Widget
 */
function createQuickLaunchWidget(container, widget, isPreview = false) {
  const is3x3 = widget.settings.grid === '3x3';
  const cols = is3x3 ? 3 : 2;
  const count = is3x3 ? 9 : 4;
  const defaultApps = [
    { name: 'Terminal', icon: '💻', path: 'cmd.exe' },
    { name: 'Browser', icon: '🌐', path: 'https://google.com' },
    { name: 'Folder', icon: '📁', path: 'explorer.exe' },
    { name: 'Notes', icon: '📝', path: 'notepad.exe' }
  ];

  const apps = (widget.settings.apps && widget.settings.apps.length > 0) ? widget.settings.apps : defaultApps;

  let tilesHtml = '';
  for (let i = 0; i < count; i++) {
    const app = apps[i] || { name: 'Empty', icon: '➕', path: '' };
    tilesHtml += `
      <div class="ql-tile" data-index="${i}" style="
        background: rgba(255,255,255,0.08); border-radius: 8px;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        padding: 6px; cursor: pointer; transition: background 0.15s; text-align: center;
      ">
        <div style="font-size: ${isPreview ? '14px' : '20px'};">${app.icon}</div>
        <div style="font-size: ${isPreview ? '8px' : '10px'}; color: rgba(255,255,255,0.8); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;">
          ${app.name}
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="width:100%; height:100%; padding:8px; display:grid; grid-template-columns: repeat(${cols}, 1fr); gap:6px;">
      ${tilesHtml}
    </div>
  `;

  if (!isPreview) {
    const tiles = container.querySelectorAll('.ql-tile');
    tiles.forEach(tile => {
      tile.onclick = async () => {
        const idx = parseInt(tile.dataset.index, 10);
        const app = apps[idx];
        if (app && app.path) {
          await ipcRenderer.invoke('widget-action', { action: 'launch-app', path: app.path });
        }
      };
    });
  }
}

function getQuickLaunchSettingsControls(widget, onUpdate) {
  return `
    <div class="popover-row">
      <label>Grid Layout</label>
      <select id="setting-ql-grid">
        <option value="2x2" ${widget.settings.grid !== '3x3' ? 'selected' : ''}>2 x 2 (4 items)</option>
        <option value="3x3" ${widget.settings.grid === '3x3' ? 'selected' : ''}>3 x 3 (9 items)</option>
      </select>
    </div>
  `;
}

function bindQuickLaunchSettingsEvents(popoverEl, widget, onUpdate) {
  const gridSelect = popoverEl.querySelector('#setting-ql-grid');
  if (gridSelect) {
    gridSelect.onchange = (e) => onUpdate({ grid: e.target.value });
  }
}

module.exports = {
  createQuickLaunchWidget,
  getQuickLaunchSettingsControls,
  bindQuickLaunchSettingsEvents
};
