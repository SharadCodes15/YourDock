const { ipcRenderer } = require('electron');

const { createClockWidget, getClockSettingsControls, bindClockSettingsEvents } = require('./items/clock');
const { createCalendarWidget, getCalendarSettingsControls, bindCalendarSettingsEvents } = require('./items/calendar');
const { createWeatherWidget, getWeatherSettingsControls, bindWeatherSettingsEvents } = require('./items/weather');
const { createSystemMonitorWidget, getSystemMonitorSettingsControls, bindSystemMonitorSettingsEvents } = require('./items/system-monitor');
const { createStickyNoteWidget, getStickyNoteSettingsControls, bindStickyNoteSettingsEvents } = require('./items/sticky-note');
const { createQuickLaunchWidget, getQuickLaunchSettingsControls, bindQuickLaunchSettingsEvents } = require('./items/quick-launch');
const { createCountdownWidget, getCountdownSettingsControls, bindCountdownSettingsEvents } = require('./items/countdown');
const { createNowPlayingWidget, getNowPlayingSettingsControls, bindNowPlayingSettingsEvents } = require('./items/now-playing');
const { createPhotoSlideshowWidget, getPhotoSlideshowSettingsControls, bindPhotoSlideshowSettingsEvents } = require('./items/slideshow');
const { createQuoteWidget, getQuoteSettingsControls, bindQuoteSettingsEvents } = require('./items/quote');

const WIDGET_MODULES = {
  'clock': { render: createClockWidget, settings: getClockSettingsControls, bind: bindClockSettingsEvents, minW: 160, minH: 100 },
  'calendar': { render: createCalendarWidget, settings: getCalendarSettingsControls, bind: bindCalendarSettingsEvents, minW: 200, minH: 180 },
  'weather': { render: createWeatherWidget, settings: getWeatherSettingsControls, bind: bindWeatherSettingsEvents, minW: 180, minH: 120 },
  'system-monitor': { render: createSystemMonitorWidget, settings: getSystemMonitorSettingsControls, bind: bindSystemMonitorSettingsEvents, minW: 200, minH: 120 },
  'sticky-note': { render: createStickyNoteWidget, settings: getStickyNoteSettingsControls, bind: bindStickyNoteSettingsEvents, minW: 160, minH: 140 },
  'quick-launch': { render: createQuickLaunchWidget, settings: getQuickLaunchSettingsControls, bind: bindQuickLaunchSettingsEvents, minW: 160, minH: 160 },
  'countdown': { render: createCountdownWidget, settings: getCountdownSettingsControls, bind: bindCountdownSettingsEvents, minW: 180, minH: 100 },
  'now-playing': { render: createNowPlayingWidget, settings: getNowPlayingSettingsControls, bind: bindNowPlayingSettingsEvents, minW: 220, minH: 100 },
  'slideshow': { render: createPhotoSlideshowWidget, settings: getPhotoSlideshowSettingsControls, bind: bindPhotoSlideshowSettingsEvents, minW: 220, minH: 160 },
  'quote': { render: createQuoteWidget, settings: getQuoteSettingsControls, bind: bindQuoteSettingsEvents, minW: 200, minH: 110 }
};

