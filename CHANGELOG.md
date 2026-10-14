# Changelog


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
