# Portfolio runtime architecture (v4.2)

The portfolio is a static HTML site with native document scrolling and a progressively enhanced Three.js observatory. Project claims, links, evidence and resume content are retained.

## Input and scene state

Six normal-flow sections have a `100svh` minimum height and expand with their content. Their `.scene-copy` elements hold the narrative; the canvas stays fixed behind them. Panels have no independent scrollers, hidden content or inert state. There is no scroll snap and no wheel/touch navigation listener: the browser handles reading, momentum, reversals, zoom and panning.

The earlier burst classifier could discard repeated wheel ticks, gentle follow-up movement and quick reversals. Native browsing replaces that input contract. Short movement visibly scrolls the document; large gestures may cross several sections. Browsing no longer enforces one gesture per scene.

A passive scroll listener schedules one animation-frame update. The section crossing a reading line at 40% of the viewport selects the current 3D world and navigation state. Passive selection uses `replaceState`, keeping the URL useful without adding a history entry for every section crossed. Explicit controls call `setScene`, scroll immediately to the selected section and use `pushState`. Direct hashes and browser history restore the section. Scene preparation never constructs a world inside the navigation handler.

Up/down arrows and Page Up/Down retain browser scrolling. Left/right arrows, Home and End provide explicit scene shortcuts outside dialogs and text-entry controls. Keyboard scene changes focus the selected heading so Tab reaches its case-study action. Dialogs use native focus containment and restore focus on close.

## Graphics preparation

Content, controls and the CSS orbital instrument render before WebGL initialization. Six procedural world factories are cached once. The preparation queue is serial and chooses the currently requested scene before queued background destinations. Next/previous scenes are prepared in idle time; distant worlds are built only when requested. A running driver operation cannot be preempted.

Each world progresses through unbuilt, building, built, compiling, ready (or failed). Preparation yields between construction, shader batches and GPU upload. `compileInBatches` compiles four distinct material/object configurations per task using the real target scene's fog and lighting. Temporary visibility is restored synchronously before yielding. Clones share source resources and never dispose them. Both ordinary and instanced mesh variants are prepared.

After compilation, a warm render uploads buffers and textures through the actual canvas output pipeline with the destination camera. The active world is restored and redrawn in the same JavaScript task before browser paint. This avoids offscreen-target tone-mapping shader variants and prevents background preparation flashing a different model. A world becomes visible only when it is still selected and preparation completed. Stale completions cannot reveal a different scene. The CSS instrument remains visible on cold jumps, context loss and WebGL failure. It fades out when WebGL is ready; a regression test prevents it covering a ready canvas.

The site retains a finite six-world GPU cache. No eviction occurs between visits, avoiding repeated construction and compilation. Warm traversal checks assert stable geometry and texture counts. Shared standard materials, instanced origin nodes and existing compressor/pore instancing reduce duplication and draw calls. On non-cached page teardown, geometries, materials, textures, renderer are disposed. Browser back/forward cache pages retain their live resources.

## Rendering and motion

Lit standard materials and tinted transparent shells replace physical glass/transmission. Local light counts are consistent between worlds, helping shader reuse. Case studies render directly without bloom's full-screen pass chain. The separate experimental lab retains bloom, with its internal targets actually resized via `setSize` and bloom disabled by default on coarse-pointer devices.

Scene arrival uses a 280ms ease-out cubic camera move from a small dolly offset near the destination. It does not traverse the distance between spatial worlds or add a scan/streak effect. Rotation and pointer damping use elapsed time, and cached curve samples interpolate continuously into a reused vector. Case-study prototypes receive elapsed time, smoothed pointers and delta seconds. Hidden/offscreen heroes stop their animation loop; reduced-motion heroes render a static frame, including after resize. Homepage reduced motion also stops continuous rendering.

Explore 3D explicitly enables mouse camera orbit and three labeled subsystem views with explanations. Reset restores the default view; Escape exits exploration and restores focus to its trigger. Wheel and touch continue scrolling even during exploration. Pause stops the animation loop while interactions still render an updated frame. These controls reuse the existing worlds and introduce no geometries or materials.

Animation delta is clamped for numerical stability; telemetry records raw frame intervals, including stalls longer than 800ms. The homepage exposes `window.__perfTelemetry.getSnapshot()` and the `?perf` HUD. Heroes expose `window.__heroTelemetry()`, including readiness, render count and running state. Desktop DPR is capped at 1.15, touch DPR at 1.0; sustained slow frames reduce resolution toward 0.65. Homepage recovery requires a longer stable fast period to avoid rapid quality oscillation.

## Content and delivery

Case-study desktop heroes place art beside readable narrative. Mobile heroes reserve a separate 250px art region above normal-flow content. Copy is visible immediately; only graphics fade in after readiness. Local OFL-licensed WOFF2 fonts remove third-party font CSS from the critical path. Evidence images have intrinsic dimensions, lazy loading and asynchronous decoding.

See [BENCHMARKS.md](BENCHMARKS.md) for measured results, limitations, raw evidence and reproduction commands. Async shader compilation reduces rendering stalls; it cannot guarantee that a browser driver never blocks the main thread. See the [Three.js renderer contract](https://threejs.org/docs/pages/WebGLRenderer.html) for compilation, lighting and disposal semantics.

## Recruiter-facing navigation and layout

Project summaries use an open layout with readable stage-level contrast. Oversized panel pseudo-elements and decorative card outlines are removed. Longer text expands the section and uses the document scrollbar. On mobile, models are reframed above the narrative. The case-study action is primary, with live deployments and detailed evidence still available. A separate previous/next control names the next project. Numbered rail controls retain accessible names and tooltips without labels overlapping the narrative.

See [native-scroll verification](NATIVE-SCROLL-VERIFICATION.md) for v4.2 behavior and validation. The [v4.1 UX verification](UX-VERIFICATION.md) preserves the earlier panel and gesture audit; its input contract is historical.
