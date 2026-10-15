import assert from 'node:assert/strict';
import { ChapterWheelGuard, wheelPixels } from '../js/chapter-wheel.js';

const stops=[0,900,1800,2700,3600,4500];
const queued=new ChapterWheelGuard();
queued.feed(500,0,0,stops,900,5300);
const stillMoving=queued.feed(500,16,80,stops,900,5300);
assert.equal(stillMoving.limited,false,'queued native movement does not trigger an early jump to a predicted target');
assert.equal(stillMoving.top,580);
assert.equal(queued.constrain(980,300),900,'late compositor overshoot remains bounded');
const clamped=new ChapterWheelGuard();
assert.equal(clamped.feed(1200,0,0,stops,900,5300).firstLimited,true,'the first cap can cancel queued native scrolling');
assert.equal(clamped.feed(120,16,900,stops,900,5300).firstLimited,false,'later momentum at the same cap does not require another instant scroll');
assert.equal(clamped.feed(120,200,900,stops,900,5300).limited,false,'a new gesture restores ordinary native scrolling');
assert.equal(clamped.feed(1200,216,1020,stops,900,5300).firstLimited,true,'the next gesture still cancels its first queued overshoot');
let guard=new ChapterWheelGuard(), position=0, now=0;
function feed(delta, gap=16) {
  now+=gap;
  const result=guard.feed(delta,now,position,stops,900,5300);
  position=result.top;
  return result;
}
for(const delta of [2400,1800,900,450,200,80,30,5,3,-2,1]) feed(delta);
assert.equal(position,899,'one large swipe and its tail cannot reach a second chapter');
assert.equal(feed(5,180).top,904,'a fresh tiny gesture moves immediately');
for(let i=0;i<30;i++) feed(80);
assert.equal(position,1800,'second gesture reaches only the next chapter');
assert.ok(feed(-120).top<1800,'deliberate reversal responds without a time lock');
guard.reset(); position=0;
for(let i=0;i<300;i++) feed(120);
assert.equal(position,900,'long continuous input cannot cascade through chapters');
for(const delta of [5,3,2,1]) feed(delta);
feed(3);feed(8);feed(20);
assert.ok(position>900,'fresh acceleration out of a decaying tail releases the bound');
guard.reset();position=0;
feed(5000,200);
for(const delta of [4,3,2,1]) feed(delta);
assert.ok(feed(8).top>900,'a small fresh impulse is not swallowed after the old tail');

guard.reset();position=0;
feed(5000,200);
for(const delta of [4,3,2,1]) feed(delta);
for(let i=0;i<12;i++) feed(6);
assert.equal(position,972,'a fresh steady 6px gesture moves immediately after a weak tail');
for(let i=0;i<300;i++) feed(6);
assert.equal(position,1800,'the gentle fresh gesture still stops at its next adjacent chapter');

guard.reset();position=0;
feed(5000,200);
for(const delta of [4,3,2,1,-1,2,-2,1,4]) feed(delta);
assert.equal(guard.maximum,900,'tiny alternating tail jitter cannot open the next chapter range');
assert.ok(position<=900,'tiny tail jitter remains inside the original chapter cap');
guard.reset();position=4500;
feed(5000,200);
assert.equal(position,5300,'last chapter allows reading its complete contact ending');
assert.equal(wheelPixels({deltaY:2,deltaMode:1},900),32);
assert.equal(wheelPixels({deltaY:2,deltaMode:2},900),1800);
console.log('PASS: one-chapter bursts, momentum, tiny fresh input, reversals, renewed acceleration, final content and delta modes');
