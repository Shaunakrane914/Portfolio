# Systems Portfolio Architecture & 3D Observatory Engine

## Overview

Shaunak Rane's portfolio is built as an interactive 3D WebGL observatory using Three.js, Vanilla CSS, and modular ES6 JavaScript. The application delivers responsive 60fps rendering, accessible DOM content overlays, and smooth spring-based camera dynamics across desktop and mobile devices.

```
+--------------------------------------------------------------------+
|                         Browser Viewport                           |
+--------------------------------------------------------------------+
| DOM Overlay Layer:                                                 |
|  - Semantic HTML5 Panels ([data-scene-panel])                     |
|  - Accessibility Announcer, Skip Links & ARIA Roles                |
|  - Telemetry HUD (URL param ?perf=true)                            |
+--------------------------------------------------------------------+
| WebGL Rendering Pipeline:                                          |
|  - Three.js PerspectiveCamera with Spring Physics                  |
|  - Multi-world Scene Graph (Worlds 0 to 5)                          |
|  - Procedural Shaders (Curl Noise, Flow Veins, Holographic Fresnel)|
|  - Adaptive DPR Quality Scaling (High / Medium / Low)              |
+--------------------------------------------------------------------+
| Edge Delivery & Hosting:                                           |
|  - Custom Domain DNS: shaunakrane.is-a.dev                         |
|  - Cloudflare Pages Edge Network                                   |
|  - Cache-busting Asset Bundles (?v=3.2)                            |
+--------------------------------------------------------------------+
```

## Scene Architecture

| Scene Index | Codename | Project Highlight | 3D Visual Elements |
|---|---|---|---|
| `0` | Origin | Core Portfolio & Identity | Dynamic gyroscopic orbital rings, particle dust, core energy sphere |
| `1` | Aegis | Agentic AI Multi-Agent Engine | Shield geometry, holographic scanner sweeps, active status nodes |
| `2` | Gridium | Microgrid Energy Optimization | Cybernetic isometric grid, energy flux lines, power distribution cells |
| `3` | Compressor CBM | Predictive Machinery Diagnostics | Neural waterfall topology, spectrogram bars, frequency harmonics |
| `4` | Topoflow | Porous Media Hydrodynamics | Microscale pore network, streamlines, velocity flow gradients |
| `5` | Profile | SDE & Systems Background | Accretion vortex, identity core, terminal diagnostics |

## Dynamics & Interaction Engine

1. **Spring Dynamics**: Camera transitions use 2nd-order damped harmonic oscillator physics:
   - Camera position: `stiffness = 82`, `damping = 13.8`
   - Look-at target: `stiffness = 72`, `damping = 12.8`
   - Settling duration: ~350ms with 0 overshoot wobble.

2. **Input Decoupling & Transition Lockout**:
   - `lockSceneTransition(380)`: 380ms lockout prevents trackpad momentum inertia from skipping scenes.
   - Wheel threshold: 40px accumulation threshold ensures instantaneous gesture response.

3. **Adaptive DPR Scaling**:
   - Automatic frame budget tracking over 60-frame rolling window.
   - Caps DPR at 1.2 on desktop and 1.0 on mobile to prevent GPU fill-rate throttling.
   - Shifts between High (1.2), Medium (1.05), and Low (0.95) tiers if frame drops occur.
