---
name: chromawave-feature
description: Plan and implement a complete CHROMAWAVE feature across domain, data, UI, motion, accessibility, analytics and tests. Use for new product features and vertical slices.
---

Implement the requested CHROMAWAVE feature as a complete vertical slice.

CHROMAWAVE is a synesthetic memory platform: a user captures a photo, the app extracts
a color palette, classifies its mood, pairs it with music, and stores the result as a
Memory. `Memory` is the central domain aggregate.

## Procedure

1. Inspect relevant existing code and documentation.
   Read `AGENT.md`, the relevant files in `docs/`, and the code the feature touches.
   Do not assume a file, package or service exists — verify it.
2. Restate the acceptance criteria in your own words before writing code.
3. Identify affected domain models and boundaries.
   Which of `Memory`, `MemoryAsset`, `Palette`, `PaletteColor`, `MoodTag`,
   `MusicPairing`, `MusicTrack`, `Collection`, `PublicMemory`, `Entitlement`,
   `ExportJob`, `ShareLink` change? Which provider interfaces are involved?
4. Produce a concise implementation plan: files to create or modify, migrations
   required, provider boundaries touched, tests to add.
5. Implement domain and data logic before presentation integration.
   Domain first (types + Zod schemas + pure logic), then repository/data access,
   then hooks/queries, then screens.
6. Reuse design tokens and existing components. Do not scatter raw colors, spacing
   or radii. Extend the design system when something is genuinely missing.
7. Add purposeful motion. Every animation must have a purpose, trigger, duration,
   easing or spring configuration, reduced-motion behavior, and a performance note.
   Direct interaction feedback completes within ~300 ms; target 60 FPS.
8. Implement loading, empty, failure, offline and permission-denied states.
   Never leave a core screen permanently blocked by a spinner.
9. Add typed analytics where applicable, using the analytics abstraction and the
   typed event map. Never send raw photo content, personal notes or location.
10. Add or update tests: unit tests for domain logic, schema validation tests,
    repository tests, component tests for critical interactions, and a happy-path
    smoke test for new navigation.
11. Run typecheck, lint, tests and format checks, plus relevant platform checks
    (Expo config for mobile changes; inspect the running app for web UI changes).
12. Report files changed, checks run, limitations and remaining risks.

## Constraints

- Strict TypeScript. Do not use `any`.
- Keep domain code independent from React, Expo, Supabase and Spotify.
- Never access external providers directly from screen components — go through the
  provider abstraction and the data layer.
- Never use raw Spotify or Supabase models in the domain layer; map them at the
  infrastructure boundary.
- Keep server state in TanStack Query; do not duplicate it in Zustand.
- Validate all external input with Zod.
- Express database changes as migrations.
- Never expose service-role credentials to a client.
- Palette-derived colors must pass contrast and readability safeguards; never rely
  on color alone to communicate state.
- Entitlement checks go through the centralized entitlement rules, not scattered
  conditionals in screens.
- Keep the repository buildable after every task; do not silently change unrelated
  behavior.

## Never

- Never claim completion when only mock UI exists.
- Never present a placeholder implementation as done. If part of the slice is
  mocked (for example a mock music provider during M1), say so explicitly.
- Never report success without running the available checks.

## Invocation

    $chromawave-feature Implement the Capture → Palette vertical slice
