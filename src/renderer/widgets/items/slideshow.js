const { ipcRenderer } = require('electron');

/**
 * Photo Slideshow Widget
 */
function createPhotoSlideshowWidget(container, widget, isPreview = false) {
  const kenBurns = widget.settings.kenBurns !== false;
  const folder = widget.settings.folderPath || '';

  container.innerHTML = `
    <div class="slideshow-frame" style="width:100%; height:100%; position:relative; overflow:hidden; border-radius:12px; background:#111;">
      <div class="slideshow-img" style="
        width:100%; height:100%; background-size:cover; background-position:center;
        transition: transform 5s ease-in-out, opacity 1s ease;
        ${kenBurns ? 'transform: scale(1.08);' : ''}
      "></div>
      <div class="slideshow-overlay" style="
        position:absolute; bottom:0; left:0; right:0; padding:6px 10px;
        background:linear-gradient(transparent, rgba(0,0,0,0.7)); font-size:10px; color:rgba(255,255,255,0.8);
      ">${folder ? 'Slideshow Active' : 'Click ⚙ to select image folder'}</div>
    </div>
  `;

  const imgEl = container.querySelector('.slideshow-img');
  const overlayEl = container.querySelector('.slideshow-overlay');

  // Sample placeholder SVG image for preview
  if (isPreview || !folder) {
    imgEl.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200' viewBox='0 0 300 200'><rect width='300' height='200' fill='%231e293b'/><circle cx='150' cy='100' r='40' fill='%2338bdf8' opacity='0.3'/><text x='150' y='105' font-size='14' fill='%23ffffff' text-anchor='middle'>Photo Slideshow</text></svg>")`;
  }

  if (!isPreview && folder) {
    // Cycle animation placeholder interval
    let zoomState = false;
    const intervalSec = Math.max(5, widget.settings.intervalSec || 10);

    const interval = setInterval(() => {
      if (kenBurns) {
        zoomState = !zoomState;
        imgEl.style.transform = zoomState ? 'scale(1.15)' : 'scale(1.02)';
      }
    }, intervalSec * 1000);

    container._widgetCleanup = () => clearInterval(interval);
  }
}

function getPhotoSlideshowSettingsControls(widget, onUpdate) {
  return `
    <div class="popover-row">
      <label>Image Folder</label>
      <div style="display:flex; gap:6px;">
        <input type="text" id="setting-photo-folder" value="${widget.settings.folderPath || ''}" readonly placeholder="Select directory...">
        <button id="setting-photo-browse" style="padding:4px 8px; border-radius:4px; border:none; background:#007aff; color:white; cursor:pointer;">Browse</button>
      </div>
    </div>
    <div class="popover-row">
      <label>Interval (Seconds, Min 5s)</label>
      <input type="text" id="setting-photo-interval" value="${widget.settings.intervalSec || 10}">
    </div>
    <div class="popover-row">
      <label>Ken Burns Effect</label>
      <select id="setting-photo-kenburns">
        <option value="true" ${widget.settings.kenBurns !== false ? 'selected' : ''}>Enabled</option>
        <option value="false" ${widget.settings.kenBurns === false ? 'selected' : ''}>Disabled</option>
      </select>
    </div>
  `;
}

function bindPhotoSlideshowSettingsEvents(popoverEl, widget, onUpdate) {
  const browseBtn = popoverEl.querySelector('#setting-photo-browse');
  const intervalInput = popoverEl.querySelector('#setting-photo-interval');
  const kenburnsSelect = popoverEl.querySelector('#setting-photo-kenburns');

  if (browseBtn) {
    browseBtn.onclick = async () => {
      const selectedPath = await ipcRenderer.invoke('select-photo-folder');
      if (selectedPath) {
        const folderInput = popoverEl.querySelector('#setting-photo-folder');
        if (folderInput) folderInput.value = selectedPath;
        onUpdate({ folderPath: selectedPath });
      }
    };
  }

  if (intervalInput) {
    intervalInput.onchange = (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val >= 5) {
        onUpdate({ intervalSec: val });
      }
    };
  }

  if (kenburnsSelect) {
    kenburnsSelect.onchange = (e) => onUpdate({ kenBurns: e.target.value === 'true' });
  }
}

module.exports = {
  createPhotoSlideshowWidget,
  getPhotoSlideshowSettingsControls,
  bindPhotoSlideshowSettingsEvents
};
