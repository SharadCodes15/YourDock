/**
 * Quote of the Moment Widget (Bundled local quotes list - Zero Network Overhead)
 */
const BUNDLED_QUOTES = [
  { quote: "Simplicity is the soul of efficiency.", author: "Austin Freeman" },
  { quote: "Make it work, make it right, make it fast.", author: "Kent Beck" },
  { quote: "Knowledge is power.", author: "Francis Bacon" },
  { quote: "Fix the cause, not the symptom.", author: "Steve Maguire" },
  { quote: "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.", author: "Antoine de Saint-Exupéry" },
  { quote: "Code is like humor. When you have to explain it, it’s bad.", author: "Cory House" },
  { quote: "Prioritize simplicity and clarity.", author: "Anonymous" }
];

function createQuoteWidget(container, widget, isPreview = false) {
  let quoteIndex = widget.settings.quoteIndex || Math.floor(Math.random() * BUNDLED_QUOTES.length);

  container.innerHTML = `
    <div class="quote-container" style="
      width:100%; height:100%; padding:12px; display:flex; flex-direction:column;
      justify-content:space-between; cursor:pointer; color:${widget.settings.fontColor || '#ffffff'};
    ">
      <div class="quote-text" style="
        font-style:${widget.settings.fontStyle || 'italic'}; font-size:${isPreview ? '10px' : '12px'};
        line-height:1.4; opacity:0.9;
      ">
        "${BUNDLED_QUOTES[quoteIndex].quote}"
      </div>
      <div class="quote-author" style="
        font-size:${isPreview ? '9px' : '10px'}; font-weight:600; text-align:right; opacity:0.75; margin-top:6px;
      ">
        — ${BUNDLED_QUOTES[quoteIndex].author}
      </div>
    </div>
  `;

  const quoteBox = container.querySelector('.quote-container');
  const textEl = container.querySelector('.quote-text');
  const authorEl = container.querySelector('.quote-author');

  function nextQuote() {
    quoteIndex = (quoteIndex + 1) % BUNDLED_QUOTES.length;
    textEl.textContent = `"${BUNDLED_QUOTES[quoteIndex].quote}"`;
    authorEl.textContent = `— ${BUNDLED_QUOTES[quoteIndex].author}`;
  }

  if (!isPreview) {
    quoteBox.onclick = nextQuote;
    const interval = setInterval(nextQuote, 3600 * 1000);
    container._widgetCleanup = () => clearInterval(interval);
  }
}

function getQuoteSettingsControls(widget, onUpdate) {
  return `
    <div class="popover-row">
      <label>Font Color</label>
      <input type="color" id="setting-quote-color" value="${widget.settings.fontColor || '#ffffff'}">
    </div>
    <div class="popover-row">
      <label>Font Style</label>
      <select id="setting-quote-style">
        <option value="italic" ${widget.settings.fontStyle !== 'normal' ? 'selected' : ''}>Italic</option>
        <option value="normal" ${widget.settings.fontStyle === 'normal' ? 'selected' : ''}>Normal</option>
      </select>
    </div>
    <div class="popover-row" style="margin-top:4px;">
      <button type="button" id="setting-quote-next" style="padding:6px; font-size:11px; border-radius:6px; border:none; background:#007aff; color:white; cursor:pointer;">
        🔄 Next Quote Now
      </button>
    </div>
  `;
}

function bindQuoteSettingsEvents(popoverEl, widget, onUpdate) {
  const colorInput = popoverEl.querySelector('#setting-quote-color');
  const styleSelect = popoverEl.querySelector('#setting-quote-style');
  const nextBtn = popoverEl.querySelector('#setting-quote-next');

  if (colorInput) colorInput.oninput = (e) => onUpdate({ fontColor: e.target.value });
  if (styleSelect) styleSelect.onchange = (e) => onUpdate({ fontStyle: e.target.value });
  if (nextBtn) {
    nextBtn.onclick = () => {
      const nextIdx = ((widget.settings.quoteIndex || 0) + 1) % BUNDLED_QUOTES.length;
      onUpdate({ quoteIndex: nextIdx });
    };
  }
}

module.exports = {
  createQuoteWidget,
  getQuoteSettingsControls,
  bindQuoteSettingsEvents
};
