# Contributing & Development Guidelines

Welcome to the development repository for Shaunak Rane's Systems Portfolio & 3D Observatory.

## Local Setup

No external bundlers or compilers are required for baseline development. The project uses standard HTML5, modern Vanilla CSS, and native ES modules.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Shaunakrane914/Portfolio.git
   cd Portfolio
   ```

2. **Serve locally using Python or Node.js:**
   ```bash
   # Using Python:
   python -m http.server 8089

   # Or using Node:
   npx serve . -l 8089
   ```

3. **Open in browser:**
   ```
   http://127.0.0.1:8089/
   ```

## Development Commands & Validation

- **Link & Reference Check:**
  ```bash
  node scripts/validate_links.mjs
  ```
- **Asset Size Verification:**
  ```bash
  node scripts/check_asset_sizes.mjs
  ```
- **Real-time Performance Telemetry:**
  Append `?perf=true` or `#perf` to the local or live URL to enable the on-screen WebGL telemetry HUD showing instantaneous FPS, draw calls, triangles, and active quality tier.

## Code Standards

- **Formatting:** 2-space indentation, UTF-8 encoding, LF line endings (see `.editorconfig`).
- **WebGL & Shaders:** Three.js objects should reuse geometries and materials where possible to keep draw calls under 80 per frame.
- **Commits:** Follow conventional commit conventions (`feat:`, `fix:`, `perf:`, `docs:`, `style:`, `refactor:`, `test:`, `build:`).
