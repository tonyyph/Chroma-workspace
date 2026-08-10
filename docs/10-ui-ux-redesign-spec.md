# 10 · UI/UX redesign spec

## The visual thesis

The interface has one job: make the transformation legible.

```
photograph  →  colour  →  atmosphere  →  music
```

Every screen shows some adjacent pair of those four things in the same frame,
touching. Not a photo card above a palette card above a track card — that is a
dashboard, and a dashboard is the failure mode this spec exists to prevent.

**The signature form is the weighted palette ribbon.** It already exists
(`features/library/PaletteRibbon.tsx`), it already carries true area weights, and
it is the one element in the product that can legitimately be four things at
once:

| Context       | The ribbon is…                       |
| ------------- | ------------------------------------ |
| Memories card | the palette                          |
| Analysis      | colour lifting out of the photograph |
| Memory detail | the photograph's edge                |
| **Playing**   | **the playback progress bar**        |
| Journey       | the timeline across several memories |

Colour _is_ the timeline. That is the product's gesture, and it is unavailable to
anyone who did not compute real area weights.

## Anti-patterns, explicitly

Not a card dashboard · not a Spotify clone (no persistent bottom bar, no
green-on-black, no infinite lists) · not a photo gallery (no uniform grid) · not
neon cyberpunk · not glassmorphism-as-a-look (chroma's glass is a _material_
already defined in tokens, used sparingly) · not disconnected gradients · not
clinical.

## Design-system extensions

`packages/design-tokens/src/skins.ts` gains semantic roles for music. Screens
consume intent; the existing `no-appearance-leaks` test extends to cover these.

```ts
type SkinMusic = {
  /** The player's own ground, distinct from a card. */
  playerSurface: string;
  /** Progress drawn over the ribbon. */
  progressFill: string;
  progressTrack: string;
  /** The candidate currently selected or playing. */
  activeTrack: string;
  /** 1st / 2nd / 3rd recommendation emphasis. */
  rank: readonly [string, string, string];
  /** Over album art, so metadata reads on arbitrary artwork. */
  artworkScrim: GradientRole;
  /** Track name / artist / album / duration. */
  metaPrimary: string;
  metaSecondary: string;
  /** The brand waveform motif. */
  waveFore: string;
  waveBack: string;
  /** Buffering and audio-loading. */
  audioLoading: string;
  /** Match strength: weak → strong. */
  matchStrength: readonly [string, string, string];
  /** The "why this matches" block — quieter than body, not a caption. */
  reasonText: string;
  reasonSurface: string;
  /** Paired vs unpaired memory state. */
  pairedMark: string;
  unpairedMark: string;
};
```

**No feature screen writes a colour.** `matchStrength[2]` in chroma is a warm
violet; in Swiss it is the signal red at 100% — the same _meaning_, resolved by
the skin.

## Chroma — cinematic

The expressive default. An instrument in a dark room.

- **Photography is lit, not framed.** Full-bleed with an ambient field that has
  taken the photograph's own colour (`useChromaticSurface` already does this).
- Colour emerges _from_ the image: the ribbon rises out of the photograph's foot
  on a shared-element transition, it does not appear beside it.
- Album art sits in a chromatic field derived from the memory's palette, so
  arbitrary artwork is held by the moment's colour rather than clashing with it.
- Depth via the existing `elevation` and `glass` tokens. The player is the
  highest surface on its screen and the only one that blurs.
- Playback motion is **slow** — the ambient field's drift rate follows track
  energy, bounded to ±20% of its resting rate. Perceptible over ten seconds,
  never over one.
- Type: Space Grotesk display, IBM Plex Mono for every measured value (hex,
  ΔE00, OKLCh, durations). Already the type system; extended to durations.

## Swiss — editorial

Not chroma with effects off. A different premise: a printed record sleeve note.

- Paper ground, ink, one signal red. Already defined (`skins.ts:196`).
- **The photograph is a plate**, set in a grid with a rule above and a caption
  below in mono. It does not bleed; it has margins, and the margins are the
  design.
- The palette ribbon is a **specimen strip** — square ends (`round.full` → 0),
  hairline separators, each band labelled with its share as a percentage. It is a
  measurement, not a decoration.
- The track is presented as a **record note**: rule, then artist in caps, title
  in the display face, album and year in mono, right-aligned duration.
