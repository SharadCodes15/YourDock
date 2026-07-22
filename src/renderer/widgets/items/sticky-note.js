/**
 * Sticky Note Widget
 */
function createStickyNoteWidget(container, widget, isPreview = false, onUpdate = null) {
  const paperColor = widget.settings.color || '#fef08a';
  const fontSize = widget.settings.fontSize || 13;
  const fontFamily = widget.settings.fontFamily || 'inherit';
  const isDarkPaper = paperColor === '#1e293b';

  container.innerHTML = `
    <div style="width:100%; height:100%; padding:10px; background:${paperColor}; color:${isDarkPaper ? '#f8fafc' : '#1e293b'}; border-radius:12px; display:flex; flex-direction:column; pointer-events:auto;">
      <textarea class="sticky-text" style="
        width:100%; height:100%; background:transparent; border:none; outline:none; resize:none;
        font-family: ${fontFamily}; font-size:${isPreview ? '10px' : fontSize + 'px'}; color:inherit;
        pointer-events: auto; user-select: text !important; -webkit-user-select: text !important;
      " placeholder="Type your note...">${widget.settings.text || 'Sticky Note'}</textarea>
    </div>
  `;

  if (!isPreview) {
    const textarea = container.querySelector('.sticky-text');
    let saveTimeout = null;

    textarea.onmousedown = (e) => {
      e.stopPropagation();
      ipcRenderer.send('set-ignore-mouse', false);
    };

    textarea.onfocus = () => {
      ipcRenderer.send('set-ignore-mouse', false);
    };

    textarea.oninput = (e) => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        if (typeof onUpdate === 'function') {
          onUpdate({ text: e.target.value });
        }
      }, 500);
    };
  }
}

function getStickyNoteSettingsControls(widget, onUpdate) {
  const colors = [
    { name: 'Yellow', hex: '#fef08a' },
    { name: 'Blue', hex: '#bae6fd' },
    { name: 'Green', hex: '#bbf7d0' },
    { name: 'Pink', hex: '#fbcfe8' },
    { name: 'Purple', hex: '#e9d5ff' },
    { name: 'Dark', hex: '#1e293b' }
  ];

  const colorOptions = colors.map(c => `
    <option value="${c.hex}" ${widget.settings.color === c.hex ? 'selected' : ''}>${c.name}</option>
  `).join('');

  return `
    <div class="popover-row">
      <label>Note Content (Edit Text)</label>
      <textarea id="setting-sticky-text" rows="3" style="width:100%; border-radius:6px; padding:6px; background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.15); color:white; font-size:12px; outline:none; resize:vertical; font-family:inherit;" placeholder="Enter note text...">${widget.settings.text || ''}</textarea>
    </div>
    <div class="popover-row">
      <label>Paper Color</label>
      <select id="setting-sticky-color">
        ${colorOptions}
      </select>
    </div>
    <div class="popover-row">
      <label>Font Size</label>
      <select id="setting-sticky-size">
        <option value="12" ${widget.settings.fontSize === 12 ? 'selected' : ''}>Small (12px)</option>
        <option value="13" ${!widget.settings.fontSize || widget.settings.fontSize === 13 ? 'selected' : ''}>Medium (13px)</option>
        <option value="16" ${widget.settings.fontSize === 16 ? 'selected' : ''}>Large (16px)</option>
      </select>
    </div>
    <div class="popover-row">
      <label>Font Style</label>
      <select id="setting-sticky-font">
        <option value="inherit" ${!widget.settings.fontFamily || widget.settings.fontFamily === 'inherit' ? 'selected' : ''}>Standard Sans</option>
        <option value="Georgia, serif" ${widget.settings.fontFamily === 'Georgia, serif' ? 'selected' : ''}>Serif (Georgia)</option>
        <option value="monospace" ${widget.settings.fontFamily === 'monospace' ? 'selected' : ''}>Monospace</option>
        <option value="cursive" ${widget.settings.fontFamily === 'cursive' ? 'selected' : ''}>Handwriting</option>
      </select>
    </div>
  `;
}

function bindStickyNoteSettingsEvents(popoverEl, widget, onUpdate) {
  const textInput = popoverEl.querySelector('#setting-sticky-text');
  const selectColor = popoverEl.querySelector('#setting-sticky-color');
  const selectSize = popoverEl.querySelector('#setting-sticky-size');
  const selectFont = popoverEl.querySelector('#setting-sticky-font');

  if (textInput) {
    textInput.oninput = (e) => {
      onUpdate({ text: e.target.value });
    };
  }
  if (selectColor) selectColor.onchange = (e) => onUpdate({ color: e.target.value });
  if (selectSize) selectSize.onchange = (e) => onUpdate({ fontSize: parseInt(e.target.value, 10) });
  if (selectFont) selectFont.onchange = (e) => onUpdate({ fontFamily: e.target.value });
}

module.exports = {
  createStickyNoteWidget,
  getStickyNoteSettingsControls,
  bindStickyNoteSettingsEvents
};
