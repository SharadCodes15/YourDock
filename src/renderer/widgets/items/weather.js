const { ipcRenderer } = require('electron');

/**
 * Weather Widget
 */
function createWeatherWidget(container, widget, isPreview = false) {
  const units = widget.settings.units || 'C';

  container.innerHTML = `
    <div style="width:100%; height:100%; padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <div class="weather-city" style="font-weight:600; font-size:${isPreview ? '11px' : '14px'};">${widget.settings.city || 'Local Weather'}</div>
          <div class="weather-desc" style="font-size:10px; color:rgba(255,255,255,0.6);">Updating...</div>
        </div>
        <div class="weather-icon" style="font-size:${isPreview ? '18px' : '28px'};">☀️</div>
      </div>
      <div style="display:flex; align-items:baseline; gap:6px;">
        <div class="weather-temp" style="font-size:${isPreview ? '18px' : '32px'}; font-weight:700;">--°${units}</div>
      </div>
    </div>
  `;

  const cityEl = container.querySelector('.weather-city');
  const descEl = container.querySelector('.weather-desc');
  const iconEl = container.querySelector('.weather-icon');
  const tempEl = container.querySelector('.weather-temp');

  async function updateWeather() {
    if (isPreview) {
      tempEl.textContent = `72°${units}`;
      descEl.textContent = 'Sunny';
      iconEl.textContent = '☀️';
      return;
    }

    try {
      const data = await ipcRenderer.invoke('get-widget-weather', widget.settings.city);
      if (data && !data.error) {
        cityEl.textContent = data.city || widget.settings.city || 'Location';
        let tempVal = data.temperature;
        if (units === 'F') {
          tempVal = Math.round((tempVal * 9 / 5) + 32);
        }
        tempEl.textContent = `${tempVal}°${units}`;
        iconEl.textContent = data.conditionIcon || '☀️';
        descEl.textContent = 'Current Forecast';
      } else {
        descEl.textContent = 'Offline / Retrying';
      }
    } catch (err) {
      descEl.textContent = 'Weather Unavailable';
    }
  }

  updateWeather();

  if (!isPreview) {
    // 30 min refresh interval
    const interval = setInterval(updateWeather, 30 * 60 * 1000);
    container._widgetCleanup = () => clearInterval(interval);
  }
}

function getWeatherSettingsControls(widget, onUpdate) {
  return `
    <div class="popover-row">
      <label>City Override</label>
      <input type="text" id="setting-weather-city" placeholder="e.g. New York" value="${widget.settings.city || ''}">
    </div>
    <div class="popover-row">
      <label>Temperature Units</label>
      <select id="setting-weather-units">
        <option value="C" ${widget.settings.units !== 'F' ? 'selected' : ''}>Celsius (°C)</option>
        <option value="F" ${widget.settings.units === 'F' ? 'selected' : ''}>Fahrenheit (°F)</option>
      </select>
    </div>
  `;
}

function bindWeatherSettingsEvents(popoverEl, widget, onUpdate) {
  const cityInput = popoverEl.querySelector('#setting-weather-city');
  const unitsSelect = popoverEl.querySelector('#setting-weather-units');

  if (cityInput) cityInput.onchange = (e) => onUpdate({ city: e.target.value.trim() });
  if (unitsSelect) unitsSelect.onchange = (e) => onUpdate({ units: e.target.value });
}

module.exports = {
  createWeatherWidget,
  getWeatherSettingsControls,
  bindWeatherSettingsEvents
};