- Progress is a **filled rule**, not a rounded bar. It sits under the specimen
  strip rather than inside it, because Swiss does not overlay.
- No ambient field (`chrome.backdrop: false`, already). Structure comes from
  rules and labels.
- "Why this matches" is set as a **pull quote** with a hanging indent — the one
  place Swiss allows itself a voice.

The test that Swiss is not chroma-with-effects-off: a Swiss screenshot and a
chroma screenshot of the same memory should differ in _layout_, not only in
palette. If they only differ in colour, the Swiss design has failed.

## Screens

### Onboarding — one screen, then the real thing

Replaces five slides. A bundled photograph; colours lift; bands lean into a
waveform; one control, "Hear it". Then "Make yours" → contextual permission →
their own capture running the real pipeline.

`OnboardingScreen.tsx` (423 LOC, five sub-components) is replaced, not edited.
The permission handling and `completeOnboarding` failure path are kept — they are
correct and already handle a denied write.

### Capture

Existing `ViewfinderScreen` largely survives: full-bleed viewfinder, single
shutter, existing haptic + sound cues, import affordance. Chrome reduced further.
No live-read claim (`04 B`). The shutter frame does not cut to the next screen —
it becomes its hero.

### Analysis

The photograph, full-bleed, held. Four stage labels in mono, each resolving in
place with a hairline rule as it completes:

```
   READING COLOUR        ✓ 0.2s
   READING ATMOSPHERE    ✓
   FINDING MUSIC         ⠋
   PREPARING PREVIEWS    ·
```

The palette ribbon draws itself across the photograph's foot the moment stage 1
finishes — the user watches their photograph give up its colour while the network
works. Nothing here is a spinner over a blank screen.

`Save colours only` is present from stage 2 onward as a quiet text action.

### Pairing — the screen the product is for

Full-height candidate cards in a horizontal pager (`ui/Carousel.tsx` exists, 320
LOC). 3–5 cards, position indicated, ends hard-stopped — a finite choice that
_feels_ finite.

Behind the cards: the memory's own chromatic field, still holding the
photograph's colour. The user has not left their moment.

Each card: artwork, title, artist, album · "Hear it" / progress · "Why this
matches" · match indicators · **store link and attribution** (a legal
requirement, `07`) · reject.

Bottom, pinned (the existing `Screen` bottom-action pattern): **Choose this
one**. Secondary: search manually · try again · skip music.

### Result

Name it, note it, save. Kept short — the emotional payoff already happened on the
pairing screen; this is confirmation, not ceremony.

### Memory detail

Per `04 E`. The integration test for this screen: cover the photograph and the
layout should still read as one object, because the ribbon bridges the photo and
the track block and carries the playhead.

### Memories

Month bands kept. Cards gain a **paired mark** — in chroma a small filled dot in
the ribbon's leading band; in Swiss a mono `♪` in the metadata rule. Filter rail
(`ui/FilterRail.tsx` exists) gains mood, colour, energy, genre, paired/unpaired.

Performance work (`04 F`) lands before the filters.

### Collections

Consumer container. "Colour system" in the overflow enters Working Set mode,
which is the current `CollectionScreen` merge/gap/export surface, unchanged in
capability.

### You

Gains: **Audio** (auto-play previews, sound cues, haptics), **Privacy** (image
analysis consent, what has been sent, delete all local data), **Music provider**
(which provider, region), **Colour tools** (index of the ten `tools/*` routes).

### Paywall

Entered only from a Pro-gated action, never on the path to the first memory
(`03` invariant 4). Kept as a modal; the CTA must stop calling `router.back()`
before any of this is described as billing.

## Accessibility

Non-negotiable, and cheaper to keep than to retrofit:

- Every player control has an accessibility label and a state
  (`accessibilityState: { selected, busy }`). A test asserts no player control
  ships without one (`14`).
- Match indicators are never colour-alone — always paired with a count or a word.
- Dynamic Type to XXL: the pairing card must not clip artist or title. Verified
  with long Vietnamese metadata, which is the worst realistic case.
- Reduce Motion: the ribbon still shows a playhead; it just does not animate the
  drift. Static, intentional — not frozen.
- VoiceOver order on the pairing card: title → artist → why this matches → play →
  choose. Reason before action.
- Contrast: `readableOn` (`color.ts:424`) already guarantees palette-derived
  accents clear 4.5:1. Extended to every music surface.
