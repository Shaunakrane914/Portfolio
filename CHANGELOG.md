# Changelog

## v4.7.0 - 2026-10-15

- Fit and center actual geometry instead of padded world boxes. Increase the hero model's visible width by approximately 55% in the 1768x1000 capture.
- Place the shared canvas inside the active model region so native scrolling composites it with the narrative. Render only the region, reduce decorative updates during input, skip offscreen draws and defer background preparation while scrolling.
- Recognize fresh single impulses and gentle ramps after momentum decay. Preserve one-chapter bounds and deliberate reversal behavior.
- Move the footer into document flow and show the mobile hero model before the work index. Expand regression checks for canvas ownership, alignment and model occupancy.


## v4.6.0 - 2026-10-15

- Keep the enlarged model regions and tighten homepage camera framing without adding cover panels or controls.
- Bound each continuous trackpad wheel burst to one adjacent chapter. Keep ordinary in-range movement native and allow immediate deliberate reversals, small fresh input and renewed swipes.
- Normalize wheel modes, account for queued browser movement, and clamp before scene selection. Reset ownership for explicit navigation, keyboard, touch, resize and dialogs. Preserve reading through the final contact section.
- Verify large-model framing across 30 homepage layouts and 14 case-study views with 14 resize roundtrips. See the [current verification report](docs/MODEL-VISIBILITY-VERIFICATION.md) for interaction and rendering evidence.



## v4.4.0 - 2026-10-14

- Remove the four browser-style screenshot previews so the procedural models remain the primary project visuals. Preserve direct case-study, live and evidence links.
- Reserve transparent `.model-view` regions for the introduction and four featured projects. Render real WebGL geometry only inside its own scissored rectangle, following native document scrolling without covering text or capturing input.
- Cache model geometry bounds, including instanced geometry, and fit cameras to the available responsive viewport. Improve model visibility through exposure, lighter fog, brighter TopoFlow material and gentle bounded Origin/TopoFlow motion.
- Keep case-study metrics and direct CTAs in the desktop text lane, with plain borderless metrics and no art shade or decorative left border. Fit both case renderers on resize and remove Food/Sodexo's three illustrative in-world UI displays.
- Retain native browsing, keyboard focus, history, the curated work index and accessible contact copying. Initial interaction verification passed 63 groups. Subsequent layout, case and trackpad validation is recorded in the [model-visibility report](docs/MODEL-VISIBILITY-VERIFICATION.md).


## v4.3.0 - 2026-10-14

- Introduce an editorial portfolio layout with a large serif headline, full-name identity, a full-width four-project index and restrained automatic 3D.
- Remove the 3D explorer controls and manual orbit/pause state. Keep the canvas decorative and preserve the v4.2 native scrolling, history, focus and keyboard contract.
- Add directly linked project previews using the Aegis agent interface, Gridium overview, flat compressor evidence chart and labeled TopoFlow illustration. Retain original technical claims in visible implementation paragraphs.
- Order mobile project reading as title/summary, image, then metrics and links. Add subtle bounded preview tilt, hover destinations and a 2px reading-progress indicator; respect reduced motion.
- Add three engineering-practice groups and a contact ending with direct email, resume and social links. Email copying announces success and focuses the existing email link if clipboard access fails.
- Record 62 passing browser interaction groups, 30 chapter layout checks and a separate focused scrolling sample in the [editorial-design report](docs/EDITORIAL-DESIGN-VERIFICATION.md). Update the progress indicator and canvas dimming to reduce compositing/style overhead. Earlier benchmark and native-scroll samples remain historical.


## v4.2.0 - 2026-10-14

- Replace wheel/touch scene hijacking with native document browsing after repeated wheel ticks, gentle follow-up input and quick reversals could be ignored. Six viewport-sized sections grow with their content; large gestures may cross several sections.
- Remove nested panel scrolling and scroll snap. Keep vertical arrows and page keys native; retain explicit section controls, left/right/Home/End shortcuts, keyboard focus, direct links and browser history.
- Select the fixed 3D backdrop from a passive reading-line observer. Passive changes replace the current history entry; explicit navigation scrolls immediately and adds an entry.
- Replace long camera travel and scan/streak effects with a 280ms ease-out cubic dolly near the destination. Reframe mobile models above the narrative.
- Add explicit Explore 3D camera orbit, labeled subsystem views with explanations, Reset and Escape. Wheel and touch remain native during exploration; Pause stops continuous rendering while interactions still update the view. Reuse existing geometry and materials.
- Verify 54 browser interaction groups, 30 chapter layouts and five expanded-explorer layouts in the [native-scroll report](docs/NATIVE-SCROLL-VERIFICATION.md), including a separate focused hardware scrolling sample. Earlier performance tables remain historical.


## v4.1.0 - 2026-10-14

- Fix false panel overflow from oversized backdrops and allow fresh wheel/touch gestures at content edges to navigate.
- Keep momentum owned by its original gesture even when events target the next scene's content.
- Remove panel outlines, scrollbar tracks and dense metric dividers; put case-study links first and add named next-project controls.
- Keep keyboard focus in the selected project and compact header/rail controls on narrow screens.
- Audit panel overflow across six scenes at five viewports, including short landscape, and add direct-over-text navigation regressions. The archived [verification](docs/UX-VERIFICATION.md) records 44 interaction groups and 30 scene/viewport captures for this earlier navigation contract.


## v4.0.0 - 2026-10-14

