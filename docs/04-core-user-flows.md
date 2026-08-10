# 04 · Core user flows

Seven flows. Each lists the happy path, then every failure it must survive.
A flow is not designed until its failure paths are designed.

---

## A. First-time onboarding

**Today:** five static slides, camera permission on slide 5, time-to-value ≈ 90s
(`features/onboarding/OnboardingScreen.tsx`). It explains _tuning_ and _sharing_
before the user has anything to tune or share.

**Target: one screen, then the user's own first memory. Time-to-value < 30s.**

```
1. One screen. A bundled photograph, live.
   Colours lift out of it. The bands lean into a waveform. A short preview plays
   — muted until tapped, with one control: "Hear it".
   Copy: "A photograph has a colour. A colour has an atmosphere.
          Chromawave finds the music in it."

2. "Make yours" → contextual permission, asked with the reason visible.
   Photo library is offered first; camera second. Declining either is fine —
   the bundled sample stays available and the flow continues.

3. Their photograph runs the real pipeline. Real palette, real intent,
   real candidates.

4. They pick a track, or skip. Save.
   The first memory is theirs, and it exists before any account, any paywall,
   any preference screen.
```

**Privacy is stated at the moment it becomes true**, not on a slide. When the
optional LLM analysis is enabled, step 3 shows one line before it runs — "A
1024px copy of this photo is sent for analysis. Location is never sent." — with
an off switch. Default is off; the deterministic path needs no upload (`08`).

Music-provider connection is **not** requested during onboarding. The default
adapter needs no auth (`07`).

**Degrades to:** no permissions → bundled sample only, still saves a memory,
prompts again from the empty state. No network → palette-only memory, "add music
later" surfaced in Today.

**Success:** the user has one saved Chromatic Memory before the fifth interaction.

---

## B. Capture

The premise is _capturing an atmosphere_, not sampling a colour chip.

- **Camera** — full-bleed viewfinder, minimal chrome, one shutter. Existing
  `ViewfinderScreen` shutter/haptic/sound path is kept.
- **Import** — photo library, existing `tools/import` picker logic reused.
- **No live palette hints.** `usePhotoRead.ts:9` documents that Vision Camera's
  worklets do not compile against RN 0.83's prebuilt React pods. Until that is
  fixed and _run on a physical device_, the viewfinder makes no live-read claim.
  `PaletteSource = 'live'` stays in the schema but is never written.
- Cancel returns without a pending capture; retry re-enters the viewfinder.
- Permission denial shows recovery copy with a Settings deep link.

**Transition:** the shutter frame does not cut. It becomes the analysis screen's
hero — the same image, same position (`11`).

---

## C. Analysis and pairing

Four named stages, each with real work behind it. No indefinite spinner.

| Stage                     | Work                                   | Typical | Fails to                    |
| ------------------------- | -------------------------------------- | ------- | --------------------------- |
| Reading colour            | Skia downscale + OKLab k-means + ΔE00  | <300ms  | hard stop — retake          |
| Reading atmosphere        | palette → `AtmosphereReading`          | <5ms    | cannot fail (deterministic) |
| ⤷ optional: image caption | LLM vision call, if configured         | 1–4s    | skipped, stage still passes |
| Finding music             | intent → provider search → normalise   | 0.4–2s  | palette-only memory offered |
| Preparing previews        | HEAD/validate preview URLs, warm first | <1s     | card marked "no preview"    |

**Progressive disclosure is mandatory.** The palette appears the instant stage 1
finishes — the user watches colours lift out of their photograph while stages 3
and 4 run. Nothing waits on the network.

**Partial success is the design centre, not an edge case:**

| What failed          | What the user gets                                                     |
| -------------------- | ---------------------------------------------------------------------- |
| LLM caption          | Everything, minus the prose caption. Reasons fall back to computed.    |
| Provider search      | Palette + atmosphere + "Add music later". Memory saves as unpaired.    |
| All previews missing | Cards with metadata and "Open in Apple Music". Selectable, unplayable. |
| Offline entirely     | Straight to result. Save. Today surfaces it for pairing later.         |

Timeouts: 8s image analysis, 6s provider search, 4s preview validation. Each
abortable, each with one retry on a 5xx or network error, none on a 4xx.

---

## D. Recommendation and preview

3–5 candidates. Never an endless list — this is a _choice_, not a catalogue.

