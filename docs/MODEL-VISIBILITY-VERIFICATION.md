# Model visibility verification (v4.4)

Final verification is pending. The initial interaction run passed 63 groups and the first homepage audit passed 30 chapter/view checks. Model sizing and shared case-study changes followed those runs; the final interaction/layout reruns, case audit and performance capture must complete before these are treated as release results.

## Current presentation

- The four browser-style screenshot previews are removed. The introduction and four featured projects reserve empty, transparent `.model-view` regions containing real WebGL artwork.
- One fixed canvas follows native document scrolling and renders only inside the selected region's scissored rectangle. The region stays outside narrative, metrics and navigation; the canvas accepts no pointer or wheel input.
- Geometry bounds, including instanced meshes, are cached when a world is built. Responsive camera fitting leaves room for the complete model. Homepage exposure is 1.2, fog density is 0.012 and TopoFlow's material is brighter. Origin and TopoFlow use gentle bounded motion.
- Native browsing, direct project shortcuts, keyboard focus, browser history, case studies, evidence links and contact copying remain available. Reduced motion produces a static model; content remains accessible without WebGL.
- All seven case-study heroes keep metrics and direct CTAs in the desktop text lane. Their metrics are plain and borderless, with no blur or art shade. Both renderers fit the camera on resize. Food and Sodexo no longer draw their three illustrative in-world UI displays.

Ordinary screenshots and scientific figures remain in report evidence sections; they do not overlay the hero models. The [v4.3 editorial report](EDITORIAL-DESIGN-VERIFICATION.md) describes the superseded image-preview presentation.

## Verification status

| Check | Status | Output |
|---|---|---|
| Browser interactions | Initial 63 groups passed; final rerun pending after shared case changes | `.audit/overhaul/interactions.json` |
| Homepage layout | Initial 30 checks passed; rerun pending after model-size adjustment | `.audit/model-visibility/after/layout.json` |
| Case-study models | Pending: seven routes at two starting viewports, including resize roundtrips | `.audit/model-visibility/cases/cases.json` |
| Focused scrolling performance | Pending; no current FPS or frame-time claim | `.audit/model-visibility/performance.json` |

The layout checks target five viewports: 1440 × 900, 1280 × 720, 1024 × 600, 390 × 844 and 844 × 390. They inspect model/narrative separation, projected geometry bounds, header/navigation clearance, document overflow, stable chapter heights and absence of screenshot/control overlays. Case checks also inspect readiness, plain metrics, responsive camera fitting and stable GPU resources across resize.

Passing geometry and DOM checks still require visual review of the captured models. Physical trackpads, real iOS/Android devices and prolonged GPU-memory testing remain outside this local verification.

## Research and design rationale

The primary sources directly verify the authors' stated goals and techniques. They do not establish this portfolio's performance or reveal uninspected camera implementations.

- [Lusion's Devin AI case study](https://lusion.co/projects/devin_ai/) describes explaining a complex AI product through clear, approachable presentation and subtle storytelling. This informed the decision to keep project summaries readable while giving the model a distinct visual role.
- [Marco Ayuste's portfolio case study](https://marcoayuste.com/projects/personal-site) describes readability on phones and integrated-graphics laptops, adaptive quality tiers, a fallback painted before WebGL and verification using actual full-page scrolling. Those constraints informed the validation approach; his reported scores and frame rates are not reused as ours.

Dedicated model regions, uncluttered framing, restrained lighting and no game-style onboarding are this portfolio's design decisions. They are not claims that the referenced sites use the same scissor layout or camera settings.

## Reproduction

Run browser suites sequentially. The interaction suite starts its own server:

```powershell
node scripts/overhaul_interactions.mjs
node scripts/validate_links.mjs
```

With the local preview running at `http://127.0.0.1:8089/` or `PREVIEW_URL`:

```powershell
node scripts/audit_scene_layout.mjs after
node scripts/audit_case_models.mjs
$env:SCROLL_AUDIT_DIR = '.audit/model-visibility'
node scripts/audit_native_scroll.mjs
Remove-Item Env:SCROLL_AUDIT_DIR
```

Set `CHROME_PATH` when needed. The historical [rendering tables](BENCHMARKS.md), [v4.2 native-scroll sample](NATIVE-SCROLL-VERIFICATION.md) and [v4.3 editorial sample](EDITORIAL-DESIGN-VERIFICATION.md) belong to earlier presentations and do not establish v4.4 frame rates.
