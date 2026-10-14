import assert from 'node:assert/strict';
import { WheelGesture, normalizeWheel } from '../js/wheel-gesture.js';

function burst(gesture, values, start = 0, interval = 16, native = false) {
  return values.map((v,i) => gesture.feed(v, start+i*interval, native)).filter(Boolean);
}
let g = new WheelGesture();
assert.deepEqual(burst(g, [45,55,48,40,32,26,20,16,12,8,5,3,-2,1], 0, 55), [1]);
assert.deepEqual(burst(g, [40,42,30,12], 1100), [1]);
assert.deepEqual(burst(g, [-40,-42,-30,-12], 1500), [-1]);
g = new WheelGesture();
assert.deepEqual(burst(g, Array(200).fill(120)), [1], 'continuous scrolling never repeats');
g = new WheelGesture();
assert.deepEqual(burst(g, [4,5,7,8,5,2]), [1], 'small deliberate input accumulates');
g = new WheelGesture();
assert.deepEqual(burst(g, [10000,10000,10000]), [1], 'large deltas remain one step');
assert.equal(g.feed(3, 240), 0, 'sparse tail stays consumed');
assert.equal(g.feed(-2, 450), 0, 'tail oscillation stays consumed');
assert.equal(g.feed(-40, 650), -1, 'deliberate reversal after silence');
g = new WheelGesture();
assert.equal(g.feed(30, 0, true), 0);
assert.equal(g.feed(100, 16), 0, 'panel edge cannot hand off same gesture');
assert.equal(g.feed(30, 250), 1);
assert.deepEqual(burst(g, [4,5,7,8,5,2], 480), [1], 'small accelerating gesture after a consumed burst');
assert.equal(normalizeWheel({ deltaY: 2, deltaMode: 1 }, 900), 32);
assert.equal(normalizeWheel({ deltaY: 1, deltaMode: 2 }, 900), 900);
assert.equal(normalizeWheel({ deltaY: 24, deltaMode: 0 }, 900), 24);
g = new WheelGesture();
assert.deepEqual(burst(g, [120,120,120], 0, 180), [1,1,1], 'distinct mouse-wheel gestures have no animation lock');
console.log('PASS: wheel bursts, inertia, sparse tails, reversals, native ownership, delta modes, distinct gestures');
