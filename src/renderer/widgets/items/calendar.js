/**
 * Mini Calendar Widget
 */
function createCalendarWidget(container, widget, isPreview = false) {
  let currentDate = new Date();
  const accent = widget.settings.accentColor || '#007aff';
  const startOnMonday = widget.settings.startOfWeek === 'monday';
  const showYear = widget.settings.showYear !== false;

  function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleString('default', { month: 'short' });
    const headerTitle = showYear ? `${monthName} ${year}` : monthName;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const offset = startOnMonday ? (firstDayIndex === 0 ? 6 : firstDayIndex - 1) : firstDayIndex;

    let daysHtml = '';
    for (let i = 0; i < offset; i++) {
      daysHtml += `<div style="padding:2px;"></div>`;
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
      daysHtml += `
        <div style="
          padding: 3px 0;
          text-align: center;
          font-size: ${isPreview ? '9px' : '11px'};
          border-radius: 50%;
          ${isToday ? `background:${accent}; color:white; font-weight:bold;` : 'color:rgba(255,255,255,0.85);'}
        ">${day}</div>
      `;
    }

    const dayHeaders = startOnMonday
      ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
      : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    container.innerHTML = `
      <div style="width:100%; height:100%; padding:10px; display:flex; flex-direction:column; justify-content:space-between;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
          <button class="cal-prev" style="background:none; border:none; color:white; cursor:pointer; font-size:12px; padding:2px 6px;">❮</button>
          <div style="font-weight:600; font-size:${isPreview ? '11px' : '13px'};">${headerTitle}</div>
          <button class="cal-next" style="background:none; border:none; color:white; cursor:pointer; font-size:12px; padding:2px 6px;">❯</button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(7, 1fr); text-align:center; font-size:9px; color:rgba(255,255,255,0.5); font-weight:600; margin-bottom:4px;">
          ${dayHeaders.map(d => `<div>${d}</div>`).join('')}
        </div>
        <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:2px; flex:1; align-content:start;">
          ${daysHtml}
        </div>
      </div>
    `;

    if (!isPreview) {
      const prevBtn = container.querySelector('.cal-prev');
      const nextBtn = container.querySelector('.cal-next');
      if (prevBtn) {
        prevBtn.onclick = () => {
          currentDate.setMonth(currentDate.getMonth() - 1);
          renderCalendar();
        };
      }
      if (nextBtn) {
        nextBtn.onclick = () => {
          currentDate.setMonth(currentDate.getMonth() + 1);
          renderCalendar();
        };
      }
    }
  }

  renderCalendar();
}

function getCalendarSettingsControls(widget, onUpdate) {
  return `
    <div class="popover-row">
      <label>Highlight Color</label>
      <input type="color" id="setting-cal-accent" value="${widget.settings.accentColor || '#007aff'}">
    </div>
    <div class="popover-row">
      <label>First Day of Week</label>
      <select id="setting-cal-startday">
        <option value="sunday" ${widget.settings.startOfWeek !== 'monday' ? 'selected' : ''}>Sunday</option>
        <option value="monday" ${widget.settings.startOfWeek === 'monday' ? 'selected' : ''}>Monday</option>
      </select>
    </div>
    <div class="popover-row">
      <label>Show Year in Header</label>
      <select id="setting-cal-showyear">
        <option value="true" ${widget.settings.showYear !== false ? 'selected' : ''}>Yes</option>
        <option value="false" ${widget.settings.showYear === false ? 'selected' : ''}>No</option>
      </select>
    </div>
  `;
}

function bindCalendarSettingsEvents(popoverEl, widget, onUpdate) {
  const accentInput = popoverEl.querySelector('#setting-cal-accent');
  const startDaySelect = popoverEl.querySelector('#setting-cal-startday');
  const showYearSelect = popoverEl.querySelector('#setting-cal-showyear');

  if (accentInput) accentInput.oninput = (e) => onUpdate({ accentColor: e.target.value });
  if (startDaySelect) startDaySelect.onchange = (e) => onUpdate({ startOfWeek: e.target.value });
  if (showYearSelect) showYearSelect.onchange = (e) => onUpdate({ showYear: e.target.value === 'true' });
}

module.exports = {
  createCalendarWidget,
  getCalendarSettingsControls,
  bindCalendarSettingsEvents
};
