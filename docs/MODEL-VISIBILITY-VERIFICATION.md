# Model visibility and trackpad verification (v4.6)

Verified locally on 15 October 2026 against the enlarged-model presentation. Four screenshot/browser preview frames and all explorer controls remain removed. Real geometry occupies a clear model region beside the copy on desktop and a separate band on phones. Homepage framing fills more of that region; the larger regions and case-study camera scale from v4.5 are retained.

## Navigation behavior

A continuous trackpad wheel burst can reach one adjacent chapter. Its bounds stay fixed even after the visible chapter changes. Ordinary in-range movement keeps its browser default; only overshooting momentum and immediate deliberate reversals are intercepted. Expected-target tracking accounts for queued browser scrolling, and a scroll-time clamp runs before selecting a scene. A 160ms quiet gap, meaningful reversal or renewed acceleration after a decayed tail begins fresh intent. Small movements have no minimum-travel threshold or graphics-animation lock.

Bypassed input modes release prior vertical ownership, so a diagonal gesture is not pulled back by an earlier cap. Touch panning, vertical keyboard reading, scrollbars, horizontal gestures, pinch zoom, dialogs and nested native scrollers retain their normal behavior. Explicit project jumps and browser history remain independent. The final profile can scroll through its entire contact ending.

## Validation

| Check | Result |
|---|---|
| Gesture logic | Pass: large bursts, continuous momentum, tiny fresh input, reversals, renewed acceleration, final content, wheel modes |
| Homepage layouts | 30 passed: six chapters at 1440x900, 1280x720, 1024x600, 390x844 and 844x390 |
| Case-study heroes | 14 views and 14 portrait/desktop resize roundtrips passed across all seven routes |
| Internal links | 149 references across eight pages, zero broken links |
| Full browser interactions | 75 groups passed, including trusted wheel traces, bypass ownership, touch, history, dialogs, reduced motion and GPU lifecycle |

The homepage audit checks complete projected geometry bounds, model/text separation, ready canvas visibility, clear header/navigation space, no cover panels, stable chapter heights and no nested or horizontal overflow. Case checks cover plain metrics, clear model/copy lanes, readiness and stable geometry/texture resources after resize. Selected captures and raw JSON are archived in [the verification artifacts](benchmarks/2026-10-15/model-visibility/).

## Focused scrolling sample

Chrome 155.0.8059.41, Intel UHD / ANGLE D3D11, 1440x900. Each traversal uses five separate swipes down and five up; each swipe sends `[350,300,240,180,140,100,70,45,25,14,7,3]` CSS-pixel deltas at 30ms intervals, followed by 200ms quiet. Every swipe must end at exactly its adjacent chapter. Each traversal visited all six chapters and returned to scroll position zero.

| Window | Browser frame average | P95 | P99 | Maximum interval |
|---|---:|---:|---:|---:|
| First traversal | 113.2 FPS | 14.2ms | 34.7ms | 62.5ms |
| Warm traversal | 122.2 FPS | 14.0ms | 20.9ms | 55.4ms |

Across the 240 trusted wheel events, 180 overshooting tail events were intentionally bounded. No main-thread long task above 50ms was recorded in the sampled windows. The ready compressor camera was within 0.162 world units of its target after 350ms, including bounded pointer offset. Runtime errors: zero. See [raw performance data](benchmarks/2026-10-15/model-visibility/performance.json).

These are short sequential headless browser samples on one workstation. Larger frame intervals remain in the results. The input sequence differs from earlier unrestricted scrolling samples, so the numbers are not a controlled speed comparison or a guarantee about physical trackpad/display smoothness. Physical laptops, real mobile devices and prolonged GPU-memory tests remain unverified. Wheel events expose no standard gesture-end signal; the boundary heuristic is covered with trusted browser event sequences.

## Presentation and research

The camera fits cached geometry bounds, including instances, to an uncluttered render region. Exposure is 1.2 and fog density is 0.012. TopoFlow has brighter surfaces; Origin and TopoFlow oscillate gently instead of continuously turning away. Reduced motion preserves a static model. Content remains usable without WebGL. All seven case studies keep their metrics and CTAs outside the model lane, remove art-dimming overlays and refit the camera on resize. Food and Sodexo omit the three illustrative UI displays. Ordinary report evidence screenshots remain in the report body.

[Lusion's Devin AI case study](https://lusion.co/projects/devin_ai/) describes clarity, approachability and subtle storytelling. [Marco Ayuste's portfolio case study](https://marcoayuste.com/projects/personal-site) describes readability on ordinary laptops, adaptive quality, a fallback before WebGL and verification using real full-page scrolling. These informed the design priorities; dedicated model regions and the gesture guard are this portfolio's implementation decisions. Neither source establishes this portfolio's performance or uses this exact layout by implication.

## Reproduction

Run browser suites sequentially:

```powershell
node scripts/test_chapter_wheel.mjs
node scripts/overhaul_interactions.mjs
node scripts/validate_links.mjs
```

With the local preview running at `http://127.0.0.1:8089/` (or `PREVIEW_URL`):

```powershell
node scripts/audit_scene_layout.mjs after
node scripts/audit_case_models.mjs
$env:SCROLL_AUDIT_DIR = '.audit/model-visibility'
node scripts/audit_native_scroll.mjs
Remove-Item Env:SCROLL_AUDIT_DIR
```

Use `CHROME_PATH` when needed. Full local captures live in `.audit/model-visibility/`; the interaction suite starts its own server. The [historical benchmark tables](BENCHMARKS.md), [v4.2 native-scroll report](NATIVE-SCROLL-VERIFICATION.md) and [v4.3 editorial report](EDITORIAL-DESIGN-VERIFICATION.md) describe older snapshots.