Each card carries **only verified provider metadata**: artwork, track, artist,
album, preview availability and length, provider attribution, plus a computed
"Why this matches" line and a match-strength indicator.

```
┌────────────────────────────────────────────┐
│ ▓▓▓▓  Nightswimming                        │
│ ▓▓▓▓  R.E.M. · Automatic for the People    │
│                                            │
│  ▸ Hear it            0:30 preview         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━        │
│  Why this matches                          │
│  Muted blue-violet, low contrast and       │
│  late light suggest something slow and     │
│  unhurried.                                │
│  ⟡ warmth ·  ⟡⟡⟡ calm ·  ⟡⟡ space         │
│                        Preview via Apple ⧉ │
└────────────────────────────────────────────┘
```

**No autoplay on arrival.** The first card shows an explicit "Hear it". Once the
user has played one preview by choice, an "auto-play as I browse" preference
appears and is remembered (`preferences.autoPlayPreviews`, default false). This
is the single most important audio-trust decision in the product.

Actions: play/pause · next/previous candidate · reject (removes and backfills) ·
select · **Search manually** · **Try again** (re-runs with a rotated intent seed)
· **Skip music**.

Rejections are recorded as `MusicFeedback` and bias the next run (`06`).

---

## E. Chromatic Memory detail

One integrated object, not three widgets stacked.

```
full-bleed photograph, scrim at the foot
   the palette ribbon sits ON the photograph's edge — weighted bands,
   true area share, the same ribbon that flew from the card
title · date · optional place
──────────────────────────────────────────
the track:   artwork, name, artist,
             ▸ preview player with progress drawn IN the palette ribbon
──────────────────────────────────────────
"Why this matches"   the stated connection
──────────────────────────────────────────
Atmosphere           warmth · energy · light · stillness
Colour               hex · OKLCh · weight · role · ΔE00 · confidence
                     (collapsed by default; one tap to the full spec)
Note                 the user's own words
──────────────────────────────────────────
Replace track · Add to collection · Share · Delete
```

The palette ribbon doubling as the playback progress bar is the product's
signature gesture: colour _is_ the timeline. Reduce Motion keeps the ribbon and
draws a static playhead.

**Unpaired memory:** the track block becomes a single "Find music for this
moment" action. It is the same pairing screen, seeded from the stored palette
and atmosphere — no re-analysis of the photograph needed.

**Stale track:** if the stored track no longer resolves, the block shows the
saved metadata (which we own, offline) marked _unavailable_, with "Find a
replacement". Saved metadata is never deleted because the catalogue changed.

---

## F. Memories (library)

Month-banded archive, kept — it is good, and the band colour is the month's
merged system.

Adds: search · filter by mood, dominant colour, energy, genre, paired/unpaired ·
recently played · favourites · legacy colour-only items.

**Performance is a precondition, not a follow-up.** `01 §13` measured ~10⁶ ΔE00
calls per recompute on a 500-memory library, on every keystroke. Filters
multiply that. The fix ships _before_ the filters:

1. `MonthSignature` cached by `(monthKey, memberIds hash)` and recomputed only
   when membership changes — the same treatment `PaletteSet.merged` already gets.
2. Filtering operates on precomputed scalar facets stored on the memory
   (`dominantHue`, `energy`, `warmth`, `paired`), never on colour comparison.
3. Search debounced (`useDebounced` exists), grouping memoised on the _filtered
   id list_, not the object array.

---

## G. Rediscovery (Today)

The return loop. Value first, engagement second — no streaks, no badges, no
manufactured urgency, no daily nag beyond the one opt-in reminder that already
exists.

- **On this day** — memories from this date in past years.
- **Unfinished** — memories with no track yet. One tap to pair.
- **Same light** — memories whose palettes sit within ΔE00 of today's most
  recent, or of a chosen one.
- **A journey** — 5–8 memories sequenced by musical energy, played as a
  continuous colour-and-sound run. `journey/[seed]`.
- **Field note** — the existing weekly drop, unchanged.

Each is a card that can be absent. An empty Today shows the capture invitation,
not a placeholder grid.

---

## H. Working Sets

Reached from a Collection's overflow ("Colour system") and from You.

Unchanged capability: merged system, gap analysis, ΔE00 compare matrix, export.
It now operates over the palettes _of memories_ rather than over standalone
palettes — the same records, reached through the new aggregate. `mergePalettes`,
`paletteGaps` and every `tools/*` screen keep their current inputs (`09`).
