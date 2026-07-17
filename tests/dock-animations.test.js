const test = require('node:test');
const assert = require('node:assert');

// Pure math: parabolic scale function (no DOM needed, matches dock/index.html logic)
function parabolicScale(distance, radius, baseScale = 1.0, maxScale = 1.38) {
  if (distance >= radius) return baseScale;
  const t = distance / radius;
  return baseScale + (maxScale - baseScale) * Math.max(0, 1 - t * t);
}

// FLIP delta calculation (pure math, no DOM needed)
function computeFLIPDelta(oldRect, newRect) {
  return {
    x: oldRect.left - newRect.left,
    y: oldRect.top - newRect.top
  };
}

// Debounce stable-check logic (pure, no DOM)
function buildDebounceChecker() {
  let stableContent = null;
  let stableOrder = null;
  let stableCount = 0;
  const REQUIRED_CYCLES = 2;

  return function check(newTempApps) {
    const contentKey = newTempApps.map(a => a.id).sort().join(',');
    const orderKey = newTempApps.map(a => a.id).join(',');
    if (stableContent === contentKey) {
      stableCount++;
      return {
        stable: stableCount >= REQUIRED_CYCLES,
        orderChanged: stableCount >= REQUIRED_CYCLES ? stableOrder !== orderKey : false,
        stableOrder: orderKey
      };
    }
    stableContent = contentKey;
    stableOrder = orderKey;
    stableCount = 1;
    return { stable: false, orderChanged: false, stableOrder: orderKey };
  };
}

// =====================
// TESTS: parabolicScale
// =====================
test('parabolicScale - at distance 0 returns maxScale', () => {
  const result = parabolicScale(0, 110);
  assert.strictEqual(result, 1.38);
});

test('parabolicScale - at distance >= radius returns baseScale', () => {
  assert.strictEqual(parabolicScale(110, 110), 1.0);
  assert.strictEqual(parabolicScale(200, 110), 1.0);
  assert.strictEqual(parabolicScale(999, 110), 1.0);
});

test('parabolicScale - at half radius returns expected value', () => {
  const result = parabolicScale(55, 110);
  // t = 0.5, 1 - t^2 = 1 - 0.25 = 0.75
  // base + (max - base) * 0.75 = 1.0 + 0.38 * 0.75 = 1.285
  assert.strictEqual(result, 1.285);
});

test('parabolicScale - smooth monotonic falloff', () => {
  const values = [0, 20, 40, 60, 80, 100, 110].map(d => parabolicScale(d, 110));
  for (let i = 1; i < values.length; i++) {
    assert.ok(values[i] <= values[i - 1], `Not monotonic at index ${i}: ${values[i - 1]} -> ${values[i]}`);
  }
});

test('parabolicScale - at 1/4 radius', () => {
  const result = parabolicScale(27.5, 110);
  // t = 0.25, 1 - t^2 = 1 - 0.0625 = 0.9375
  // 1.0 + 0.38 * 0.9375 = 1.35625
  assert.strictEqual(result, 1.35625);
});

test('parabolicScale - at 3/4 radius', () => {
  const result = parabolicScale(82.5, 110);
  // t = 0.75, 1 - t^2 = 1 - 0.5625 = 0.4375
  // 1.0 + 0.38 * 0.4375 = 1.16625
  assert.strictEqual(result, 1.16625);
});

test('parabolicScale - custom base/max params', () => {
  const result = parabolicScale(50, 100, 0.5, 2.0);
  // t = 0.5, 1 - t^2 = 0.75
  // 0.5 + 1.5 * 0.75 = 1.625
  assert.strictEqual(result, 1.625);
});

test('parabolicScale - clamps max(0, ...) never returns below base', () => {
  const result = parabolicScale(200, 110, 1.0, 1.5);
  assert.strictEqual(result, 1.0);
});

// =====================
// TESTS: computeFLIPDelta
// =====================
test('computeFLIPDelta - no movement returns zero delta', () => {
  const rect = { left: 100, top: 200, width: 50, height: 50 };
  const delta = computeFLIPDelta(rect, rect);
  assert.strictEqual(delta.x, 0);
  assert.strictEqual(delta.y, 0);
});

test('computeFLIPDelta - item moved right', () => {
  const oldRect = { left: 100, top: 200, width: 50, height: 50 };
  const newRect = { left: 300, top: 200, width: 50, height: 50 };
  const delta = computeFLIPDelta(oldRect, newRect);
  assert.strictEqual(delta.x, -200); // old.left - new.left = 100 - 300 = -200
  assert.strictEqual(delta.y, 0);
});

test('computeFLIPDelta - item moved down', () => {
  const oldRect = { left: 100, top: 100, width: 50, height: 50 };
  const newRect = { left: 100, top: 200, width: 50, height: 50 };
  const delta = computeFLIPDelta(oldRect, newRect);
  assert.strictEqual(delta.x, 0);
  assert.strictEqual(delta.y, -100);
});

test('computeFLIPDelta - item moved diagonally', () => {
  const oldRect = { left: 50, top: 50, width: 30, height: 30 };
  const newRect = { left: 150, top: 100, width: 30, height: 30 };
  const delta = computeFLIPDelta(oldRect, newRect);
  assert.strictEqual(delta.x, -100);
  assert.strictEqual(delta.y, -50);
});

// =====================
// TESTS: debounce checker
// =====================
test('debounce - requires 2 consecutive stable cycles', () => {
  const check = buildDebounceChecker();
  const apps1 = [{ id: 'a' }, { id: 'b' }];
  const apps2 = [{ id: 'a' }, { id: 'b' }];

  const r1 = check(apps1);
  assert.strictEqual(r1.stable, false);

  const r2 = check(apps2);
  assert.strictEqual(r2.stable, true);
  assert.strictEqual(r2.orderChanged, false);
});

test('debounce - resets on content change', () => {
  const check = buildDebounceChecker();
  check([{ id: 'a' }]);
  check([{ id: 'a' }]); // stable

  const r3 = check([{ id: 'b' }]);
  assert.strictEqual(r3.stable, false);

  const r4 = check([{ id: 'b' }]);
  assert.strictEqual(r4.stable, true);
});

test('debounce - detects order change', () => {
  const check = buildDebounceChecker();
  const ordered = [{ id: 'a' }, { id: 'b' }];
  const reordered = [{ id: 'b' }, { id: 'a' }];

  check(ordered);
  const r2 = check(ordered);
  assert.strictEqual(r2.stable, true);
  assert.strictEqual(r2.orderChanged, false);

  check(reordered);
  const r4 = check(reordered);
  assert.strictEqual(r4.stable, true);
  assert.strictEqual(r4.orderChanged, true);
});