let currentWidgets = [];
let isEditMode = false;
let activePopoverWidgetId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const canvasEl = document.getElementById('widget-canvas');

  // Mouse move region detection for forwarding click-through
  window.addEventListener('mousemove', (e) => {
    if (isEditMode) {
      ipcRenderer.send('set-ignore-mouse', false);
      return;
    }

    const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
    const isOverWidget = elementUnderMouse && elementUnderMouse !== document.body && elementUnderMouse !== canvasEl;
    ipcRenderer.send('set-ignore-mouse', !isOverWidget);
  });

  // Initial load
  const initialData = await ipcRenderer.invoke('get-widgets');
  renderWidgets(initialData.widgets, initialData.editMode);

  // IPC Listeners
  ipcRenderer.on('widgets-updated', (_event, { widgets, editMode }) => {
    renderWidgets(widgets, editMode);
  });

  function renderWidgets(widgets, editMode) {
    currentWidgets = widgets || [];
    isEditMode = Boolean(editMode);

    // Save open popover before clearing canvas
    const openPopover = document.querySelector('.widget-settings-popover');

    canvasEl.innerHTML = '';

    currentWidgets.forEach(widget => {
      const widgetBox = document.createElement('div');
      widgetBox.className = `widget-box ${isEditMode ? 'mode-edit' : 'mode-view'}`;
      widgetBox.style.left = `${widget.x}px`;
      widgetBox.style.top = `${widget.y}px`;
      widgetBox.style.width = `${widget.width}px`;
      widgetBox.style.height = `${widget.height}px`;
      widgetBox.dataset.id = widget.id;
      widgetBox.style.pointerEvents = 'auto';

      widgetBox.addEventListener('mouseenter', () => {
        ipcRenderer.send('set-ignore-mouse', false);
      });
      widgetBox.addEventListener('mouseleave', () => {
        if (!isEditMode && !document.querySelector('.widget-settings-popover')) {
          ipcRenderer.send('set-ignore-mouse', true);
        }
      });

      const mod = WIDGET_MODULES[widget.type];

      // Inner Content Box
      const contentBox = document.createElement('div');
      contentBox.className = 'widget-content-box';
      contentBox.style.width = '100%';
      contentBox.style.height = '100%';
      contentBox.style.overflow = 'hidden';

      if (mod && typeof mod.render === 'function') {
        mod.render(contentBox, widget, false, (settingsUpdate) => {
          ipcRenderer.invoke('update-widget', { id: widget.id, updates: { settings: settingsUpdate } });
        });
      }
      widgetBox.appendChild(contentBox);

      // EDIT Mode Controls
      if (isEditMode) {
        const editBar = document.createElement('div');
        editBar.className = 'widget-edit-controls';

        editBar.innerHTML = `
          <button class="edit-btn-icon btn-gear" title="Settings">⚙</button>
          <span style="font-size:10px; font-weight:600; opacity:0.8;">${widget.type}</span>
          <button class="edit-btn-icon btn-delete" title="Remove">×</button>
        `;

        const gearBtn = editBar.querySelector('.btn-gear');
        const deleteBtn = editBar.querySelector('.btn-delete');

        gearBtn.onclick = (e) => {
          e.stopPropagation();
          toggleSettingsPopover(widget, widgetBox);
        };

        deleteBtn.onclick = async (e) => {
          e.stopPropagation();
          await ipcRenderer.invoke('remove-widget', widget.id);
        };

        widgetBox.appendChild(editBar);

        // Drag Handler
        setupDragHandler(widgetBox, editBar, widget);

        // Resize Handle
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'widget-resize-handle';
        widgetBox.appendChild(resizeHandle);

        setupResizeHandler(widgetBox, resizeHandle, widget, mod ? mod.minW : 150, mod ? mod.minH : 100);
      }

      canvasEl.appendChild(widgetBox);
    });

    // Re-attach popover if it was open
    if (openPopover && activePopoverWidgetId && isEditMode) {
      const activeBox = canvasEl.querySelector(`[data-id="${activePopoverWidgetId}"]`);
      if (activeBox) {
        openPopover.style.left = `${activeBox.offsetLeft}px`;
        openPopover.style.top = `${activeBox.offsetTop + activeBox.offsetHeight + 6}px`;
        canvasEl.appendChild(openPopover);
      } else {
        activePopoverWidgetId = null;
      }
    }
  }

  function setupDragHandler(boxEl, dragEl, widget) {
    let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;

    dragEl.onmousedown = (e) => {
      if (e.target.closest('button')) {
        return;
      }
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = boxEl.offsetLeft;
      initialTop = boxEl.offsetTop;

      document.onmousemove = (moveEvt) => {
        const dx = moveEvt.clientX - startX;
        const dy = moveEvt.clientY - startY;
        boxEl.style.left = `${initialLeft + dx}px`;
        boxEl.style.top = `${initialTop + dy}px`;

        // Move active popover alongside
        const openPopover = document.querySelector('.widget-settings-popover');
        if (openPopover && activePopoverWidgetId === widget.id) {
          openPopover.style.left = `${boxEl.offsetLeft}px`;
          openPopover.style.top = `${boxEl.offsetTop + boxEl.offsetHeight + 6}px`;
        }
      };

      document.onmouseup = () => {
        document.onmousemove = null;
        document.onmouseup = null;
        ipcRenderer.invoke('update-widget', {
          id: widget.id,
          updates: { x: boxEl.offsetLeft, y: boxEl.offsetTop }
        });
      };
    };
  }

  function setupResizeHandler(boxEl, handleEl, widget, minW, minH) {
    handleEl.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = boxEl.offsetWidth;
      const startHeight = boxEl.offsetHeight;

      document.onmousemove = (moveEvt) => {
        const newW = Math.max(minW, startWidth + (moveEvt.clientX - startX));
        const newH = Math.max(minH, startHeight + (moveEvt.clientY - startY));
        boxEl.style.width = `${newW}px`;
        boxEl.style.height = `${newH}px`;

        // Update active popover position
        const openPopover = document.querySelector('.widget-settings-popover');
        if (openPopover && activePopoverWidgetId === widget.id) {
          openPopover.style.top = `${boxEl.offsetTop + boxEl.offsetHeight + 6}px`;
        }
      };

      document.onmouseup = () => {
        document.onmousemove = null;
        document.onmouseup = null;
        ipcRenderer.invoke('update-widget', {
          id: widget.id,
          updates: { width: boxEl.offsetWidth, height: boxEl.offsetHeight }
        });
      };
    };
  }

  function toggleSettingsPopover(widget, anchorEl) {
    const existing = document.querySelector('.widget-settings-popover');
    if (existing) existing.remove();

    if (activePopoverWidgetId === widget.id) {
      activePopoverWidgetId = null;
      return;
    }

    activePopoverWidgetId = widget.id;
    const mod = WIDGET_MODULES[widget.type];
    if (!mod || typeof mod.settings !== 'function') return;

    const popover = document.createElement('div');
    popover.className = 'widget-settings-popover';
    popover.style.left = `${anchorEl.offsetLeft}px`;
    popover.style.top = `${anchorEl.offsetTop + anchorEl.offsetHeight + 6}px`;

    popover.innerHTML = `
      <div class="popover-header">
        <span>${widget.type.toUpperCase()} Options</span>
        <button class="popover-close" style="background:none; border:none; color:white; cursor:pointer; font-size:12px;">✕</button>
      </div>
      ${mod.settings(widget)}
    `;

    popover.querySelector('.popover-close').onclick = () => {
      popover.remove();
      activePopoverWidgetId = null;
    };

    if (typeof mod.bind === 'function') {
      mod.bind(popover, widget, (settingsUpdate) => {
        // Update local memory state
        widget.settings = Object.assign({}, widget.settings, settingsUpdate);

        // Update rendered widget content immediately
        const widgetBox = canvasEl.querySelector(`[data-id="${widget.id}"]`);
        if (widgetBox) {
          const contentBox = widgetBox.querySelector('.widget-content-box');
          if (contentBox && typeof mod.render === 'function') {
            contentBox.innerHTML = '';
            mod.render(contentBox, widget, false, (innerUpdate) => {
              ipcRenderer.invoke('update-widget', { id: widget.id, updates: { settings: innerUpdate } });
            });
          }
        }

        // Persist to store
        ipcRenderer.invoke('update-widget', {
          id: widget.id,
          updates: { settings: settingsUpdate }
        });
      });
    }

    canvasEl.appendChild(popover);
  }
});
