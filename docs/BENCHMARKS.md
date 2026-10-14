# Portfolio UX and rendering benchmarks - 14 October 2026

Paired measurements compare original commit `c9a4d43` with this implementation. These are measurements from this workstation, not universal performance guarantees.

## Environment and method

- Windows desktop, Chrome 155.0.8059.41, headless Playwright; 1440x900 desktop and 390x844 touch emulation (DPR 2).
- **Hardware acceleration confirmed:** ANGLE / Intel UHD Graphics (0x0000A78B) / Direct3D11. Renderer strings are retained in every raw sample.
- Fresh browser processes, same local static server, sequential runs. No CPU/network throttling. Original code served from a `git archive` snapshot.
- First contentful paint (FCP), browser requestAnimationFrame intervals and Long Tasks API measured independently of animation-clamped deltas. Initial-load samples include preparation; idle samples cover a separate 1.5-second window.
- Scene first traversal restarts the world cache after wheel reproduction. It includes nearby prewarming, so "first traversal" does not mean every model was unprepared. Warm traversal revisits all six scenes. Each transition samples 1.2 seconds.
- Handler time measures the synchronous semantic navigation handler, **not complete graphics arrival**. Per-page heap values are coarse Chromium estimates; GPU resource counts are not GPU utilization percentages.
- Early SwiftShader software-rendering experiments were diagnostic only; their very low frame rates are not used to claim hardware performance improvements. They exposed the physical-glass/bloom cost and the old telemetry exclusion of >800ms frames.

## Input reproduction

The same precision-trackpad-like burst moved the original site from scene 0 to scene 3; this implementation ends at scene 1. Browser mouse-wheel API input and deterministic timestamped input sequences are also asserted in the interaction suite.

## Desktop initial content and idle rendering

| Page | FCP before / after (ms) | Idle FPS before / after | P95 before / after (ms) | P99 before / after (ms) | Initial long-task total before / after (ms) |
|---|---:|---:|---:|---:|---:|
| home | 3308 / 488 | 31.2 / 70.4 | 35.4 / 14.1 | 76.6 / 20.9 | 3473 / 189 |
| aegis | 380 / 364 | 53.9 / 144.0 | 21.0 / 7.1 | 48.6 / 7.2 | 1699 / 155 |
| gridium | 140 / 112 | 61.3 / 144.0 | 20.9 / 7.2 | 27.9 / 7.2 | 763 / 228 |
| compressor-cbm | 148 / 116 | 41.5 / 107.7 | 27.9 / 14.0 | 41.6 / 14.1 | 1156 / 140 |
| topoflow | 148 / 116 | 73.7 / 144.0 | 20.8 / 7.1 | 20.9 / 7.1 | 389 / 80 |
| food | 156 / 96 | 83.1 / 144.0 | 20.7 / 7.1 | 20.9 / 7.2 | 276 / 171 |
| yield | 140 / 112 | 52.2 / 72.0 | 21.0 / 14.1 | 28.0 / 20.9 | 576 / 68 |
| sodexo | 196 / 136 | 92.7 / 144.0 | 14.1 / 7.1 | 20.9 / 7.2 | 210 / 83 |

Origin draw calls fell from 119 to 38. Idle samples meet 60 FPS on this integrated GPU. The page-wide startup FPS is lower because it includes initialization, unlike the idle measurements above.

## First and warm scene traversal

| Destination | First handler before / after (ms) | First P99 before / after (ms) | Warm P99 before / after (ms) |
|---|---:|---:|---:|
| origin | 0.70 / 0.60 | 118.0 / 21.2 | 35.4 / 21.3 |
| aegis | 0.60 / 0.80 | 125.0 / 20.9 | 62.6 / 20.8 |
| gridium | 0.60 / 0.80 | 34.8 / 41.7 | 41.5 / 14.1 |
| compressor | 0.70 / 0.80 | 69.6 / 69.4 | 76.6 / 27.8 |
| topoflow | 0.70 / 0.60 | 90.3 / 20.9 | 90.3 / 41.7 |
| profile | 0.50 / 0.70 | 35.6 / 20.9 | 27.9 / 27.7 |

No >50ms main-thread long task was recorded in the final six first-traversal windows. The compressor still produced a roughly 69ms P99 frame interval on first arrival. Warm TopoFlow also had a roughly 42ms tail frame. These remaining frame delays are reported rather than hidden.

## Verification and visual review

The asserting suite covers browser wheel inertia, deterministic trackpad tails, continuous/large/small input, reversal, delta modes, native panel scrolling at its edge, rapid buttons, keyboard, touch, direct URLs, browser history, dialogs, focus restoration, no-WebGL content, reduced motion, offscreen pauses, readiness visibility and repeated GPU resource counts. The separate experimental lab is exercised across all prototypes and rapid switching.

All seven case-study routes (including the food/sodexo alias) were checked on mobile without horizontal overflow. The final benchmark capture had zero runtime/console errors or HTTP asset errors. Local asset/link checks passed. External project services were preserved; their availability is not guaranteed by this local audit.

Before/after screenshots of every homepage scene, every major case study and mobile pages were captured and inspected. The local complete evidence sets are `.audit/overhaul/baseline-final/` and `.audit/overhaul/release-final/`. Key review images and all raw measurements are committed below.

- [Before raw measurements](benchmarks/2026-10-14/before.json)
- [After raw measurements](benchmarks/2026-10-14/after.json)
- [Asserting interaction results](benchmarks/2026-10-14/interactions.json)
- [Homepage before](benchmarks/2026-10-14/before-home.png) / [after](benchmarks/2026-10-14/after-home.png)
- [Aegis before](benchmarks/2026-10-14/before-aegis.png) / [after](benchmarks/2026-10-14/after-aegis.png)

## Reproduction

```powershell
# Playwright must be installed or discoverable by scripts/lib/playwright_loader.mjs.
# CHROME_PATH can override the default Windows Chrome executable.
node scripts/test_wheel_gesture.mjs
node scripts/overhaul_interactions.mjs
node scripts/validate_links.mjs
node scripts/check_asset_sizes.mjs

# Each audit starts its own server on port 8091; run sequentially.
$env:AUDIT_GPU = "1"
node scripts/overhaul_audit.mjs after

# Baseline: archive original c9a4d43 into a separate directory, then:
$env:AUDIT_ROOT = ".audit/overhaul/baseline-src"
node scripts/overhaul_audit.mjs before
Remove-Item Env:AUDIT_ROOT

# Software rendering diagnostic:
Remove-Item Env:AUDIT_GPU
node scripts/overhaul_audit.mjs software
```

## Remaining limits

These are short, single-workstation samples. They do not replace real iOS/Android device testing, physical mouse/precision-trackpad trials, or a larger repeat-run performance distribution. Hardware rendering and browser touch emulation were used; touch tests include synthetic swipe events. Cold driver work can still stall individual frames, even with async batched compilation. Immediate content and CSS artwork remain available while graphics prepare. GPU resource counts plateaued in repeated traversal; a prolonged memory soak and actual GPU utilization were not measured. No merge or production deployment was performed.
