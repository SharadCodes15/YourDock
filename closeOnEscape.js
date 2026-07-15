window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const api = window.electronAPI || window.settingsAPI || window.ccAPI || window.drawerAPI;
    if (api && typeof api.pressEscape === 'function') {
      api.pressEscape();
    }
  }
});

// [FIX] Shared function to position context menus above clicked elements with clamping
window.positionContextMenu = function(iconElement, menuElement, useExpandedOffset = false) {
  if (!iconElement || !menuElement) return { top: 0, left: 0 };
  
  // Measure after menu content is populated: render hidden to get layout metrics
  const prevDisplay = menuElement.style.display;
  const prevVisibility = menuElement.style.visibility;
  
  menuElement.style.display = 'block';
  menuElement.style.visibility = 'hidden';

  const iconRect = iconElement.getBoundingClientRect();
  const menuHeight = menuElement.offsetHeight;
  const menuWidth = menuElement.offsetWidth;

  // Restore previous display/visibility state
  menuElement.style.display = prevDisplay;
  menuElement.style.visibility = prevVisibility;

  let iconTop = iconRect.top;
  if (useExpandedOffset) {
    // Dock moves from 85px to 300px height when expanded, shifting icon relative positions down by 215px
    iconTop += (300 - 85);
  }
  
  let top = iconTop - menuHeight - 8;
  let left = iconRect.left + (iconRect.width / 2) - (menuWidth / 2);

  // Clamp horizontally to stay within viewport
  left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

  // Spec requires "always above" — shrink gap instead of flipping below
  if (top < 0) {
    top = 4;
  }

  return { top, left };
};
