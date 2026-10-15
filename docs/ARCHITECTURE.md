# Portfolio runtime architecture (v4.6)

The portfolio is a static HTML site with an editorial layout, native document scrolling and visible Three.js models. Four featured projects connect concise summaries to implementation evidence and case studies. Project claims, evidence and resume content are retained.

## Input and scene state

Six normal-flow sections have a `100svh` minimum height and expand with their content. Narrative remains normal HTML; the introduction and four featured projects reserve empty, transparent `.model-view` regions for WebGL. The shared canvas stays fixed and rasterizes into the selected region as it moves through the viewport. Panels have no independent scrollers, hidden content or inert state. There is no scroll snap. Touch panning, keyboard reading and scrollbars remain native. Vertical wheel input normally keeps its browser default action; a nonpassive guard intercepts only an event that would exceed its gesture range or a quick deliberate reversal.

`ChapterWheelGuard` records the adjacent chapter limits at the beginning of each wheel burst. It tracks the expected scroll target, including wheel animation still in flight, so a strong swipe cannot chain through several chapters. A 160ms gap, significant reversal or two renewed rises after a decayed tail begins fresh intent. Small in-range deltas move immediately; there is no model-animation lock or minimum-travel threshold. Chapter offsets are cached by a ResizeObserver. A scroll-time clamp runs before semantic scene selection to cover compositor overshoot and uncancelable events. Explicit navigation, pointer/touch starts, keyboard input, resize and dialog changes reset ownership. The final chapter can scroll to the full document end.

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

The fixed canvas is decorative, with `pointer-events: none`; it never captures dragging or wheel input. Cached region dimensions determine the camera aspect and render viewport; a scissor rectangle clips drawing to the visible region below the header and above mobile navigation. Text and models occupy separate areas. No screenshot panel or browser frame sits over the geometry.

Each world caches local bounding-box corners when built, including bounds for instanced meshes. Camera fitting projects those corners against the selected view direction and available aspect ratio, leaving a framing margin. The fit is reused until viewport dimensions change. Homepage exposure is 1.2 and fog density is 0.012; TopoFlow's material is brighter. Origin and TopoFlow use gentle bounded oscillation. Reduced motion stops continuous animation while preserving a visible static model.

Animation delta is clamped for numerical stability; telemetry records raw frame intervals, including stalls longer than 800ms. The homepage exposes `window.__perfTelemetry.getSnapshot()` and the `?perf` HUD. Heroes expose `window.__heroTelemetry()`, including readiness, render count and running state. Desktop DPR is capped at 1.15, touch DPR at 1.0; sustained slow frames reduce resolution toward 0.65. Homepage recovery requires a longer stable fast period to avoid rapid quality oscillation.

## Content and delivery

Case-study desktop heroes reserve the right side for art and constrain metrics and direct CTAs to the left 44% text lane. Metrics have no panel background, blur or divider borders; the art shade and decorative left border are removed. Mobile heroes reserve a separate 250px art region above normal-flow content. Both case renderers fit the model on resize, including portrait/desktop changes. Food and Sodexo no longer draw their three illustrative UI screens. Report evidence images remain in their ordinary content sections.

Copy is visible immediately; only graphics fade in after readiness. Local OFL-licensed WOFF2 fonts remove third-party font CSS from the critical path. Evidence images have intrinsic dimensions, lazy loading and asynchronous decoding.

See [BENCHMARKS.md](BENCHMARKS.md) for measured results, limitations, raw evidence and reproduction commands. Async shader compilation reduces rendering stalls; it cannot guarantee that a browser driver never blocks the main thread. See the [Three.js renderer contract](https://threejs.org/docs/pages/WebGLRenderer.html) for compilation, lighting and disposal semantics.

## Recruiter-facing navigation and layout

`css/editorial.css` owns the identity, model regions and contact presentation above the base observatory styles. The opening pairs a large serif headline with the full name in the header and eyebrow, a clear engineering role and a full-width four-project index. A thin 2px reading-progress bar follows document progress without accepting input.

Each featured chapter has a short lead and a clear model region. The earlier four image-preview figures are removed. Original technical descriptions remain visible in `.project-implementation` paragraphs, alongside existing metrics, evidence, case-study and live links.

Desktop places narrative and model beside one another. On mobile, `.scene-copy` uses `display: contents` for the featured chapters so `.project-intro`, the model region and `.project-details` follow the title/summary, model, then metrics/links reading order. Content grows naturally with the document; it has no panel-local scrolling or hidden sections. The case-study action is primary, and rail controls keep accessible names and tooltips.

The profile combines the internship timeline with three engineering-practice groups. The contact ending exposes the real email address, resume, GitHub and LinkedIn. Copy email reports success through a status element; clipboard rejection or an unavailable API focuses the existing email link and presents a useful fallback.

See [model-visibility verification](MODEL-VISIBILITY-VERIFICATION.md) for current status and design rationale. The report records current browser, layout, case and scrolling results. The archived [v4.3 editorial report](EDITORIAL-DESIGN-VERIFICATION.md), [v4.2 native-scroll report](NATIVE-SCROLL-VERIFICATION.md) and [v4.1 UX report](UX-VERIFICATION.md) describe earlier presentations and experiments. Their measurements do not establish current frame rates.
