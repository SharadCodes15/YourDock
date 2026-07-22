/**
 * WidgetRegistry - Tracks active instances per widget type and controls timer triggers.
 * Ensures a widget type's update loop/timer is ONLY active when at least one instance exists.
 */
class WidgetRegistry {
  constructor() {
    this.instances = new Map(); // id -> type
    this.typeCounts = new Map(); // type -> count
    this.startListeners = new Map(); // type -> Set<cb>
    this.stopListeners = new Map(); // type -> Set<cb>
  }

  registerInstance(type, id) {
    if (!type || !id) return;
    if (this.instances.has(id)) {
      this.unregisterInstance(id);
    }

    this.instances.set(id, type);
    const prevCount = this.typeCounts.get(type) || 0;
    const newCount = prevCount + 1;
    this.typeCounts.set(type, newCount);

    if (prevCount === 0 && newCount === 1) {
      this._emitStart(type);
    }
  }

  unregisterInstance(id) {
    if (!this.instances.has(id)) return;
    const type = this.instances.get(id);
    this.instances.delete(id);

    const prevCount = this.typeCounts.get(type) || 0;
    const newCount = Math.max(0, prevCount - 1);
    this.typeCounts.set(type, newCount);

    if (prevCount > 0 && newCount === 0) {
      this._emitStop(type);
    }
  }

  syncFromWidgetList(widgets = []) {
    const newIds = new Set(widgets.map(w => w.id));
    
    // Unregister removed
    for (const [id] of this.instances) {
      if (!newIds.has(id)) {
        this.unregisterInstance(id);
      }
    }

    // Register new/updated
    for (const w of widgets) {
      if (!this.instances.has(w.id)) {
        this.registerInstance(w.type, w.id);
      }
    }
  }

  clearAll() {
    for (const [id] of Array.from(this.instances.entries())) {
      this.unregisterInstance(id);
    }
  }

  getActiveCount(type) {
    return this.typeCounts.get(type) || 0;
  }

  isTypeActive(type) {
    return this.getActiveCount(type) > 0;
  }

  getAllActiveCounts() {
    const result = {};
    for (const [type, count] of this.typeCounts.entries()) {
      if (count > 0) {
        result[type] = count;
      }
    }
    return result;
  }

  getActiveSummary() {
    const activeMap = this.getAllActiveCounts();
    const activeTypes = Object.keys(activeMap);
    const totalInstances = this.instances.size;

    if (totalInstances === 0) {
      return 'Active widgets: 0';
    }

    return `Active widgets: ${totalInstances} (types: ${activeTypes.join(', ')})`;
  }

  onTypeStart(type, callback) {
    if (!this.startListeners.has(type)) {
      this.startListeners.set(type, new Set());
    }
    this.startListeners.get(type).add(callback);
    // If already active, invoke immediately
    if (this.isTypeActive(type)) {
      callback();
    }
  }

  onTypeStop(type, callback) {
    if (!this.stopListeners.has(type)) {
      this.stopListeners.set(type, new Set());
    }
    this.stopListeners.get(type).add(callback);
  }

  _emitStart(type) {
    const listeners = this.startListeners.get(type);
    if (listeners) {
      for (const cb of listeners) {
        try { cb(); } catch (err) { console.error(`[WidgetRegistry] Error in start listener for ${type}:`, err); }
      }
    }
  }

  _emitStop(type) {
    const listeners = this.stopListeners.get(type);
    if (listeners) {
      for (const cb of listeners) {
        try { cb(); } catch (err) { console.error(`[WidgetRegistry] Error in stop listener for ${type}:`, err); }
      }
    }
  }
}

module.exports = WidgetRegistry;
