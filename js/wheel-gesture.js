// WheelEvent has no gesture-end signal. Consume an entire event burst, including
// its decaying tail, rather than tying input availability to animation duration.
export class WheelGesture {
  constructor() { this.reset(); }
  reset() {
    this.lastAt = -Infinity;
    this.cadence = 16;
    this.direction = 0;
    this.total = 0;
    this.peak = 0;
    this.consumed = false;
    this.probe = null;
  }
  consume() { this.consumed = true; this.total = 0; }
  feed(delta, now, native = false) {
    if (!Number.isFinite(delta) || !Number.isFinite(now) || Math.abs(delta) < 0.5) return 0;
    const gap = now - this.lastAt;
    const magnitude = Math.abs(delta);
    const direction = Math.sign(delta);
    const quiet = Math.max(140, Math.min(280, this.cadence * 2.5));
    // Sparse, weak tail events can outlive the main burst. Tiny sign oscillations
    // do not represent a deliberate reverse gesture.
    const tail = this.consumed && gap < 600 && (direction === this.direction || magnitude <= 4) && magnitude <= Math.max(4, Math.min(16, this.peak * 0.12));
    if (gap >= quiet && tail && direction === this.direction) {
      this.probe = { start: magnitude, last: magnitude, total: 0, growth: 0 };
    } else if (gap < quiet && this.probe) {
      if (direction === this.direction && magnitude > this.probe.last * 1.15) {
        this.probe.growth++;
        this.probe.last = magnitude;
        if (this.probe.growth >= 2 && magnitude >= this.probe.start * 1.75) {
          // A new small gesture accelerates; a residual tail decelerates.
          this.consumed = false;
          this.total = this.probe.total;
          this.peak = magnitude;
          this.probe = null;
        }
      } else this.probe = null;
    }
    if (gap >= quiet && !tail) {
      this.total = 0;
      this.peak = 0;
      this.direction = direction;
      this.consumed = false;
      this.probe = null;
    }
    if (gap < quiet) this.cadence += (Math.max(8, gap) - this.cadence) * 0.25;
    else this.cadence = 16;
    this.lastAt = now;
    this.peak = Math.max(this.peak, magnitude);
    if (this.probe) this.probe.total += magnitude;
    // A native content scroll owns the whole gesture, even after reaching its edge.
    if (native) this.consume();
    if (this.consumed) return 0;
    if (direction !== this.direction) { this.total = 0; this.direction = direction; }
    this.total += magnitude;
    if (this.total < 24) return 0;
    this.consume();
    return direction;
  }
}

export function normalizeWheel(event, pageHeight) {
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pageHeight : 1;
  return event.deltaY * unit;
}

export function scrollableAncestor(target, boundary = document.body) {
  let node = target instanceof Element ? target : null;
  while (node && node !== boundary) {
    if (node.scrollHeight > node.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(node).overflowY)) return node;
    node = node.parentElement;
  }
  return null;
}
