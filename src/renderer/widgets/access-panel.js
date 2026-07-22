const { ipcRenderer } = require('electron');
const { createClockWidget } = require('./items/clock');
const { createCalendarWidget } = require('./items/calendar');
const { createWeatherWidget } = require('./items/weather');
const { createSystemMonitorWidget } = require('./items/system-monitor');
const { createStickyNoteWidget } = require('./items/sticky-note');
const { createQuickLaunchWidget } = require('./items/quick-launch');
const { createCountdownWidget } = require('./items/countdown');
const { createNowPlayingWidget } = require('./items/now-playing');
const { createPhotoSlideshowWidget } = require('./items/slideshow');
const { createQuoteWidget } = require('./items/quote');

const WIDGET_TYPES = [
  { type: 'clock', name: 'Digital/Analog Clock', desc: 'Customizable clock with optional seconds hand.', render: createClockWidget },
  { type: 'calendar', name: 'Mini Calendar', desc: 'Month grid with highlighted current date.', render: createCalendarWidget },
  { type: 'weather', name: 'Weather Forecast', desc: 'Current temperature and weather condition.', render: createWeatherWidget },
  { type: 'system-monitor', name: 'System Monitor', desc: 'Live CPU and RAM utilization metrics.', render: createSystemMonitorWidget },
  { type: 'sticky-note', name: 'Sticky Note', desc: 'Custom text notes with paper color presets.', render: createStickyNoteWidget },
  { type: 'quick-launch', name: 'Quick Launch Tile', desc: 'Grid of shortcuts to launch favorite apps.', render: createQuickLaunchWidget },
  { type: 'countdown', name: 'Countdown / Timer', desc: 'Target date countdown timer.', render: createCountdownWidget },
  { type: 'now-playing', name: 'Now Playing', desc: 'Media playback info and controls.', render: createNowPlayingWidget },
  { type: 'slideshow', name: 'Photo Slideshow', desc: 'Rotating local photo album with Ken Burns effect.', render: createPhotoSlideshowWidget },
  { type: 'quote', name: 'Quote of the Moment', desc: 'Inspiring quotes rotated periodically.', render: createQuoteWidget }
];

document.addEventListener('DOMContentLoaded', async () => {
  const cardsListEl = document.getElementById('cards-list');
  const toggleEditBtn = document.getElementById('toggle-edit-mode');
  const closeBtn = document.getElementById('close-panel');

  const { editMode } = await ipcRenderer.invoke('get-widgets');
  updateEditBtnState(editMode);

  WIDGET_TYPES.forEach(item => {
    const card = document.createElement('div');
    card.className = 'widget-type-card';

    card.innerHTML = `
      <div class="card-meta">
        <div class="card-name">${item.name}</div>
        <div class="card-desc">${item.desc}</div>
      </div>
      <div class="live-preview-wrapper">
        <div class="live-preview-container"></div>
      </div>
      <button class="add-btn">Add to Desktop</button>
    `;

    const previewContainer = card.querySelector('.live-preview-container');
    const mockWidget = { type: item.type, settings: {} };
    try {
      item.render(previewContainer, mockWidget, true);
    } catch (err) {
      previewContainer.innerHTML = '<div style="padding:10px; font-size:11px;">Preview</div>';
    }

    const addBtn = card.querySelector('.add-btn');
    addBtn.onclick = async () => {
      await ipcRenderer.invoke('add-widget', { type: item.type });
    };

    cardsListEl.appendChild(card);
  });

  toggleEditBtn.onclick = async () => {
    const current = await ipcRenderer.invoke('get-widgets');
    const newEditMode = !current.editMode;
    await ipcRenderer.invoke('set-widget-edit-mode', newEditMode);
    updateEditBtnState(newEditMode);
  };

  closeBtn.onclick = () => {
    ipcRenderer.invoke('toggle-widget-access-panel');
  };

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ipcRenderer.invoke('toggle-widget-access-panel');
    }
  });

  function updateEditBtnState(isEdit) {
    if (isEdit) {
      toggleEditBtn.classList.add('active');
      toggleEditBtn.textContent = 'Done Editing';
    } else {
      toggleEditBtn.classList.remove('active');
      toggleEditBtn.textContent = 'Edit Mode';
    }
  }
});
