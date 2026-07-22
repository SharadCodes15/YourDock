/**
 * Countdown / Timer Widget
 */
function createCountdownWidget(container, widget, isPreview = false) {
  const targetTime = widget.settings.targetTime || (Date.now() + 3600000);
  const title = widget.settings.title || 'Timer';

  container.innerHTML = `
    <div style="width:100%; height:100%; padding:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;">
      <div style="font-size:${isPreview ? '10px' : '12px'}; color:rgba(255,255,255,0.7); font-weight:500;">${title}</div>
      <div class="cd-timer-text" style="font-size:${isPreview ? '18px' : '26px'}; font-weight:700; margin-top:4px; letter-spacing:1px;">00:00:00</div>
    </div>
  `;

  const timerEl = container.querySelector('.cd-timer-text');

  function updateTimer() {
    const diff = Math.max(0, Math.floor((targetTime - Date.now()) / 1000));
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    const seconds = diff % 60;

    const pad = (n) => String(n).padStart(2, '0');
    timerEl.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

    if (diff === 0 && !isPreview) {
      timerEl.style.color = '#ff453a';
    }
  }

  updateTimer();

  if (!isPreview) {
    const interval = setInterval(updateTimer, 1000);
    container._widgetCleanup = () => clearInterval(interval);
  }
}

function getCountdownSettingsControls(widget, onUpdate) {
  return `
    <div class="popover-row">
      <label>Timer Title</label>
      <input type="text" id="setting-cd-title" value="${widget.settings.title || 'Timer'}">
    </div>
    <div class="popover-row">
      <label>Quick Presets</label>
      <div style="display:flex; gap:4px; margin-top:2px;">
        <button type="button" class="btn-preset" data-mins="15" style="flex:1; padding:4px; font-size:10px; border-radius:4px; border:none; background:rgba(255,255,255,0.15); color:white; cursor:pointer;">15m</button>
        <button type="button" class="btn-preset" data-mins="30" style="flex:1; padding:4px; font-size:10px; border-radius:4px; border:none; background:rgba(255,255,255,0.15); color:white; cursor:pointer;">30m</button>
        <button type="button" class="btn-preset" data-mins="60" style="flex:1; padding:4px; font-size:10px; border-radius:4px; border:none; background:rgba(255,255,255,0.15); color:white; cursor:pointer;">1h</button>
      </div>
    </div>
    <div class="popover-row">
      <label>Custom Duration (Minutes)</label>
      <input type="text" id="setting-cd-minutes" placeholder="e.g. 45" value="">
    </div>
  `;
}

function bindCountdownSettingsEvents(popoverEl, widget, onUpdate) {
  const titleInput = popoverEl.querySelector('#setting-cd-title');
  const minutesInput = popoverEl.querySelector('#setting-cd-minutes');
  const presetBtns = popoverEl.querySelectorAll('.btn-preset');

  if (titleInput) {
    titleInput.onchange = (e) => onUpdate({ title: e.target.value.trim() });
  }

  if (minutesInput) {
    minutesInput.onchange = (e) => {
      const mins = parseInt(e.target.value, 10);
      if (!isNaN(mins) && mins > 0) {
        onUpdate({ targetTime: Date.now() + mins * 60 * 1000 });
      }
    };
  }

  presetBtns.forEach(btn => {
    btn.onclick = () => {
      const mins = parseInt(btn.dataset.mins, 10);
      if (!isNaN(mins)) {
        onUpdate({ targetTime: Date.now() + mins * 60 * 1000 });
      }
    };
  });
}

module.exports = {
  createCountdownWidget,
  getCountdownSettingsControls,
  bindCountdownSettingsEvents
};
