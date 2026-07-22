/**
 * Digital / Analog Clock Widget
 */
function createClockWidget(container, widget, isPreview = false) {
  const is12Hour = widget.settings.hour12 !== false;
  const fontColor = widget.settings.fontColor || '#ffffff';
  const fontSize = widget.settings.fontSize || 28;

  container.innerHTML = `
    <div class="clock-widget-body" style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:10px; color:${fontColor}; text-align:center;">
      <div class="clock-display" style="font-weight:700; font-size:${isPreview ? '16px' : fontSize + 'px'}; letter-spacing:1px;">--:--:--</div>
      <div class="clock-date" style="font-size:${isPreview ? '9px' : '11px'}; color:rgba(255,255,255,0.75); margin-top:4px; font-weight:500;">Loading...</div>
    </div>
  `;

  const timeEl = container.querySelector('.clock-display');
  const dateEl = container.querySelector('.clock-date');

  function updateTime() {
    const now = new Date();
    const options = {
      hour: '2-digit',
      minute: '2-digit',
      second: widget.settings.showSeconds !== false ? '2-digit' : undefined,
      hour12: is12Hour
    };

    if (widget.settings.face === 'analog') {
      timeEl.textContent = `⏱ ${now.toLocaleTimeString([], options)}`;
    } else {
      timeEl.textContent = now.toLocaleTimeString([], options);
    }
    dateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  updateTime();

  if (!isPreview) {
    const interval = setInterval(updateTime, 1000);
    container._widgetCleanup = () => clearInterval(interval);
  }
}

function getClockSettingsControls(widget, onUpdate) {
  return `
    <div class="popover-row">
      <label>Face Style</label>
      <select id="setting-clock-face">
        <option value="digital" ${widget.settings.face !== 'analog' ? 'selected' : ''}>Digital</option>
        <option value="analog" ${widget.settings.face === 'analog' ? 'selected' : ''}>Analog (Text Icon)</option>
      </select>
    </div>
    <div class="popover-row">
      <label>Time Format</label>
      <select id="setting-clock-hour12">
        <option value="true" ${widget.settings.hour12 !== false ? 'selected' : ''}>12-Hour (AM/PM)</option>
        <option value="false" ${widget.settings.hour12 === false ? 'selected' : ''}>24-Hour</option>
      </select>
    </div>
    <div class="popover-row">
      <label>Show Seconds</label>
      <select id="setting-clock-seconds">
        <option value="true" ${widget.settings.showSeconds !== false ? 'selected' : ''}>Yes</option>
        <option value="false" ${widget.settings.showSeconds === false ? 'selected' : ''}>No</option>
      </select>
    </div>
    <div class="popover-row">
      <label>Font Size</label>
      <select id="setting-clock-size">
        <option value="20" ${widget.settings.fontSize === 20 ? 'selected' : ''}>Small (20px)</option>
        <option value="28" ${!widget.settings.fontSize || widget.settings.fontSize === 28 ? 'selected' : ''}>Medium (28px)</option>
        <option value="36" ${widget.settings.fontSize === 36 ? 'selected' : ''}>Large (36px)</option>
      </select>
    </div>
    <div class="popover-row">
      <label>Text Color</label>
      <input type="color" id="setting-clock-color" value="${widget.settings.fontColor || '#ffffff'}">
    </div>
  `;
}

function bindClockSettingsEvents(popoverEl, widget, onUpdate) {
  const faceSelect = popoverEl.querySelector('#setting-clock-face');
  const hour12Select = popoverEl.querySelector('#setting-clock-hour12');
  const secondsSelect = popoverEl.querySelector('#setting-clock-seconds');
  const sizeSelect = popoverEl.querySelector('#setting-clock-size');
  const colorInput = popoverEl.querySelector('#setting-clock-color');

  if (faceSelect) faceSelect.onchange = (e) => onUpdate({ face: e.target.value });
  if (hour12Select) hour12Select.onchange = (e) => onUpdate({ hour12: e.target.value === 'true' });
  if (secondsSelect) secondsSelect.onchange = (e) => onUpdate({ showSeconds: e.target.value === 'true' });
  if (sizeSelect) sizeSelect.onchange = (e) => onUpdate({ fontSize: parseInt(e.target.value, 10) });
  if (colorInput) colorInput.oninput = (e) => onUpdate({ fontColor: e.target.value });
}

module.exports = {
  createClockWidget,
  getClockSettingsControls,
  bindClockSettingsEvents
};
