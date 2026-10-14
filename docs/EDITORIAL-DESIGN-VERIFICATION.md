# Editorial portfolio verification (v4.3)

The homepage presents the work directly. The model explorer, manual orbit, pause/reset controls and configuration state are removed. Automatic Three.js artwork remains decorative with `pointer-events: none`; browsing keeps the native document scrolling introduced in v4.2.

## Presentation

- Large serif identity headline, full name in the header/eyebrow, a clear engineering role and four numbered project shortcuts.
- Aegis and Gridium product captures linked directly to their case studies, with restrained perspective and bounded pointer tilt. The compressor evidence chart stays flat. TopoFlow uses a labeled pore-network illustration.
- Plain-language project introductions with existing technical descriptions retained visibly below the actions and evidence. Existing claims, live links, resume and case studies are preserved.
- Mobile reading order: title/summary, project image, metrics and links. Images reserve their dimensions and load lazily; interface text remains independent of the WebGL canvas.
- Three engineering-practice groups and a contact ending with direct email, LinkedIn, GitHub and resume links. Email copying announces success; denied clipboard access focuses the existing email link and supplies a useful status message.
- Subtle hover destinations, a 2px document-progress line and reduced-motion behavior. No additional Three.js geometries or materials are introduced.

`css/editorial.css` owns this presentation above the base observatory stylesheet. The progress line updates its own transform, avoiding an inherited CSS-variable update across the document. The renderer controls backdrop brightness through exposure, avoiding persistent CSS opacity over the full-screen canvas. The ready/fallback regression verifies that fallback art cannot cover a ready model.

## Interaction and layout checks

[Raw interaction results](benchmarks/2026-10-14/editorial/interactions.json) contain 62 passing groups and no page errors. These cover trusted browser wheel/touch scrolling, gentle repeated input, reversals, history/direct URLs, native keys/focus, dialogs, the curated work index, all four preview destinations, real contact links, clipboard success/rejection, absence of model-control widgets, decorative pointer behavior, reduced motion, context loss, stable GPU resource counts, all seven case-study hero lifecycles and lab switching.

[Raw layout results](benchmarks/2026-10-14/editorial/layout.json) cover all six chapters at five viewports:

| Viewport | Chapters checked | Horizontal overflow | Nested narrative scrolling | Scene-induced height shifts |
|---|---:|---|---|---|
| 1440 × 900 | 6 | None | None | None |
| 1280 × 720 | 6 | None | None | None |
| 1024 × 600 | 6 | None | None | None |
| 390 × 844 | 6 | None | None | None |
| 844 × 390 | 6 | None | None | None |

The audit also verifies loaded images, declared dimensions, alternative text, correct preview destinations, header clearance and the mobile introduction-before-image order. It captures 20 isolated previews and five contact views in addition to the 30 chapter screenshots. Selected desktop, compact, mobile, landscape and contact captures were visually inspected. Contact is captured at the document bottom; floating scene controls are hidden for Profile so they cannot cover the closing links.

Selected artifacts: [desktop opening](benchmarks/2026-10-14/editorial/hero-desktop.png), [compact opening](benchmarks/2026-10-14/editorial/hero-compact.png), [Aegis desktop](benchmarks/2026-10-14/editorial/aegis-desktop.png), [Aegis mobile](benchmarks/2026-10-14/editorial/aegis-mobile.png), [compressor](benchmarks/2026-10-14/editorial/compressor-desktop.png), [TopoFlow](benchmarks/2026-10-14/editorial/topoflow-desktop.png), and contact on [desktop](benchmarks/2026-10-14/editorial/contact-desktop.png) / [mobile](benchmarks/2026-10-14/editorial/contact-mobile.png).

JavaScript syntax and diff whitespace checks pass. Local link validation checks 157 references across eight HTML pages with no broken internal links/assets.

## Focused rendering sample

The [current scrolling sample](benchmarks/2026-10-14/editorial/performance.json) uses Chrome 155.0.8059.41, confirmed Intel UHD / ANGLE D3D11 hardware acceleration and a 1440 × 900 viewport. Each traversal sends 49 trusted 100px wheel events down, then 49 up, at 30ms intervals, covering all six chapters and returning to the document top. Across first/warm traversal, all 196 events remained uncancelled and no main-thread long task above 50ms was recorded within the sampled windows.

| Window | Browser frame average | P95 | P99 | Maximum interval |
|---|---:|---:|---:|---:|
| First traversal | 77.5 FPS | 41.8ms | 62.6ms | 83.6ms |
| Warm traversal | 80.0 FPS | 41.7ms | 62.5ms | 76.5ms |

The [earlier compositing diagnostic](benchmarks/2026-10-14/editorial/performance-before-compositing.json) used the same scrolling sequence before the progress/exposure correction, recording averages of 68.7 and 70.7 FPS. These are short sequential headless samples on one workstation, not a controlled multi-run distribution or a guarantee about physical display smoothness. Longer frame intervals remain in the evidence; no claim is made that all visible lag is eliminated. Physical trackpads, real mobile devices and a long memory soak remain unverified.

The [original rendering tables](BENCHMARKS.md) and [v4.2 native-scroll capture](NATIVE-SCROLL-VERIFICATION.md) describe older snapshots and different experiments. Their numbers do not establish current frame rates.

## Reproduction

```powershell
node scripts/overhaul_interactions.mjs
node scripts/validate_links.mjs
```

The interaction suite starts its own server. With a preview running at `http://127.0.0.1:8089/` (or `PREVIEW_URL`), run browser captures sequentially:

```powershell
node scripts/audit_scene_layout.mjs after
$env:SCROLL_AUDIT_DIR = '.audit/editorial-design'
node scripts/audit_native_scroll.mjs
Remove-Item Env:SCROLL_AUDIT_DIR
```

Set `CHROME_PATH` when needed. Raw results are written under `.audit/overhaul/` and `.audit/editorial-design/`.
