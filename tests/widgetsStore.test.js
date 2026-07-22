const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { WidgetsStore } = require('../src/main/widgets/widgetsStore');

test('widgetsStore - CRUD operations on widgets.json round-trip', () => {
  const tmpFile = path.join(os.tmpdir(), `test_widgets_${Date.now()}.json`);

  try {
    const store = new WidgetsStore(tmpFile);
    assert.deepEqual(store.getWidgets(), []);
    assert.equal(store.getEditMode(), false);

    // Add Widget
    const clockWidget = store.addWidget('clock', { x: 50, y: 100 });
    assert.ok(clockWidget.id.startsWith('widget_'));
    assert.equal(clockWidget.type, 'clock');
    assert.equal(clockWidget.x, 50);
    assert.equal(clockWidget.y, 100);
    assert.equal(store.getWidgets().length, 1);

    // Update Widget
    store.updateWidget(clockWidget.id, { x: 120, y: 200, settings: { fontColor: '#ff0000' } });
    const updatedWidgets = store.getWidgets();
    assert.equal(updatedWidgets[0].x, 120);
    assert.equal(updatedWidgets[0].y, 200);
    assert.equal(updatedWidgets[0].settings.fontColor, '#ff0000');

    // Toggle Edit Mode
    store.setEditMode(true);
    assert.equal(store.getEditMode(), true);

    // Re-instantiate store from disk to test persistence
    const reloadedStore = new WidgetsStore(tmpFile);
    assert.equal(reloadedStore.getWidgets().length, 1);
    assert.equal(reloadedStore.getWidgets()[0].x, 120);
    assert.equal(reloadedStore.getEditMode(), true);

    // Remove Widget
    reloadedStore.removeWidget(clockWidget.id);
    assert.equal(reloadedStore.getWidgets().length, 0);

  } finally {
    if (fs.existsSync(tmpFile)) {
      try { fs.unlinkSync(tmpFile); } catch (e) {}
    }
  }
});
