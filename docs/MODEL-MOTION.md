# Autonomous model motion (v4.9)

The full animation pause introduced in v4.8 made the model appear stopped during input. v4.9 keeps autonomous animation running before, during and after scrolling. It requires no model hover, pointer movement, focus click or resume timer.

Aegis and Gridium also have a small automatic turn independent of pointer parallax. Their overall model pose changes while the pointer is parked elsewhere, alongside their internal signal animation.

During actual document movement, decorative draws use an approximately 30 FPS budget. Native compositing still moves text and canvas independently. When the document stops moving, the normal drawing cadence returns automatically. Bounded wheel momentum does not extend that reduced cadence. Case-study render loops remain active while their hero is visible. Reduced-motion preferences retain static rendering; hidden and offscreen heroes still stop rendering.

The motion audit parks the pointer in the header, verifies rendered-frame progression and compares actual model-region screenshots. It can exercise all five homepage models and seven case-study heroes at idle, during scrolling and afterward, on desktop and touch-enabled browser contexts. Touch paths use Chromium's native touch input pipeline. Unlike frame-count-only checks, a screenshot comparison verifies a visible change in the model region.

Current validation: all 30 focused homepage motion checks pass, including automatic model-pose changes without pointer input. All 84 interaction groups pass, including capped momentum with the pointer parked in the header, and all 30 responsive layouts keep the large models contained. See [motion data](benchmarks/2026-10-15/model-motion/motion.json), [interaction data](benchmarks/2026-10-15/model-motion/interactions.json) and [layout data](benchmarks/2026-10-15/model-motion/layout.json).

Run browser suites sequentially with the local preview at port 8089:

```powershell
node scripts/audit_model_motion.mjs
node scripts/audit_model_motion.mjs --home-only
node scripts/overhaul_interactions.mjs
node scripts/audit_native_scroll.mjs
```

Motion results are written to `.audit/model-motion/results.json`. The during-scroll frame-count assertion excludes screenshot encoding time, so idle redraws cannot masquerade as movement during the swipe. Runtime readiness, single-chapter trackpad bounds, accessibility, keyboard/history and GPU lifecycle remain covered by the interaction suite. Headless browser verification does not establish physical display smoothness.
