# 01 — Product specification

**Scope:** the seven capabilities in the brief, scoped to what this codebase and
its providers can honestly deliver.
**Companion:** `00-repository-audit.md` records what was verified; this records
what gets built on top of it.

---

## 1. The product claim, unchanged

Chromawave's claim is that **a photograph's own colour tells you something**, and
that colour, sound, emotion and memory belong together. The existing loop —
Capture → Extract Colour → Pair Music → Create Memory → Collect → Discover —
stays exactly as it is.

The creative platform extends it with a second loop:

**Compose → Animate → Export → Publish → Remix → Revisit**

Two of those six are honestly reachable today. **Compose** and **Export** ship in
Phase 1. **Animate** has a working deterministic foundation
(`domain/livingMemory.ts`). **Publish** and **Remix** have no backend and no
identity (audit §9), so they become local-only. **Revisit** already exists as
Rewind and Color DNA.

This is not a shortfall to hide. It is the difference between the six the brief
names and the six the app can currently mean.

---

## 2. What each capability is, and what it is not

### 1 · Chroma Story Studio — **Phase 1, shipping**

A mobile-first visual editor over **one logical canvas** spanning up to twenty
slides. Photo, text and palette-strip elements; move, resize, crop; undo/redo;
crash-safe autosave; pixel-exact carousel export.

_Not:_ templates, drawing, shapes, gradients, frames, textures, stickers,
snapping or a layer panel. Those are Phases 2 and 4.

### 2 · Chroma Cutout — **Phase 3, blocked on decision D4**

Subject extraction behind a provider-independent interface, with a deterministic
development fallback and an explicit product limitation until a real
implementation exists.

_Not:_ a fake. The audit found no segmentation capability of any kind in the repo
(§7). Nothing will claim to have lifted a subject that has not been lifted.

### 3 · Beat-Synced Memory — **Phase 4, scoped by decision D1**

A visual sequence paced by the memory's own colour-derived signals —
`facets.energy`, `warmth`, `luminosity`, `mood`, plus the track's `genres` and
`releaseYear`.

_Not:_ beat detection. No provider exposes tempo, valence or danceability, and
nothing in the app decodes audio samples (audit §6). A "waveform" element, if it
ever ships, is labelled a decorative palette-derived figure. The capability
ladder in the brief is right; the reachable rungs today are **metadata only** and
**external link**, with **legal preview** available for playback but not analysis.

### 4 · Living Palette — **Phase 3, ~40% exists**

`domain/livingMemory.ts` already builds a deterministic storyboard from
atmosphere; `features/living/LivingStage.tsx` renders it with Skia + Reanimated.
What is missing: the four intensity presets (Calm / Flow / Pulse / Rush), user
controls, a reduced-motion path, and integration into a composition.

_Not:_ random motion. Presets are deterministic so an export is reproducible —
the same document must always produce the same frames.

### 5 · AI Story Director — **Phase 5**

A **validated patch against an already-constructed local baseline**, never a
document from scratch and never anything executable. The deterministic local
composer is not a stopgap: it is the baseline the AI patches, and it must exist
and be good on its own first.

The pattern to copy already exists in `domain/analysis.ts` —
`acceptRefinedIntent` (all-or-nothing validation with a local fallback) and
`retainKnownExplanations` (a model cannot introduce an id the pipeline never
offered — a property of the types, not a promise in a prompt).

_Not:_ branded placeholder logic. If no provider exists, the feature is the local
composer and is called that.

### 6 · Remixable Memories — **Phase 6, scoped by decision D5**

A remix recipe schema, local/private remixing, and an attribution chain.

_Not:_ a community. There is no backend, no auth, no identity. Trending Remixes
and Rising Creators cannot be built truthfully, and this codebase has **already
deleted one attempt** at simulated social proof — `trendingRepository.ts:24-31`
records that a `saves` count was removed as "fabricated social proof for a feed
with no users behind it". The required API is documented in `06`; nothing ships
that implies an audience which does not exist.

### 7 · Color DNA — **Phase 7, ~60% exists**

