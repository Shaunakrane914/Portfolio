# Portfolio runtime architecture (v4)

The portfolio is a static HTML site with a progressively enhanced Three.js observatory. Case studies keep normal document scrolling. Project claims, links, evidence and resume content are retained.

## Input and scene state

`js/wheel-gesture.js` owns wheel input separately from camera animation. Pixel, line and page deltas are normalized. A 24px accumulated intent threshold consumes one burst. Event timestamps, an adaptive quiet boundary (140-280ms), direction, peak magnitude and acceleration distinguish a new gesture from a decaying tail. Weak residual events are suppressed for up to 600ms; two accelerating samples can establish a fresh small gesture. Continuous events never repeatedly rearm the same burst. Direction oscillation in a consumed burst cannot navigate backward.

WheelEvent has no OS gesture identifier or gesture-end signal. This is a conservative heuristic, tested against browser mouse-wheel events and deterministic precision-trackpad sequences; physical-device testing is still needed. Rapid button and keyboard commands never wait on wheel state or animation. Held keyboard repeats are ignored. Text-entry controls and overflowing panels keep native vertical keys.

An overflowing element owns its wheel burst while it can scroll in the input direction. Reaching an edge within that burst never hands its inertia to navigation; a fresh outward gesture at the edge changes scenes. A scene-navigation burst also suppresses native scrolling if subsequent momentum targets the newly revealed panel. Subpixel input participates in ownership rearming. Open dialogs retain native scrolling. Ctrl-wheel zoom and predominantly horizontal wheel gestures remain native. Touch uses its starting scroll position to choose native reading or scene navigation, and pointerup never duplicates a swipe.

`setScene` immediately changes semantic panels, inert state, current navigation and history. `pushState` retains scene entries; hash navigation restores browser back/forward and direct URLs. Preparation never constructs a world inside this handler. Dialogs use native focus containment and restore focus on close. Keyboard scene changes focus the selected heading so Tab reaches its case-study action; focus never remains inside an inert panel.

## Graphics preparation

Content, controls and the CSS orbital instrument render before WebGL initialization. Six procedural world factories are cached once. The preparation queue is serial and chooses the currently requested scene before queued background destinations. Next/previous scenes are prepared in idle time; distant worlds are built only when requested. A running driver operation cannot be preempted.

Each world progresses through unbuilt, building, built, compiling, ready (or failed). Preparation yields between construction, shader batches and GPU upload. `compileInBatches` compiles four distinct material/object configurations per task using the real target scene's fog and lighting. Temporary visibility is restored synchronously before yielding. Clones share source resources and never dispose them. Both ordinary and instanced mesh variants are prepared.

After compilation, a warm render uploads buffers and textures through the actual canvas output pipeline with the destination camera. The active world is restored and redrawn in the same JavaScript task before browser paint. This avoids offscreen-target tone-mapping shader variants and prevents background preparation flashing a different model. A world becomes visible only when it is still selected and preparation completed. Stale completions cannot reveal a different scene. The CSS instrument remains visible on cold jumps, context loss and WebGL failure. It fades out when WebGL is ready; a regression test prevents it covering a ready canvas.

The site retains a finite six-world GPU cache. No eviction occurs between visits, avoiding repeated construction and compilation. Warm traversal checks assert stable geometry and texture counts. Shared standard materials, instanced origin nodes and existing compressor/pore instancing reduce duplication and draw calls. On non-cached page teardown, geometries, materials, textures, renderer are disposed. Browser back/forward cache pages retain their live resources.

## Rendering and motion

Lit standard materials and tinted transparent shells replace physical glass/transmission. Local light counts are consistent between worlds, helping shader reuse. Case studies render directly without bloom's full-screen pass chain. The separate experimental lab retains bloom, with its internal targets actually resized via `setSize` and bloom disabled by default on coarse-pointer devices.

Camera springs integrate at substeps no larger than 1/144s. Rotation and pointer damping use elapsed time, and cached curve samples interpolate continuously into a reused vector. Case-study prototypes receive elapsed time, smoothed pointers and delta seconds. Hidden/offscreen heroes stop their animation loop; reduced-motion heroes render a static frame, including after resize. Homepage reduced motion also stops continuous rendering.

Animation delta is clamped for numerical stability; telemetry records raw frame intervals, including stalls longer than 800ms. The homepage exposes `window.__perfTelemetry.getSnapshot()` and the `?perf` HUD. Heroes expose `window.__heroTelemetry()`, including readiness, render count and running state. Desktop DPR is capped at 1.15, touch DPR at 1.0; sustained slow frames reduce resolution toward 0.65. Homepage recovery requires a longer stable fast period to avoid rapid quality oscillation.

## Content and delivery

Case-study desktop heroes place art beside readable narrative. Mobile heroes reserve a separate 250px art region above normal-flow content. Copy is visible immediately; only graphics fade in after readiness. Local OFL-licensed WOFF2 fonts remove third-party font CSS from the critical path. Evidence images have intrinsic dimensions, lazy loading and asynchronous decoding.

See [BENCHMARKS.md](BENCHMARKS.md) for measured results, limitations, raw evidence and reproduction commands. Async shader compilation reduces rendering stalls; it cannot guarantee that a browser driver never blocks the main thread. See the [Three.js renderer contract](https://threejs.org/docs/pages/WebGLRenderer.html) for compilation, lighting and disposal semantics.

## Recruiter-facing navigation and layout

Project summaries use an open layout with readable stage-level contrast. Oversized panel pseudo-elements are removed because they contributed to scrollable overflow even when the actual text fitted. Real overflowing content stays scrollable on small/short viewports, with no decorative card outlines or visible scrollbars. The case-study action is primary, with live deployments and detailed evidence still available. A separate previous/next control names the next project. Numbered rail controls retain accessible names and tooltips without labels overlapping the narrative.

See [UX verification](UX-VERIFICATION.md) for the five-viewport panel audit and input regressions.
