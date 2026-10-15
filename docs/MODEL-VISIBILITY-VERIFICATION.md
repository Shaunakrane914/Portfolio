# Model framing and scroll verification (v4.7)

The previous presentation still left the visible 3D model small. At 1768x1000, the same projection probe measured a hero footprint of 423x353px before this change and 657x580px after: approximately 55% wider and 64% taller. Compare the [before capture](benchmarks/2026-10-15/scroll-feel/before-origin.png) and [after capture](benchmarks/2026-10-15/scroll-feel/after-origin.png).

## What changed

- Fit actual vertices, including instance transforms, rather than a padded world box. Center the projected silhouette using a camera view offset and fill approximately 88% of its dominant region dimension. The hero also has more horizontal and vertical space. No screenshot frame or control panel covers the model.
- Move the one shared WebGL canvas into the selected model region. It is an absolute child in document flow; the browser composites it with the text while scrolling. The old full-viewport canvas needed a JavaScript/WebGL redraw to follow every scroll position. The drawing buffer now covers only the model region.
- Reduce decorative updates during active scrolling, skip offscreen draws and defer background scene preparation until input is quiet. Native page movement remains independent of that decorative update rate. Intentional throttling does not reduce resolution.
- Recognize fresh impulses and gentle ramps after momentum decay. Compute the cap from actual scroll position, avoiding a jump ahead to the accumulated future wheel target. A pre-selection clamp catches queued compositor overshoot; explicit navigation and bypassed inputs release ownership.
- Move the footer into document flow and put the mobile hero model before the work index.

## Verification

| Check | Result |
|---|---|
| Browser interactions | 77 groups passed, including strong swipes, impulse/ramp releases, reversals, bypasses, touch, history, dialogs, model ownership and GPU lifecycle |
| Homepage layout | 30 passed across 1440x900, 1280x720, 1024x600, 390x844 and 844x390 |
| Model composition |Shared canvas matches its selected region; projected geometry stays contained, clear of narrative, with at least 70% dominant-axis occupancy |
| Gesture logic |Passed, including queued native movement and tiny fresh impulses |
| Internal references | 149 checked across eight pages; zero broken links |

See [interaction traces](benchmarks/2026-10-15/scroll-feel/interactions.json), [layout results](benchmarks/2026-10-15/scroll-feel/layout.json), [before framing trace](benchmarks/2026-10-15/scroll-feel/before-trace.json) and [after framing trace](benchmarks/2026-10-15/scroll-feel/after-trace.json). The full local capture set remains in `.audit/`. The seven case-study implementations are unchanged by v4.7; the current browser suite verifies their lifecycle and navigation. Their [14 layout views and resize roundtrips](benchmarks/2026-10-15/model-visibility/cases.json) belong to the preceding validation.

## Browser scrolling sample

Chrome 155.0.8059.41 on Intel UHD / ANGLE D3D11, 1440x900. Each window sends five separate swipes down and five up. Each swipe uses `[350,300,240, 180,140,100,70,45,25,14,7,3]` at 30ms intervals with 200ms between gestures. Every swipe must finish at exactly the adjacent chapter; both windows visited all six chapters and returned to the top.

| Window | Browser frame average | P95 | P99 | Maximum |
|---|---:|---:|---:|---:|
| First traversal | 136.8 FPS | 8.1ms | 14.8ms | 28.3ms |
| Warm traversal | 139.0 FPS | 7.6ms | 14.1ms | 34.5ms |

No main-thread task above 50ms was recorded within these windows. Across 240 trusted events, 180 tail events were intentionally bounded. Runtime errors: zero. See [raw data](benchmarks/2026-10-15/scroll-feel/performance.json). The [preceding v4.6 sample](benchmarks/2026-10-15/model-visibility/performance.json), using the same input sequence on this workstation, recorded P99 intervals of 34.7/20.9ms and maximum intervals of 62.5/55.4ms. These short sequential samples suggest improvement, rather than a controlled multi-run performance distribution.

The table measures the browser's independent requestAnimationFrame intervals. Decorative WebGL updates intentionally run less frequently during scrolling; the browser can move the canvas texture without waiting for those redraws. Physical trackpad/display smoothness, real mobile hardware and long GPU-memory soaks remain unverified. Wheel events expose no standard gesture-end signal, so fresh-intent classification remains a tested timing/direction heuristic.

## Research and reproduction

[Lusion's Devin AI case study](https://lusion.co/projects/devin_ai/) emphasizes clarity and approachable presentation. [Marco Ayuste's portfolio case study](https://marcoayuste.com/projects/personal-site) discusses laptop readability, adaptive graphics and measuring actual full-page scrolling. These informed design priorities; neither source establishes this site's performance or implies the same implementation.

Run browser suites sequentially. The interaction suite starts its own server:

```powershell
node scripts/test_chapter_wheel.mjs
node scripts/overhaul_interactions.mjs
node scripts/validate_links.mjs
```

With the local preview running at `http://127.0.0.1:8089/` or `PREVIEW_URL`:

```powershell
node scripts/audit_scene_layout.mjs after
node scripts/audit_scroll_feel.mjs after
$env:SCROLL_AUDIT_DIR = '.audit/scroll-feel/after'
node scripts/audit_native_scroll.mjs
Remove-Item Env:SCROLL_AUDIT_DIR
```

Use `CHROME_PATH` when needed. The before capture used source commit `ad1ef69`; point `PREVIEW_URL` at that source when reproducing it. [Earlier rendering benchmarks](BENCHMARKS.md) and [editorial verification](EDITORIAL-DESIGN-VERIFICATION.md) remain historical.
