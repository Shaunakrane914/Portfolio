# Systems Portfolio Architecture & 3D Observatory Engine

## Overview

Shaunak Rane's portfolio is built as an interactive 3D WebGL observatory using Three.js, Vanilla CSS, and modular ES6 JavaScript. The application delivers high-performance rendering (60–120 FPS), accessible semantic DOM content overlays, and smooth spring-based camera dynamics across desktop and mobile devices.

```
+--------------------------------------------------------------------+
|                         Browser Viewport                           |
+--------------------------------------------------------------------+
| DOM Overlay Layer:                                                 |
|  - Semantic HTML5 Panels ([data-scene-panel])                     |
|  - Accessibility Announcer, Skip Links & ARIA Roles                |
|  - Real-time Telemetry HUD (URL param ?perf=1)                     |
+--------------------------------------------------------------------+
| WebGL Rendering Pipeline:                                          |
|  - Three.js PerspectiveCamera with 2nd-Order Spring Physics         |
|  - Multi-world Scene Graph (Worlds 0 to 5)                          |
|  - InstancedMesh Optimizations (Blades, Sensors, Pore Networks)    |
|  - Dedicated Asynchronous Shader & Texture Compilation Pipeline    |
|  - Spline Curve Pre-Sampling (Zero-Alloc Packet Paths)             |
|  - Adaptive DPR Quality Scaling (High / Medium / Low)              |
+--------------------------------------------------------------------+
| Edge Delivery & Hosting:                                           |
|  - Custom Domain DNS: shaunakrane.is-a.dev                         |
|  - Cloudflare Pages Edge Network                                   |
|  - Cache-busting Asset Bundles (?v=3.4)                            |
+--------------------------------------------------------------------+
```

## Scene Architecture

| Scene Index | Codename | Project Highlight | 3D Visual Elements & Rendering Primitives |
|---|---|---|---|
| `0` | Origin | Core Portfolio & Identity | Gyroscopic orbital rings, ambient starfield, core energy sphere |
| `1` | Aegis | Agentic AI Multi-Agent Engine | Shield geometry, holographic scanner sweeps, active status nodes, pre-sampled spline packets |
| `2` | Gridium | Microgrid Energy Optimization | Cybernetic isometric grid, energy flux lines, shared node geometries, pool liquid |
| `3` | Compressor CBM | Predictive Machinery Diagnostics | 7-stage dual rotor with 182 instanced blades, 42 instanced sensors, aerodynamic spiral flow |
| `4` | Topoflow | Porous Media Hydrodynamics | Microscale pore network with InstancedMesh pores, centripetal streamlines, tracer spheres |
| `5` | Profile | SDE & Systems Background | Accretion vortex, identity core, terminal diagnostics, shared module geometries |

## Performance Engineering & Rendering Pipeline (v3.4.0)

### 1. Asynchronous Scene Preparation & Shader Precompilation
- **The Cold-Start Bottleneck Identified:** Previously, worlds were built synchronously on first navigation, triggering 20+ synchronous WebGL driver shader compiles on the active render frame and freezing the UI for ~1,228ms.
- **Dedicated Prewarming Scheduler:**
  - Proactive background prewarming commences 250ms after initial page render.
  - Prepares upcoming worlds sequentially in bounded idle slices (`requestIdleCallback` with `setTimeout` fallback).
  - Sequence prioritization: immediately adjacent scenes (`currentScene + 1`, `currentScene - 1`) are prepared first, followed by outward scenes.
  - Reprioritizes dynamically whenever the active scene changes.
- **Exact Lighting Precompilation:**
  - Shaders are compiled using Three.js's async compiler with the exact lighting setup (hemisphere light, directional lights, local scene point lights, and `scene.fog`).
  - Pre-initializes all canvas and texture maps via `renderer.initTexture`, eliminating `texImage2D` stalls during active navigation.

### 2. Geometry & Allocation Optimization
- **`THREE.InstancedMesh` Implementation:**
  - Compressor blades (26 per stage $\times$ 7 stages = 182 meshes) and rotor sensors (6 per stage $\times$ 7 stages = 42 meshes) are rendered as InstancedMeshes.
  - Slashes Scene 3 draw calls from **374 down to 161** (a 57% reduction) while preserving 100% of the mechanical geometry and lighting.
- **Zero-Allocation Spline Traversal:**
  - `getCachedCurvePoint(curve, progress)` pre-samples CatmullRom spline curves into 120 cached points.
  - Replaces repeated runtime `curve.getPointAt(progress)` allocations, eliminating thousands of `THREE.Vector3` garbage-collection allocations per minute.
- **Shared Geometry Re-use:**
  - Nodes, packets, pillars, and gates in Aegis, Gridium, and Profile worlds reuse shared geometry buffers rather than allocating duplicate `BoxGeometry` and `CylinderGeometry` instances.

### 3. Dynamics & Interaction Engine
- **Spring Dynamics:** Camera transitions use 2nd-order damped harmonic oscillator physics:
  - Camera position: `stiffness = 88`, `damping = 14.5`
  - Look-at target: `stiffness = 78`, `damping = 13.5`
  - Critically damped settling in ~260ms without overshoot or wobble across 60Hz, 120Hz, and 144Hz displays.
- **Input Decoupling & Transition Lockout:**
  - `lockSceneTransition(220)`: 220ms lockout window intercepts trackpad inertia without locking out responsive manual gestures.
  - Wheel threshold: 28px accumulation threshold ensures snappy, immediate scene changes.
  - Native content scrolling: Preserves native trackpad/wheel scrolling inside scrollable content panels until bounds are reached.
  - Pointer parallax: Global `pointermove` tracking across the entire window without dead zones.

### 4. Telemetry & Adaptive Quality
- **Unclipped Frame-Delta Tracking:**
  - Separates animation physics delta (`dt` clamped to 34ms for stability) from raw frame time telemetry (`rawFrameDeltaMs`).
  - Measures true hitch durations instead of concealing long frames.
  - `window.__perfTelemetry.getSnapshot()` reports true `avgFrameMs`, `p95FrameMs`, `p99FrameMs`, FPS, draw calls, triangles, and DPR tier.
- **Adaptive DPR:**
  - Caps maximum DPR at 1.15 on desktop and 1.0 on mobile devices.
  - Seamlessly scales between High, Medium (1.05), and Low (0.95) tiers during sustained GPU pressure.

### 5. Case-Study Hero Renderer & ThreeUI Lab
- **Offscreen Animation Gating:** Uses `IntersectionObserver` (threshold: 0.05) to pause WebGL loops and postprocessing composers whenever the hero canvas scrolls out of viewport or the tab is hidden.
- **Optimized HDR Postprocessing:**
  - Half-resolution UnrealBloomPass reduces fill-rate overhead by 75%.
  - `samples: 0` on HDR float render targets strictly avoids multi-sample buffer bloat on mobile and integrated GPUs.
  - Asynchronous shader precompilation on prototype mount.