`domain/styleDna.ts` (recency-weighted, 90-day half-life, derived-never-stored)
and `domain/rewind.ts` (smart collections, month/year recaps) are built and wired
into `RewindScreen`. What is missing: the shareable recap story, explanation
copy, opt-out and deletion UI, and consolidating the two parallel `TasteEntry`
implementations (audit §5).

_Not:_ seasons or location. Seasons are not derivable — December is summer in
half the world and the app knows location only as free text someone typed — and
photo location is disabled by design (`isAccessMediaLocationEnabled: false`).
Decision D6 is open; the recommendation is to drop both from scope.

### Cross-Format Composer — **Phase 2**

Focal points and layout constraints, not centre-cropping. 4:5, 1:1 and 9:16 in
Phase 1; a TikTok **safe-zone profile** over the existing 1080×1920 (its action
rail eats ~240px that Instagram's does not) rather than a fourth canvas size.

---

## 3. Principles this specification is bound by

These come from the existing source, not from the brief, and they override the
brief where they conflict.

**Never cite a number we did not measure.** `music.ts` omits `tempo` from its
reason kinds because "citing a number we did not measure would be the exact
dishonesty this product is built to avoid." Every feature here inherits that.

**The paid line is systems work, not quantity.** `entitlements.ts` records that a
10-palette cap was deliberately abolished: "a colour app whose answer to 'I used
this a lot' is 'stop' has mistaken its core loop for a cost centre." Decision D3
applies this to stories: **unlimited projects, free**.

**Two skins, one component set.** Swiss has no glass, no depth and no radii. Any
surface that cannot be expressed in Swiss is not a Chromawave surface. The editor
is designed Swiss-first and chroma adds depth — which happens to produce the
uncluttered editor the brief asks for.

**A control without an action is a defect.** Enforced by
`no-dead-controls.test.ts`. It is why Phase 1 offers three element kinds rather
than thirteen greyed-out ones, and why only the seven analytics events that
actually fire are defined.

**One corrupt record must never cost the collection.** Learned expensively in the
v1 palette repository; applied to projects from the start.

---

## 4. Monetization

Reuses the existing `Entitlement` union and paywall. **No second system.**

**Free:** unlimited projects and drafts, the core editor, blank projects, standard
export, private remix, basic Color DNA.

**Pro:** the full template library (with one free per family, mirroring
`looks.ts`), AI Story Director, advanced Living Palette, advanced Cutout effects,
high-resolution export, cross-format adaptation, the yearly recap.

At most one or two new `Entitlement` members. **Nothing is gated in Phase 1** —
gating the first slice would put a paywall in front of the core value before
anyone has experienced it.

**There is no billing provider** (audit §13). Gates can be defined and enforced;
nothing can be purchased. Conversion is out of scope.

---

## 5. Accessibility and performance, as release requirements

Minimum 48×48 targets; labels and roles on every control; screen-reader
announcements for selection, deletion, undo and export; non-colour-only selection
indicators; reduced motion that produces a complete static composition rather
than removing content; `en`/`vi` in lockstep within the enforced character
budgets (Vietnamese runs ~25–30% longer).

Performance is a release requirement, not a polish pass: no gesture frame through
React state, optimised editing previews with full-resolution originals kept for
export, never twenty masters decoded at once, bounded undo, deterministic
exports, and measurement on physical devices rather than simulators.

---

## 6. Phase order

Follows the brief with two evidence-driven swaps (audit §18):

1. **Story Studio vertical slice** — the critical path; features 4, 5 and the
   Composer all compose _into_ it.
2. **Precision editing + Cross-Format Composer.**
3. **Living Palette before Chroma Cutout** — Living Palette is unblocked and has a
   foundation; Cutout needs D4 and possibly native code.
4. **Beat-Synced Memory**, on the honestly reachable rungs.
5. **AI Story Director**, as a patch over the local composer.
6. **Color DNA before Remixable Memories** — Color DNA is ~60% built and needs no
   backend; remix needs one that does not exist.
7. **Remixable Memories**, local-only until a backend decision is made.

Templates are cross-cutting and land with Phases 2–4 as the schema stabilises.
