# 00 · Executive summary

**Date:** 2026-08-10 · **Branch:** `chromawave-v1` · **Base:** `chroma-v3`

## The finding in one paragraph

The repository contains an excellent local-first colour instrument and **zero
lines of music or AI code**. Not a stub, not a mock, not a disabled feature — the
only mention of the original concept anywhere in `apps/` or `packages/` is a
comment in `packages/domain/src/entitlements.ts` explaining what was deleted and
calling it "a music-and-memory app this one is no longer related to". Meanwhile
`docs/` still described that music product across twelve files. The code and the
documentation had drifted so far apart that they described two different
companies. This pass restores the music-and-colour vision as the product
direction, and does it by _adding a layer above_ the colour engine rather than
rewriting it.

## What is genuinely good and is being kept

Verified by reading the source, not by trusting the previous review:

| Asset                                       | Evidence                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| OKLab k-means extraction, true area weights | `packages/domain/src/color.ts:133` — linear-light accumulation, weights are cluster share |
| CIEDE2000 (CIE 142-2001), not ΔE76          | `color.ts:470`                                                                            |
| Gamut-mapped OKLCh inverse                  | `color.ts:383` — binary-searches chroma, holds hue. Rare and correct.                     |
| Semantic roles + weight invariant           | `palette.ts:93` — Zod `superRefine` enforces weights sum to 1                             |
| Two-skin architecture with a boundary test  | `__tests__/no-appearance-leaks.test.ts` — source scan, not a render test                  |
| EN/VI parity with expansion budgets         | `localization.test.ts` — 424 keys each side, per-control character budgets                |
| MMKV + Zod persistence, orphan-free photos  | `StoredPaletteRepository.ts`                                                              |

None of this is touched. The colour engine becomes the _input_ to the music
pipeline instead of the product's endpoint.

## The three decisions that shape everything else

**1. Music provider: build against an abstraction, ship a keyless adapter first.**
Spotify removed `preview_url` for applications registered after 2024-11-27, so a
new Spotify app **cannot** play previews at all — the flow this product needs is
not available on the provider most people would assume. Apple Music's catalog API
does return DRM-free preview assets, but its developer token is an ES256 JWT that
must be signed server-side. The iTunes Search API returns the same 30-second
previews with **no authentication and no secret**, which is the only option that
makes a genuinely playable vertical slice possible today with nothing to
provision. See `07-music-provider-feasibility.md`.

**2. AI: deterministic colour science is the engine; the LLM is an optional
narrator.** The mapping from a weighted OKLCh palette to a `MusicIntent`
(valence, energy, warmth, pace, texture, genres) is pure, testable, offline, and
ships with no key. An LLM provider sits behind the same typed interface to add
image captions and per-track explanations _when an endpoint is configured_. This
is not a downgrade — it is the only version that works offline, costs nothing per
capture, is unit-testable, and cannot fabricate a catalogue.

**3. Minimal secure backend, not "no backend".** The previous "no backend, no
account, no telemetry" position is incompatible with LLM analysis and with Apple
Music. It stays true for the free, keyless path. Anything needing a secret goes
behind one small edge function with two routes. See `08-privacy-and-backend-decision.md`.

## What was wrong with the previous review

`docs/archive/25-project-review-and-phase-plan.md` claimed a baseline of "0 type
errors · 339 tests · 11 lint warnings". Verified at HEAD:

- **A test was failing.** `no-appearance-leaks` was red — `LibraryScreen.tsx:1`
  imported chroma's `round` scale and applied `round.full` to the month band, so
  Swiss was rendering chroma's pill geometry on a paper ground. Fixed in this
  pass; 228/228 mobile tests now pass.
- Lint is **12** warnings, not 11.
- Type errors (0) and format failures (8) were accurate.

The review's engineering judgment was sound; its numbers were stale. Its central
recommendation — "verify before building on top" — is adopted.

## Status vocabulary used throughout

- `Implemented` — code exists and compiles.
- `Verified` — observed working in a real runtime (iOS simulator or device).
- `Production-ready` — implemented, verified, tested, failure states handled, and
  provider/legal constraints satisfied.

At the end of Phase 0, **nothing in this redesign is Verified**. The colour
engine that predates it is Production-ready; roughly a dozen screens from the
previous pass remain Implemented-but-unseen, which is this project's largest
standing risk and is unchanged by this document.

## Document map

| File                                   | Answers                                      |
| -------------------------------------- | -------------------------------------------- |
| `01-current-product-audit.md`          | What is actually in the repository           |
| `02-restored-chromawave-vision.md`     | What the product is now                      |
| `03-information-architecture.md`       | Navigation and screen hierarchy              |
| `04-core-user-flows.md`                | The seven flows, including failure paths     |
| `05-domain-model.md`                   | `ChromaticMemory` and supporting entities    |
| `06-ai-recommendation-architecture.md` | Palette → `MusicIntent` → ranked candidates  |
| `07-music-provider-feasibility.md`     | Provider matrix, legal constraints           |
| `08-privacy-and-backend-decision.md`   | What leaves the device, and why              |
| `09-persistence-migration-plan.md`     | v1 palettes → v2 memories, without data loss |
| `10-ui-ux-redesign-spec.md`            | Screen-by-screen, both skins                 |
| `11-motion-and-audio-system.md`        | Motion grammar and the preview player        |
| `12-implementation-plan.md`            | Phases 1–5 with exit criteria                |
| `13-risk-register.md`                  | Ranked risks and mitigations                 |
| `14-verification-matrix.md`            | What must be seen running, on what input     |

`reference/` holds the still-authoritative BUILD KIT and brand-mark documents.
`archive/` holds the superseded v1 docs and the UI-audit cycle notes, with a
README explaining what each was and why it was retired.
