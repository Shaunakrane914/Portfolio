# Native scrolling and 3D exploration (v4.2)

This is the historical v4.2 capture. The current [v4.3 editorial portfolio](EDITORIAL-DESIGN-VERIFICATION.md) retains native browsing and removes the model controls. Use commit `72b4e18` to reproduce the archived v4.2 experiment; current scripts also cover newer presentation behavior.

Trackpad feedback after v4.1 exposed the cost of gesture guessing: repeated 100ms ticks, a quick reversal and a steady 5px follow-up could be consumed as inertia. The classifier passed its one-burst assertions while still discarding input people intended as navigation. Its touch path also rejected drags longer than 600ms.

The homepage now has six normal document sections with a fixed 3D canvas behind them. All narrative stays in document flow and expands with its content. There are no global wheel/touch navigation handlers, nested narrative scrollers, swipe thresholds or cooldowns. A passive scroll listener selects the model at a reading line 40% down the viewport. Small input visibly moves the document; a large fling may traverse several sections by normal browser scrolling. The previous one-gesture/one-scene rule is retired. Explicit project controls still select a precise destination immediately.

CSS scroll snapping was tested and left out: in this Chrome environment, the trusted large-wheel input crossed several mandatory stops, while a small burst snapped back to its starting section. The [W3C scroll-snap contract](https://www.w3.org/TR/css-scroll-snap-1/#scroll-snap-stop) describes stop selection, and the [WheelEvent specification](https://www.w3.org/TR/uievents/#interface-wheelevent) describes input events; neither provides this site with a reliable device gesture-end signal. The implementation lets the browser own scrolling instead of attempting another timing filter.

## Interaction and layout evidence

The final [interaction capture](benchmarks/2026-10-14/native/interactions.json) records 54 passing groups and no page errors. Trusted Playwright mouse-wheel input covers short bursts, successive 100ms ticks, steady 5px deltas, quick reversals and scrolling over Aegis text. Chromium touch input covers slow drags longer than 600ms, successive swipes and reversals. Synthetic events are used only to verify that listeners do not cancel default input; they are not presented as evidence of native scrolling.

Other checks cover direct URLs, explicit and passive history behavior, restoring the initial empty-hash homepage, keyboard/focus, dialogs, case-study return links, WebGL failure/context loss, GPU-cache stability, reduced motion, hero lifecycle and lab switching. Narrative touch actions permit browser panning and pinch zoom. Explorer tests verify opt-in mouse orbit, subsystem views, reset, accessible control sizes, continued wheel scrolling, stopping continuous rendering on Pause, and focus restoration on Escape.

The [layout capture](benchmarks/2026-10-14/native/layout.json) records all six scenes at 1440 × 900, 1280 × 720, 1024 × 600, 390 × 844 and 844 × 390. All 30 chapter captures pass horizontal-overflow, header-clearance, section-alignment and no-nested-scroller assertions. Five additional expanded-explorer captures verify that Close/Pause stay below the header and the panel fits above fixed footer navigation. Mobile next-project actions sit in document flow so they do not cover the narrative.

Selected inspected images:

- [Desktop introduction](benchmarks/2026-10-14/native/origin-desktop.png) and [Aegis](benchmarks/2026-10-14/native/aegis-desktop.png).
- [Aegis mobile](benchmarks/2026-10-14/native/aegis-mobile.png) and [short landscape](benchmarks/2026-10-14/native/aegis-landscape.png).
- Expanded explorer on [desktop](benchmarks/2026-10-14/native/explorer-desktop.png) and [short landscape](benchmarks/2026-10-14/native/explorer-landscape.png).

## Focused hardware sample

The [raw scrolling sample](benchmarks/2026-10-14/native/performance.json) used Chrome 155.0.8059.41 with confirmed Intel UHD / ANGLE D3D11 hardware acceleration at 1440 × 900. Each traversal scrolls 45 trusted 100px events down, then 45 up, with a 30ms interval. No event was cancelled, both traversals returned to the document top, and the browser recorded no main-thread long task above 50ms within the sampled windows.

| Window | Browser frame average | P95 | P99 | Maximum frame interval |
|---|---:|---:|---:|---:|
| First traversal | 117.9 FPS | 14.0ms | 34.7ms | 41.6ms |
| Warm traversal | 119.0 FPS | 14.0ms | 34.7ms | 41.8ms |

These short headless browser samples describe this workstation. They are not a guarantee about a physical display or another laptop, and are not directly comparable with the older idle-only benchmark. Occasional longer frames remain visible in the raw evidence.

Camera arrival now uses a 280ms cubic ease with a small movement near the destination. It no longer springs across distant world positions or covers the model with scan/streak effects. A ready compressor camera was within 0.162 world units of its base destination after 350ms; the remaining offset is within the deliberately bounded pointer parallax. The explorer changes the camera and DOM controls without adding meshes or materials. Pause stops the continuous animation loop; explicit interactions and readiness/resize still render when needed.

Physical trackpad hardware, real iOS/Android devices and a long memory soak remain unverified. The [v4 rendering report](BENCHMARKS.md) and [v4.1 UX capture](UX-VERIFICATION.md) remain historical snapshots, not current navigation measurements.

## Reproduction

```powershell
node scripts/overhaul_interactions.mjs
node scripts/validate_links.mjs
```

The interaction suite starts its own server. For the layout and focused hardware captures, start a preview in another terminal:

```powershell
python -m http.server 8089 --bind 127.0.0.1
```

Then run:

```powershell
node scripts/audit_scene_layout.mjs after
node scripts/audit_native_scroll.mjs
```

Set `PREVIEW_URL` or `CHROME_PATH` when needed. Results are written under `.audit/overhaul/` and `.audit/native-scroll/`.
