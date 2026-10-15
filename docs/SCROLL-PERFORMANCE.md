# Scroll performance verification (v4.8)

v4.9 retains the preparation and scene-cache changes but replaces the full scroll-time animation pause with continuous motion at a lighter drawing cadence. The measurements below describe v4.8; current motion checks are recorded in [autonomous motion verification](MODEL-MOTION.md).

The remaining freezes came partly from synchronous geometry construction and vertex fitting, even though the browser's average frame rate looked healthy. With 4× CPU slowdown, the preceding build recorded four long tasks during a traversal, including a 148ms model build.

## Changes

- Yield between factory sections and inside large vertex/instance loops. Resume after a browser frame, rather than chaining continuations that can collectively starve painting. Background preparation also waits for quiet input.
- Replace string-key vertex deduplication and temporary vector allocations with flat typed coordinates and cached camera coordinates. The complete geometry still determines the same large silhouette fit.
- Attach only the selected world to the rendered scene. Keep the other worlds cached, and restore scene membership synchronously after shader compilation and buffer warming.
- Keep DOM geometry reads out of the render loop and use cached chapter offsets for scroll observation. Cache wheel-target scroll ancestry, invalidating it when content or layout changes.
- Retain the crisp model frame during active page movement, then automatically resume decorative animation after 100ms of quiet. Apply the same policy to all seven case-study heroes. Animation clocks pause with rendering.
- Accept fresh steady 6px input after a weak momentum tail. Keep tiny jitter bounded and avoid repeated no-op boundary jumps. The one-adjacent-chapter wheel contract remains intact.

## Measurements

Chrome 155.0.8059.41, 1440×900, local preview, GPU enabled. Each capture sends five swipes down and five up: `[220,200,170,145,110,80,55,35,20,12,6,3]`, at 12ms requested intervals and 200ms between gestures. Independent browser animation frames, Long Tasks, DevTools timeline and CPU samples are collected. The baseline is commit `489c974`; the final capture uses v4.8.

| CPU setting | Source | P95 frame interval | P99 | Worst | Tasks ≥50ms | Script duration |
|---|---|---:|---:|---:|---:|---:|
| Normal | Before | 7.2ms | 20.8ms | 41.6ms | 0 | 547ms |
| Normal | After | 7.1ms | 13.9ms | 21.0ms | 0 | 324ms |
| 4× slowdown | Before | 20.8ms | 41.7ms | 187.5ms | 4 | 2185ms |
| 4× slowdown | After | 13.9ms | 27.8ms | 48.5ms | 0 | 888ms |

See [baseline data](benchmarks/2026-10-15/scroll-budget/before.json) and [final data](benchmarks/2026-10-15/scroll-budget/after.json). These are sequential diagnostic captures, including profiler overhead, rather than a controlled multi-run distribution. CPU slowdown is browser emulation. Physical trackpad/display feel remains for user review. The figures measure document/browser frames; decorative WebGL deliberately rests during input.

Cold model preparation may take longer in wall-clock time because input and painting receive time between chunks. The neighboring-world prewarm normally performs that work while a visitor reads. `buildDuration` in the final raw data includes these yields and input waits; it is not directly comparable with the baseline's synchronous build-plus-fit duration.

## Regression checks

The homepage layout audit passes all 30 chapter/viewport combinations, including complete model containment and at least 70% dominant-axis occupancy. Desktop and mobile framing remains large and unobstructed. All 83 interaction groups pass, including fresh gentle input, single-chapter bursts, nested scrollers changing size, native touch, keyboard/history, model ownership, detached-world caching, scroll-priority rendering, resume behavior and GPU lifecycle. All 149 internal references also pass. Current [interaction](benchmarks/2026-10-15/scroll-budget/interactions.json) and [layout](benchmarks/2026-10-15/scroll-budget/layout.json) data accompany the capture.

Run the browser commands sequentially with the local preview on port 8089:

```powershell
node scripts/audit_scroll_budget.mjs after
node scripts/overhaul_interactions.mjs
node scripts/audit_scene_layout.mjs after
node scripts/test_chapter_wheel.mjs
node scripts/validate_links.mjs
```

Point `PREVIEW_URL` at the intended baseline source to reproduce its capture. Full timeline traces remain in the ignored `.audit/scroll-budget/` directory.
