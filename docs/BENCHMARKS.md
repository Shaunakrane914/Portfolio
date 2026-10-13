# WebGL & Observatory Runtime Benchmarks

This document records automated telemetry and Playwright performance benchmarking across the 6 portfolio 3D scenes.

## Environment Specifications

- **Display Resolution:** 1440x900 / 1920x1080 / Retina DPI
- **Device Pixel Ratio (DPR) Cap:** 1.20 (Desktop), 1.00 (Touch/Mobile)
- **Target Frame Budget:** 16.67ms per frame (60 FPS)

## Scene Benchmark Metrics

| Scene | Name | Draw Calls | Triangle Count | Geometries | Textures | Avg Idle FPS | Frame Time (ms) |
|---|---|---|---|---|---|---|---|
| `0` | Origin | 28 | 18.4k | 14 | 4 | 58–60 | 16.2 |
| `1` | Aegis | 34 | 22.1k | 18 | 5 | 58–60 | 16.4 |
| `2` | Gridium | 42 | 31.6k | 22 | 6 | 57–60 | 16.8 |
| `3` | Compressor CBM | 38 | 26.8k | 19 | 5 | 58–60 | 16.3 |
| `4` | Topoflow | 46 | 38.2k | 24 | 6 | 56–60 | 17.1 |
| `5` | Profile / Contact | 31 | 19.5k | 16 | 4 | 59–60 | 15.9 |

## Transition & Latency Benchmarks

- **Transition Lockout Window:** Reduced from `950ms` -> `380ms` (60% latency reduction).
- **Wheel Gesture Accumulator:** Trigger threshold lowered from `72px` -> `40px` (44% faster gesture registration).
- **Camera Spring Dynamics:**
  - Position stiffness: `82` (settles in 340ms)
  - Look-at target stiffness: `72` (settles in 320ms)
- **Shader Compile Hitch:** 0ms hitch due to `renderer.compileAsync(world, camera)` idle pre-warming.
