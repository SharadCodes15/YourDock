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

let appSettings = {};

document.addEventListener('DOMContentLoaded', async () => {
  const canvasEl = document.getElementById('widget-canvas');

  // Fetch initial settings
  try {
    appSettings = await ipcRenderer.invoke('get-settings');
  } catch (err) {
    console.error('Failed to fetch settings:', err);
  }

  ipcRenderer.on('settings-changed', (event, settings) => {
    appSettings = settings;
  });

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

    const newIds = currentWidgets.map(w => w.id);
    const existingBoxes = Array.from(canvasEl.querySelectorAll('.widget-box'));

    // 1. Remove widgets that no longer exist in the new list
    existingBoxes.forEach(box => {
      if (!newIds.includes(box.dataset.id)) {
        const contentBox = box.querySelector('.widget-content-box');
        if (contentBox && typeof contentBox._widgetCleanup === 'function') {
          contentBox._widgetCleanup();
        }
        box.remove();
      }
    });

    // 2. Create or update widgets in-place
    currentWidgets.forEach(widget => {
      let widgetBox = canvasEl.querySelector(`[data-id="${widget.id}"]`);
      const mod = WIDGET_MODULES[widget.type];

      if (!widgetBox) {
        widgetBox = document.createElement('div');
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

        const contentBox = document.createElement('div');
        contentBox.className = 'widget-content-box';
        contentBox.style.width = '100%';
        contentBox.style.height = '100%';
        contentBox.style.overflow = 'hidden';

        widgetBox.appendChild(contentBox);
        canvasEl.appendChild(widgetBox);
      }

      // Update basic visual properties
      widgetBox.className = `widget-box ${isEditMode ? 'mode-edit' : 'mode-view'}`;
      widgetBox.style.left = `${widget.x}px`;
      widgetBox.style.top = `${widget.y}px`;
      widgetBox.style.width = `${widget.width}px`;
      widgetBox.style.height = `${widget.height}px`;

      const contentBox = widgetBox.querySelector('.widget-content-box');

      // Update inner content if it hasn't been rendered yet, OR if settings changed
      const settingsStr = JSON.stringify(widget.settings);
      if (widgetBox.dataset.renderedSettings !== settingsStr) {
        if (contentBox._widgetCleanup) {
          contentBox._widgetCleanup();
          contentBox._widgetCleanup = null;
        }

        contentBox.innerHTML = '';
        if (mod && typeof mod.render === 'function') {
          mod.render(contentBox, widget, false, (settingsUpdate) => {
            ipcRenderer.invoke('update-widget', { id: widget.id, updates: { settings: settingsUpdate } });
          });
        }
        widgetBox.dataset.renderedSettings = settingsStr;
      }

      // Manage Edit Mode controls
      let editBar = widgetBox.querySelector('.widget-edit-controls');
      if (isEditMode) {
        if (!editBar) {
          editBar = document.createElement('div');
          editBar.className = 'widget-edit-controls';
          editBar.innerHTML = `
            <button class="edit-btn-icon btn-gear" title="Settings">⚙</button>
            <span style="font-size:10px; font-weight:600; opacity:0.8;">${widget.type}</span>
            <button class="edit-btn-icon btn-delete" title="Remove">×</button>
          `;

          const gearBtn = editBar.querySelector('.btn-gear');
          const deleteBtn = editBar.querySelector('.btn-delete');

          let hoverOpenTimeout = null;

          gearBtn.onclick = (e) => {
            e.stopPropagation();
            toggleSettingsPopover(widget, widgetBox);
          };

          gearBtn.addEventListener('mouseenter', () => {
            isHoveringGear = true;
            if (appSettings.general && appSettings.general.enableHoverPreview && appSettings.general.applyHoverToWidgets) {
              if (hoverOpenTimeout) clearTimeout(hoverOpenTimeout);
              hoverOpenTimeout = setTimeout(() => {
                if (isHoveringGear) {
                  const existing = document.querySelector('.widget-settings-popover');
                  if (!existing || activePopoverWidgetId !== widget.id) {
                    toggleSettingsPopover(widget, widgetBox);
                  }
                }
              }, 400);
            }
          });

          gearBtn.addEventListener('mouseleave', () => {
            isHoveringGear = false;
            if (hoverOpenTimeout) {
              clearTimeout(hoverOpenTimeout);
              hoverOpenTimeout = null;
            }
            if (appSettings.general && appSettings.general.enableHoverPreview && appSettings.general.applyHoverToWidgets) {
              checkWidgetHoverClose(widget, widgetBox);
            }
          });

          deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            await ipcRenderer.invoke('remove-widget', widget.id);
          };

          widgetBox.appendChild(editBar);

          // Drag Handler
          setupDragHandler(widgetBox, editBar, widget);

          // Resize Handle
          let resizeHandle = widgetBox.querySelector('.widget-resize-handle');
          if (!resizeHandle) {
            resizeHandle = document.createElement('div');
            resizeHandle.className = 'widget-resize-handle';
            widgetBox.appendChild(resizeHandle);
          }
          setupResizeHandler(widgetBox, resizeHandle, widget, mod ? mod.minW : 150, mod ? mod.minH : 100);
        }
      } else {
        if (editBar) {
          editBar.remove();
        }
        const resizeHandle = widgetBox.querySelector('.widget-resize-handle');
        if (resizeHandle) {
          resizeHandle.remove();
        }
      }
    });

    // Check if the open popover's widget was removed or we exited edit mode
    const openPopover = document.querySelector('.widget-settings-popover');
    if (openPopover && activePopoverWidgetId) {
      if (!newIds.includes(activePopoverWidgetId) || !isEditMode) {
        openPopover.remove();
        activePopoverWidgetId = null;
        ipcRenderer.send('set-popover-active', false);
      } else {
        const activeBox = canvasEl.querySelector(`[data-id="${activePopoverWidgetId}"]`);
        if (activeBox) {
          openPopover.style.left = `${activeBox.offsetLeft}px`;
          openPopover.style.top = `${activeBox.offsetTop + activeBox.offsetHeight + 6}px`;
        }
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

  let isHoveringGear = false;
  let isHoveringPopover = false;

  function checkWidgetHoverClose(widget, anchorEl) {
    setTimeout(() => {
      if (!isHoveringGear && !isHoveringPopover) {
        const popover = document.querySelector('.widget-settings-popover');
        if (popover && activePopoverWidgetId === widget.id) {
          popover.remove();
          activePopoverWidgetId = null;
          ipcRenderer.send('set-popover-active', false);
        }
      }
    }, 50);
  }

  function toggleSettingsPopover(widget, anchorEl) {
    const existing = document.querySelector('.widget-settings-popover');
    if (existing) existing.remove();

    if (activePopoverWidgetId === widget.id) {
      activePopoverWidgetId = null;
      ipcRenderer.send('set-popover-active', false);
      return;
    }

    activePopoverWidgetId = widget.id;
    ipcRenderer.send('set-popover-active', true);
    const mod = WIDGET_MODULES[widget.type];
    if (!mod || typeof mod.settings !== 'function') return;

    const popover = document.createElement('div');
    popover.className = 'widget-settings-popover';
    popover.style.left = `${anchorEl.offsetLeft}px`;
    popover.style.top = `${anchorEl.offsetTop + anchorEl.offsetHeight + 6}px`;

    popover.addEventListener('mouseenter', () => {
      isHoveringPopover = true;
    });

    popover.addEventListener('mouseleave', () => {
      isHoveringPopover = false;
      if (appSettings.general && appSettings.general.enableHoverPreview && appSettings.general.applyHoverToWidgets) {
        checkWidgetHoverClose(widget, anchorEl);
      }
    });

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
      ipcRenderer.send('set-popover-active', false);
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
            if (contentBox._widgetCleanup) {
              contentBox._widgetCleanup();
              contentBox._widgetCleanup = null;
            }
            contentBox.innerHTML = '';
            mod.render(contentBox, widget, false, (innerUpdate) => {
              ipcRenderer.invoke('update-widget', { id: widget.id, updates: { settings: innerUpdate } });
            });
          }
          widgetBox.dataset.renderedSettings = JSON.stringify(widget.settings);
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
