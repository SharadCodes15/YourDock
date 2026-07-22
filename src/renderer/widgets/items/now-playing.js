const { ipcRenderer } = require('electron');

/**
 * Now Playing (Media) Widget
 */
function createNowPlayingWidget(container, widget, isPreview = false) {
  const accentColor = widget.settings.accentColor || '#007aff';
  const customTitle = widget.settings.customTitle || '';

  container.innerHTML = `
    <div style="width:100%; height:100%; padding:12px; display:flex; align-items:center; gap:12px;">
      <div style="width:48px; height:48px; border-radius:8px; background:${accentColor}22; border:1px solid ${accentColor}44; display:flex; align-items:center; justify-content:center; font-size:24px; color:${accentColor};">
        🎵
      </div>
      <div style="flex:1; overflow:hidden;">
        <div class="np-title" style="font-weight:600; font-size:${isPreview ? '11px' : '13px'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ${customTitle || 'No Media Playing'}
        </div>
        <div class="np-artist" style="font-size:11px; color:rgba(255,255,255,0.6); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">
          System Media Controls
        </div>
        <div style="display:flex; gap:14px; margin-top:6px; font-size:14px; user-select:none;">
          <span class="btn-prev" style="cursor:pointer;" title="Previous Track">⏮</span>
          <span class="btn-play" style="cursor:pointer; color:${accentColor};" title="Play/Pause">⏯</span>
          <span class="btn-next" style="cursor:pointer;" title="Next Track">⏭</span>
        </div>
      </div>
    </div>
  `;

  const titleEl = container.querySelector('.np-title');
  const artistEl = container.querySelector('.np-artist');

  let currentPollInterval = widget.settings.pollIntervalMs || 2000;
  let timerId = null;

  async function updateMedia() {
    if (isPreview) {
      titleEl.textContent = customTitle || 'Midnight City';
      artistEl.textContent = 'M83';
      return;
    }

    try {
      const info = await ipcRenderer.invoke('get-media-metadata');
      if (info) {
        if (!customTitle) {
          titleEl.textContent = info.title || 'System Media Audio';
        }
        artistEl.textContent = info.artist || 'System Media Controls';

        const nextInterval = info.isPlaying ? 2000 : 10000;
        if (nextInterval !== currentPollInterval) {
          currentPollInterval = nextInterval;
          if (timerId) clearInterval(timerId);
          timerId = setInterval(updateMedia, currentPollInterval);
        }
      }
    } catch (err) {
      // Fallback
    }
  }

  updateMedia();

  if (!isPreview) {
    const prevBtn = container.querySelector('.btn-prev');
    const playBtn = container.querySelector('.btn-play');
    const nextBtn = container.querySelector('.btn-next');

    if (prevBtn) prevBtn.onclick = () => ipcRenderer.invoke('media-control', 'prev');
    if (playBtn) playBtn.onclick = async () => {
      await ipcRenderer.invoke('media-control', 'play-pause');
      updateMedia();
    };
    if (nextBtn) nextBtn.onclick = () => ipcRenderer.invoke('media-control', 'next');

    timerId = setInterval(updateMedia, currentPollInterval);
    container._widgetCleanup = () => {
      if (timerId) clearInterval(timerId);
    };
  }
}

function getNowPlayingSettingsControls(widget, onUpdate) {
  return `
    <div class="popover-row">
      <label>Accent Color</label>
      <input type="color" id="setting-np-color" value="${widget.settings.accentColor || '#007aff'}">
    </div>
    <div class="popover-row">
      <label>Title Override (Optional)</label>
      <input type="text" id="setting-np-title" placeholder="e.g. Favorite Playlist" value="${widget.settings.customTitle || ''}">
    </div>
    <div class="popover-row">
      <label>Poll Frequency</label>
      <select id="setting-np-poll">
        <option value="2000" ${widget.settings.pollIntervalMs !== 5000 ? 'selected' : ''}>Standard (2s)</option>
        <option value="5000" ${widget.settings.pollIntervalMs === 5000 ? 'selected' : ''}>Low RAM (5s)</option>
      </select>
    </div>
  `;
}

function bindNowPlayingSettingsEvents(popoverEl, widget, onUpdate) {
  const colorInput = popoverEl.querySelector('#setting-np-color');
  const titleInput = popoverEl.querySelector('#setting-np-title');
  const selectEl = popoverEl.querySelector('#setting-np-poll');

  if (colorInput) colorInput.oninput = (e) => onUpdate({ accentColor: e.target.value });
  if (titleInput) titleInput.onchange = (e) => onUpdate({ customTitle: e.target.value.trim() });
  if (selectEl) selectEl.onchange = (e) => onUpdate({ pollIntervalMs: parseInt(e.target.value, 10) });
}

module.exports = {
  createNowPlayingWidget,
  getNowPlayingSettingsControls,
  bindNowPlayingSettingsEvents
};
