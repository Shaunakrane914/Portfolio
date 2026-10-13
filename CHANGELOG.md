# Changelog

All notable changes to Shaunak Rane's Systems Portfolio will be documented in this file.

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