- Replace transition cooldown scrolling with gesture consumption, delta normalization, tail hysteresis and native panel ownership.
- Decouple semantic navigation/history from prioritized scene construction, batched shader preparation and GPU readiness.
- Simplify glass and bloom, instance origin nodes, share materials, and record unclipped frame delays.
- Share case-study graphics lifecycle, pause offscreen, render statically for reduced motion, and dispose GPU resources.
- Redesign case-study heroes for desktop/mobile; add immediate CSS art, local fonts and dimensioned lazy images.
- Add asserting browser/input tests, before/after screenshots and raw hardware benchmark evidence.

All notable changes to Shaunak Rane's Systems Portfolio will be documented in this file.

## [3.4.0] - 2026-10-14

### Performance Engineering Overhaul & Smoothness
- **Asynchronous Scene Preparation Pipeline:** Implemented proactive background world construction and prewarming starting 250ms post-render. Prioritizes immediately adjacent scenes (`currentScene + 1`, `currentScene - 1`) and dynamically reprioritizes whenever active scene changes.
- **Exact Lighting & Fog Shader Precompilation:** Solved the WebGL driver shader compilation hitch by precompiling shaders with matching hemisphere, directional, and local point lights plus `scene.fog`, eliminating the 1.2s cold navigation freeze.
- **GPU Texture Pre-Initialization:** Added `renderer.initTexture` pre-uploads for dynamic canvas textures during idle time, preventing synchronous `texImage2D` texture upload freezes during active transitions.
- **Optimized Canvas Resolution:** Reduced dynamic code canvas dimensions to 512x310 with 2x anisotropy, cutting texture memory by 75% while maintaining sharp typography.
- **InstancedMesh Conversion (Compressor CBM):** Converted 182 individual rotor blades and 42 rotor sensors to `THREE.InstancedMesh`, reducing Scene 3 draw calls from **374 down to 161** (-57%).
- **Zero-Allocation Spline Pre-Sampling:** Added `getCachedCurvePoint` to pre-sample CatmullRom splines into 120 points, eliminating thousands of `THREE.Vector3` garbage-collection allocations per frame across Aegis, Gridium, and TopoFlow packet loops.
- **Shared Geometry Buffers:** Reused shared geometries across Gridium nodes/packets, Aegis evidence packets, and Profile modules.
- **Unclipped Frame-Time Telemetry:** Separated raw frame delta measurement (`rawFrameDeltaMs`) from clamped animation physics delta (`dt`), allowing the adaptive quality controller and `window.__perfTelemetry.getSnapshot()` to record true unhidden frame drops, p95, and p99 frame times.
- **Case-Study Hero Precompilation:** Added `renderer.compileAsync(scene, camera)` to `project-scenes.js` and `lab-controller.js`.
- **HDR Composer Optimization:** Set `samples: 0` on HDR float render targets in `js/threeui/composer.js` and capped DPR at 1.25, avoiding costly multi-sample resolves on mobile and integrated GPUs.
- **Reproducible Benchmark Infrastructure:** Built `scripts/lib/playwright_loader.mjs` and updated all 14 test scripts to resolve Playwright without hardcoded machine-specific absolute Windows paths.
- **Asset Cache Invalidation:** Bumped version badge in `index.html` to `v3.4` and asset query strings to `?v=3.4`.

## [3.3.0] - 2026-10-14

### Input Responsiveness & Smooth Physics
- **Wheel Latency Slashed to 220ms:** Reduced transition lockout window from 380ms down to 220ms.
- **Micro-gesture Threshold:** Lowered wheel accumulation threshold to 28px for instantaneous mouse wheel and trackpad response.
- **Zero-Allocation Springs:** Eliminated per-frame vector cloning in `springVector`, preventing garbage collection stutters.
- **Global Parallax Tracking:** Attached `pointermove` to `window`, eliminating dead zones and jerky camera jumps when hovering over text panels or navigation bars.
- **Direct Critical Damping:** Removed artificial camera velocity impulse, allowing critically damped springs (stiffness 88, damping 14.5) to settle smoothly in ~260ms.
- **Visual Version Confirmation:** Added header badge and console telemetry identifying live version `v3.3.0`.

## [3.2.0] - 2026-10-13

### Performance & Latency Optimizations
- **Input Responsiveness:** Reduced scene transition lockout window from 950ms to 380ms for instant wheel and gesture handling.
- **Scroll Gesture Threshold:** Lowered wheel accumulation threshold from 72px to 40px to eliminate drag resistance.
- **Spring Camera Dynamics:** Upgraded camera physics parameters (stiffness 82, damping 13.8; target stiffness 72, damping 12.8) cutting camera settling time by 50%.
- **DPR Clamping:** Capped maximum DPR at 1.2 on desktop and 1.0 on mobile to optimize GPU fill-rate on high-resolution displays.
- **Edge Cache Invalidation:** Bumped static asset query hashes to `v=3.2`.

### Tailoring & Content
- **Zscaler SDE Resume Integration:** Synchronized single-page ATS-optimized resume (`Shaunak_Rane_Resume.pdf`) across `/resume`, `index.html`, and all case studies.
- **Cloudflare Redirects:** Added robust `_redirects` configuration mapping `/resume` directly to `Shaunak_Rane_Resume.pdf`.

## [3.1.0] - 2026-10-12

### Features & Additions
- **Aegis Evaluation Report:** Integrated complete 24-section scientific benchmarking analysis for Aegis multi-agent security engine.
- **Procedural Shaders:** Added flow veins, curl noise vector fields, and holographic Fresnel edge effects.
- **ThreeUI Lab:** Added interactive laboratory testing suite (`threeui-lab.html`).
