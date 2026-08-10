# 12 · Implementation plan

Ordered so the riskiest unknown is answered first and nothing is built on
unverified ground. Each phase states its exit criteria; a phase is not finished
because its code exists.

## Baseline to hold, every phase

| Check     | Baseline     |
| --------- | ------------ |
| Typecheck | 0 errors     |
| Tests     | 339+ passing |
| Lint      | ≤12 warnings |
| Format    | ≤8 files     |

The 12 lint warnings and 8 format failures are pre-existing and untouched. Any
increase is new debt and is called out, not absorbed.

---

## Phase 0 — Audit and decisions · **complete**

Delivered: this document set; `docs/` restructured into canonical / `reference/`
/ `archive/`; the repository's own boundary test restored to green
(`LibraryScreen` was leaking chroma's `round` scale into a screen, breaking Swiss).

**Exit:** ✅ baseline verified green — 339 tests, 0 type errors.

---

## Phase 1 — Domain foundation

No UI. Pure TypeScript and Zod, testable without a simulator.

1. `atmosphere.ts` — `AtmosphereReading`, `readAtmosphere(colors)`, mood table.
2. `intent.ts` — `MusicIntent`, `deriveIntent(atmosphere, visual, preference, seed)`,
   the mood × energy genre table.
3. `music.ts` — `MusicTrackReference`, `MusicPreview`, `MusicRecommendation`,
   `MusicSearchQuery`, `MusicProvider`, `MusicProviderId`.
4. `feedback.ts` — `MusicFeedback`, `accumulatePreference`.
5. `analysis.ts` — `VisualAnalysis`, `ImageUnderstandingProvider`,
   `RecommendationProvider`, `AIAnalysisResult`.
6. `memory.ts` — `ChromaticMemory`, `ChromaticMemoryDraft`,
   `ChromaticMemoryRepository`, `deriveFacets`, `toChromaticMemory`.
7. `ranking.ts` — `rankCandidates(intent, tracks, preference)`.
8. Migration — `paletteToMemory`, `memoryToPalette`, `migratePalettesToMemories`.
9. `StoredMemoryRepository` — per-record `safeParse`, quarantine, `listInvalid`.
10. Projections — `MemoryBackedPaletteRepository`, `MemoryBackedSetRepository`,
    so every `tools/*` screen keeps working unchanged.

**Exit:** all of `09`'s migration tests pass; atmosphere and intent are
unit-tested at their thresholds; ranking is deterministic under a fixed seed;
existing 339 tests still pass; the ten tool screens still compile.

---

## Phase 2 — Core vertical slice · **the phase that matters**

One complete journey, production quality, no secondary screens:

```
import an image → palette → atmosphere → intent → iTunes search
→ authorised preview plays → choose a track → save a ChromaticMemory
→ reopen from Memories → replay it
```

1. `ITunesMusicProvider` — search, normalise, preview resolution, `openExternal`,
   attribution string, market from locale.
2. `NoneMusicProvider` — the honest unconfigured state.
3. `PreviewPlayer` — single-instance, states per `11`, interruption handling.
4. `pairingStore` — draft, stages, partial success, abort.
5. Route `capture/analyse` — staged progress, progressive palette reveal.
6. Route `capture/pair` — candidate cards, player, reasons, store links.
7. `capture/result` — extended to write a memory rather than a palette.
8. `memory/[id]` — detail with the track block and the ribbon playhead.
9. Memories — reads memories; paired mark; **month-signature caching first**.
10. Localization for everything above, EN + VI, exact parity.

**Exit — and this is the phase's whole point:**
run on an iOS simulator or device and observe, in one session: an imported photo
producing a palette, real candidates from a real network call, audio actually
coming out of the speaker, a saved memory, and that memory replaying after a
cold start. Until that has been _seen_, Phase 2 is Implemented, not Verified, and
Phase 3 does not begin.

---

## Phase 3 — UI/UX redesign

Only after the slice is Verified.

1. Onboarding — one screen, ends with the user's own first memory.
2. Capture — chrome reduction, shutter-to-hero continuity.
3. Analysis and pairing — full motion per `11`.
4. Memory detail — integrated layout, ribbon playhead.
5. Memories — filters (mood, colour, energy, genre, paired), search.
6. Today — on this day, unfinished, same light, journey, field note.
7. Collections — consumer container; Working Set mode inside.
8. You — Audio, Privacy, Music provider, Colour tools sections.
9. Tab bar — new keys, playback hairline.
10. **Swiss, designed rather than derived**, for every screen above.

**Exit:** both skins screenshotted on all nine surfaces; Dynamic Type XXL and
long Vietnamese metadata pass; VoiceOver order correct on the pairing card;
Reduce Motion produces static fallbacks and a live playhead.

---

## Phase 4 — Rediscovery and collections

Today's cards backed by real projections; `journey/[seed]` continuous playback;
"same light" using ΔE00 over cached facets (never on a render path); collection
management.

**Exit:** Today is useful with 3 memories and with 500; journey plays through
without overlapping audio.

---

## Phase 5 — Professional tools and monetization

1. The ten `tools/*` screens brought to the new standard.
2. Working Set mode polished inside Collections.
3. **Real billing.** RevenueCat or StoreKit 2 — requires an Expo prebuild, a
   native module, App Store products, and review copy. Until then the paywall
   states honestly that purchasing is unavailable; it does **not** simulate
   success. The current `router.back()` CTA is a placeholder and is treated as a
   bug, not a feature.
4. Premium line, per `02`: the first photograph-to-music experience is never
   paywalled. Candidates — unlimited re-matching, extended candidate sets, high-
   resolution export, advanced collections, Working Sets, premium skins.

**Exit:** a real purchase completes in App Store sandbox and unlocks a real gate.

---

## Deferred, deliberately

| Item                         | Why                                                    |
| ---------------------------- | ------------------------------------------------------ |
| Apple Music adapter          | Needs the token endpoint (`08`) and a MusicKit key     |
| LLM analysis                 | Needs the edge function and a model key                |
| Deezer adapter               | Terms confirmation pending (`07`)                      |
| MusicKit subscriber playback | Native module + prebuild; previews satisfy the product |
| Live read                    | Blocked on RN 0.83 pod compilation; unproven on device |
| Android                      | Out of scope this phase, by instruction                |
| Cloud sync / accounts        | No product reason yet                                  |

Each is a one-file adapter behind an interface that Phase 1 already defines. None
requires reopening the architecture.
