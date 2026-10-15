// Native wheel scrolling remains available inside a chapter. A continuous
// trackpad burst may reach one adjacent chapter, then its remaining inertia
// stays there. This limit is independent of the model's animation/readiness.
export class ChapterWheelGuard {
  constructor() { this.reset(); }
  reset() {
    this.lastAt = -Infinity;
    this.direction = 0;
    this.lastMagnitude = 0;
    this.peak = 0;
    this.tailSamples = 0;
    this.rising = 0;
    this.riseStart = 0;
    this.limited = false;
  }
  constrain(position, now) {
    if (now - this.lastAt > 600) return position;
    return Math.max(this.minimum, Math.min(this.maximum, position));
  }
  feed(delta, now, position, stops, height, maximum) {
    const magnitude = Math.abs(delta), direction = Math.sign(delta);
    const quiet = now - this.lastAt >= 160;
    const reversed = !quiet && this.direction !== 0 && direction !== this.direction && magnitude >= 7;
    // A fresh swipe can accelerate out of the previous swipe's decaying tail.
    // Accept a fresh impulse or cumulative gentle growth after a weak tail.
    // Ordinary ripples and tiny sign oscillations keep their original bounds.
    const afterTail = this.limited && !quiet && !reversed && direction === this.direction && this.tailSamples >= 3;
    const impulse = afterTail && magnitude >= Math.max(5, this.lastMagnitude * 3);
    if (afterTail) {
      if (magnitude > this.lastMagnitude) {
        if (!this.rising) this.riseStart = this.lastMagnitude;
        this.rising++;
      } else this.rising = 0;
    } else this.rising = 0;
    const renewed = impulse || (this.rising >= 2 && magnitude >= Math.max(7, this.riseStart * 1.6));
    const fresh = quiet || reversed || renewed;
    if (fresh) {
      let index = 0;
      const line = position + height * .4;
      stops.forEach((top, i) => { if (top <= line) index = i; });
      this.minimum = stops[Math.max(0, index - 1)];
      this.maximum = index < stops.length - 1 ? stops[index + 1] : maximum;
      this.direction = direction;
      this.peak = 0;
      this.tailSamples = 0;
      this.rising = 0;
      this.limited = false;
    }
    this.lastAt = now;
    this.peak = Math.max(this.peak, magnitude);
    if (magnitude <= Math.max(6, this.peak * .22) && !this.rising) this.tailSamples++;
    else if (!this.rising) this.tailSamples = 0;
    this.lastMagnitude = magnitude;
    // Chrome may still be animating earlier native deltas. Do not teleport
    // ahead to a predicted target when the observed viewport is still behind.
    const requested = position + delta;
    const top = Math.max(this.minimum, Math.min(this.maximum, requested));
    const limited = Math.abs(top - requested) > .01;
    const firstLimited = limited && !this.limited;
    this.limited ||= limited;
    return { top, limited, firstLimited, reversed };
  }
}

export function wheelPixels(event, height) {
  return event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
}
