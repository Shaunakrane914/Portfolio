# Project navigation and layout verification

The v4.1 follow-up fixes the Aegis scrolling trap reported after the initial rendering overhaul. An oversized panel backdrop created horizontal and vertical scrollable overflow even when the text fitted. Input handling then gave that panel ownership of every vertical gesture, including fresh gestures pointing out of its boundaries.

Panels now scroll only when their content needs it. A fresh wheel gesture or touch swipe at a content edge navigates to the adjacent scene. A gesture that starts as native reading keeps ownership through its momentum, and a navigation gesture cannot scroll the newly selected panel mid-burst. Buttons and keyboard navigation remain independent. Keyboard navigation moves focus to the selected heading so the case-study action is next in the tab order.

The narrative uses a stage-level gradient, open metric readouts and no decorative panel outlines or visible scrollbar tracks. Case studies are the primary action. Previous/next controls name the next destination. On compact desktops, numbered rail controls retain accessible names without overlapping the text.

## Browser checks

The final [interaction results](benchmarks/2026-10-14/ux/interactions.json) contain 44 passing groups and no page errors. Added regressions cover wheel input directly over the Aegis text, fresh gestures at both panel edges, momentum retargeting into the next panel, touch edge handoff, visible previous/next controls, keyboard focus and navigation after WebGL context loss. Existing checks still cover inertia, history, dialogs, case-study return links, graphics lifecycle and GPU resource stability. Unit checks also cover directional scroll capacity and subpixel input rearming.

The [before layout capture](benchmarks/2026-10-14/ux/layout-before.json) and [final layout capture](benchmarks/2026-10-14/ux/layout-after.json) inspect all six scenes at five viewport sizes. The final 30 captures have no panel or document horizontal overflow, no panel border and no visible panel scrollbar. Vertical overflow below means real content needs native reading scroll; fresh outward gestures at its edges still navigate.

| Viewport | Final panels requiring vertical scrolling |
|---|---|
| 1440 × 900 | None |
| 1280 × 720 | None |
| 1024 × 600 | Profile |
| 390 × 844 | Aegis, Gridium, Profile |
| 844 × 390 | All six scenes |

Selected screenshots were inspected for text, actions, controls and artwork:

- Aegis desktop: [before](benchmarks/2026-10-14/ux/aegis-desktop-before.png), [after](benchmarks/2026-10-14/ux/aegis-desktop-after.png).
- Aegis [compact desktop](benchmarks/2026-10-14/ux/aegis-compact-after.png), [mobile](benchmarks/2026-10-14/ux/aegis-mobile-after.png) and [landscape](benchmarks/2026-10-14/ux/aegis-landscape-after.png).

These are Chrome browser checks on the local Windows workstation, including emulated touch. Physical trackpads and real iOS/Android devices remain unverified. This follow-up does not introduce a new performance benchmark; the original rendering measurements and their limits remain in [BENCHMARKS.md](BENCHMARKS.md).

## Reproduction

From the repository root:

```powershell
node scripts/test_wheel_gesture.mjs
node scripts/overhaul_interactions.mjs
node scripts/validate_links.mjs
```

The interaction suite starts its own local server. The layout audit expects a preview at `http://127.0.0.1:8089/` (override with `PREVIEW_URL`). Start that preview in another terminal, then capture:

```powershell
python -m http.server 8089 --bind 127.0.0.1
```

```powershell
node scripts/audit_scene_layout.mjs after
```

Artifacts are written to `.audit/overhaul/interactions.json` and `.audit/ux-polish/after/`. The layout audit uses the installed Playwright loader and defaults to the local Chrome executable; set `CHROME_PATH` when needed.
