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

## Phase 2 — Core vertical slice · **in progress**

**Verified on an iPhone 16 Plus simulator, 2026-08-11.** Screenshots in
`docs/evidence/ios-v2-*.png`.

- `migrateToMemories` ran against **real pre-existing v1 data** on the device:
  the library went from "0 palettes" to "4 palettes · 2 collections", photos and
  month signatures intact, served through `MemoryBackedPaletteRepository`.
- `chromawave://pair` ran the whole pipeline live — palette → atmosphere →
  intent → iTunes → ranked cards with real artwork, per-track reasons, "Hear it"
  (no autoplay), and the store link every card must carry.

Three defects were found only by running it, and all three are fixed:

1. `migrateMemories()` was written and tested but **never called** — the launch
   path in `PreferencesProvider` invoked only the MMKV migration.
2. `scripts/run-ios.sh` invoked whatever `expo` was on `PATH`, which a globally
   installed legacy `expo-cli` shadows. It built the app, then failed on
   "Missing package metro" _after_ the build, so the simulator kept running a
   stale binary and reported phantom "Cannot find native module" errors.
3. Every card printed the same "Why this matches" sentence, because the copy was
   derived from the palette alone. It now leads with the candidate's own genre.

**Audio is Verified.** A device probe resolved a real preview and played it end
to end:

```
[audio-probe] intent shoegaze/indie folk/chamber pop pace=medium
[audio-probe] candidates 14
[audio-probe] preview resolved for Cherry-Coloured Funk     ← Cocteau Twins
[audio-probe] loading → loading → loading
[audio-probe] playing 118ms / 29929ms
[audio-probe] playing 12535ms / 29929ms
[audio-probe] playing 29668ms / 29929ms
[audio-probe] idle                                          ← stops, does not loop
```

The duration is the decisive detail: **29 929 ms is the asset's own duration**,
not the 30 000 ms fallback the provider guesses, so AVFoundation genuinely opened
and decoded the stream. Position advances in real time, and the clip ends at
`idle` rather than repeating. The player's unit tests use a fake `expo-audio` and
could only ever prove the state machine; this proves the native path.

What remains unproven is a human _hearing_ it — simulator audio routing is not
something a log can attest to. That is a headphones check, not an engineering
one.

The probe was a temporary route and has been deleted.

**The loop closes.** Choosing a track now writes it onto the memory, and the
memory survives a cold start:

```
[pair-probe] memory a0000000-…-0001 "Harbour dusk"
[pair-probe] before: status=unpaired  paired=false
[pair-probe] pipeline error=null recs=5
[pair-probe] saved "Tour de France, Étape 3" — Kraftwerk
[pair-probe] after:  status=paired  paired=true  genres=Electronic
```

The app was then terminated and cold-launched, and the palette detail rendered
the track from disk — artwork, preview control, replace action, store link
(`docs/evidence/ios-v2-memory-paired-cold-start.png`). The `facets.paired` and
`facets.genres` denormalisations moved with the write, which is what keeps the
archive's filtering honest.

**A note on how this was verified.** UI automation was abandoned after
`cliclick` was found to clamp negative Y coordinates — the Simulator sat on a
display above the main one, so every synthetic tap landed somewhere else
entirely and two of them backgrounded the app. Moving the window to positive
coordinates fixed reachability but not the bezel offset, and `screencapture` is
blocked without Screen Recording permission. The device checks above therefore
drive the **real code paths programmatically** and verify the result by cold
start and screenshot. What that leaves unverified is the literal `onPress`
wiring of two buttons; the logic behind them is covered by
`useChromaticMemory.test.ts`.

**Capture reaches the music.** A fresh capture already becomes a memory —
`MemoryBackedPaletteRepository` widens any palette the memory store has not seen
— so the only gap was that nothing offered pairing afterwards. `ResultRoute` now
lands on the pairing screen instead of the palette detail (captures scoped to a
Working Set still return to the set, which is deliberate). Verified on device:

```
[capture-probe] before: 4 memories
[capture-probe] saved as memory schemaVersion=2
[capture-probe] atmosphere mood=serene lum=0.838 warm=0.668
[capture-probe] pairing status=unpaired paired=false
[capture-probe] facets month=2026-08 dominant=#F6E7CF
[capture-probe] after: 5 memories
```

Pairing that warm capture returned ambient and new age, against the shoegaze and
krautrock the dark palettes returned — the mapping does real work
(`docs/evidence/ios-v2-pairing-warm-palette.png`). It also surfaced a layout
defect: catalogue album names run very long, and one wrapped to four lines and
pushed the play control down the card. Album metadata is now capped to one line.

## Phase 2 — remaining

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
