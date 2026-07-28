---
name: chromawave-ui-audit
description: Audit implemented CHROMAWAVE screens for visual quality, hierarchy, layout, motion, accessibility and brand distinctiveness. Use after UI implementation or redesign.
---

Audit the implemented UI using the running application, not only source files.

Launch the target app (Expo for mobile, the dev server for web) and inspect real
screens with real content. Use available browser or design MCP tools where
applicable — for web, drive the running app with Playwright and capture screenshots.
If you cannot run the app, say so and mark the audit as source-only.

## Inspect

- **Visual hierarchy** — is the primary action on each screen obvious in under a second?
- **Layout and spacing** — consistent rhythm, alignment, safe areas, no cramped or
  orphaned elements.
- **Typography** — scale, weight contrast, line length, Dynamic Type behavior.
- **Palette-derived color safety** — user palette colors influence the UI contextually
  but must not destroy readability, contrast, brand consistency or navigation
  recognition. Test with a deliberately hostile palette (very light, very dark,
  low saturation, near-monochrome).
- **Component consistency** — corner radii, elevation, borders, states reused from
  the design system rather than reinvented per screen.
- **Motion purpose and smoothness** — each animation has a reason, respects Reduce
  Motion, does not block interaction, holds frame rate.
- **Loading, empty, error, offline and permission-denied states** — present, designed,
  and reachable.
- **Accessibility** — contrast, screen reader labels, focus order, touch target
  sizes, color-blind-safe states, non-color indicators for selection and errors,
  accessible audio controls, clear permission explanations. Target WCAG 2.1 AA.
- **Responsive behavior** — small phones, large phones, tablets, web breakpoints.
- **Generic or template-like presentation** — flag generic glassmorphism, excessive
  bordered cards, random gradients, heavy shadows on everything, template dashboards,
  generic purple AI-app styling, neon cyberpunk clichés, overcrowded screens.
  CHROMAWAVE should be recognizable from a single screenshot.
- **Performance risks** — full-screen animated gradients, excessive blur, overdraw,
  oversized images, layout thrashing.

## Produce

1. Findings ordered by severity (blocker / high / medium / polish).
2. Exact files and components involved, with line references.
3. Concrete remediation for each finding — the specific change, not a vague direction.
4. A prioritized implementation checklist.

## Never

- Do not praise the UI without evidence. Every positive claim needs a screenshot,
  a measurement or a file reference.
- Do not recommend a superficial color-only redesign. If the problem is hierarchy,
  spacing or motion, say that.
- Do not propose replacing an intentional layout with a generic bordered-card
  dashboard.
