# 02 · The restored Chromawave vision

## What the product is

Chromawave turns a photograph into a **Chromatic Memory** — a moment you can both
see and hear.

A memory holds the photograph, the colour system extracted from it, the
atmosphere read out of that colour system, one chosen piece of music, and the
stated reason those things belong together. You make one in under a minute and
you come back to it months later because it sounds like the day it was.

## What it is not

- Not a palette generator that grew a music tab.
- Not a photo journal with a soundtrack field.
- Not a Spotify client.
- Not an "AI understands your soul" toy.

The product's value sits in one specific claim: **the colour of a moment carries
information about its atmosphere, and atmosphere is the thing music is organised
around.** That claim is testable, it is implemented deterministically, and it is
explained to the user in plain language every time.

## Why this is a defensible product and the colour instrument was not

The previous direction — a professional colour instrument — was well built and
competitively weak. Its differentiators were real (true area weights, ΔE00
stability, semantic roles) but they are _legible only to people who already know
what ΔE00 is_, a market of perhaps tens of thousands, most of whom already own
Adobe tools.

The restored direction takes the same engine and points it at something a
non-specialist can feel in three seconds: **this photograph sounds like this.**
The colour science stops being the product and becomes the reason the product is
better than a competitor's vibe-guessing. That inverts the marketing problem:
instead of explaining why perceptual clustering matters, we show a match that is
uncannily right and _then_ say why.

## The four things that must connect

1. **A real visual moment** — the user's own photograph, kept on device.
2. **Its colour system** — weighted, perceptually clustered, role-assigned.
3. **The atmosphere read from it** — warmth, energy, contrast, stability, light.
4. **A musical recommendation** — from a verified catalogue, with a stated reason.

If any link is fabricated, the whole product is a party trick. Hence the
non-negotiables in `06` and `07`: the atmosphere is _computed_, never invented;
the track is _fetched_, never hallucinated.

## Core loop

```
capture or import a photograph
  → extract its colour system            (already built, unchanged)
  → read its atmosphere                  (deterministic; LLM optional)
  → derive a MusicIntent                 (typed, testable)
  → search a verified music catalogue
  → rank candidates against the intent
  → play an authorised preview
  → compare, choose
  → save one Chromatic Memory
  → rediscover it by image, colour, or sound
```

Every arrow can fail independently, and the loop must still produce something
worth keeping. A memory with a palette and no track is a valid, first-class
memory — not an error state. This single decision is what makes the product
usable offline, on a plane, and in a country where the catalogue is thin.

## Terminology

Fixed vocabulary, EN and VI. Used in code, copy, and these documents.

| Concept                        | EN                  | VI                   |
| ------------------------------ | ------------------- | -------------------- |
| The saved unit                 | Chromatic Memory    | Ký ức sắc màu        |
| Extracted colour system        | Palette             | Bảng màu             |
| Reading colour → atmosphere    | Atmosphere          | Không khí            |
| The act of attaching music     | Pairing             | Ghép nhạc            |
| A suggested track              | Match               | Bản ghép             |
| The audio excerpt              | Preview             | Đoạn nghe thử        |
| Why a match fits               | Why this matches    | Vì sao hợp           |
| A group of memories            | Collection          | Bộ sưu tập           |
| A professional colour grouping | Working Set         | Bộ màu làm việc      |
| Emotional label                | Mood                | Tâm trạng            |
| Swap the chosen track          | Replace track       | Đổi bản nhạc         |
| Leave for the provider's app   | Open in Apple Music | Mở trong Apple Music |

**Banned language.** No "understands how you feel", no "knows your soul", no
"perfect match", no "AI-powered" as a value claim. The calibrated register:

> "Suggested from colour, light, and atmosphere."
> "Gợi ý dựa trên màu sắc và không khí của ảnh."
> "This track may suit your moment."
> "Bản nhạc này có thể phù hợp với khoảnh khắc của bạn."

Vietnamese is written as Vietnamese, not translated from English. "Ký ức sắc màu"
is chosen over the literal "Bộ nhớ màu" because _ký ức_ is lived memory and _bộ
nhớ_ is computer memory.

## Working Sets: kept, repositioned

Working Sets are not deleted. `mergePalettes` and `paletteGaps` are real
engineering that answers a real question ("what colour system do these twenty
captures share?"), and it has no consumer equivalent.

The decision: **two container types with one storage shape.**

- **Collections** — the consumer container. Emotional, editorial, shareable.
  "Autumn in Hanoi." Holds memories.
- **Working Sets** — the professional container, reachable from a Collection's
  overflow and from the You tab. Same underlying records, plus the merged system,
  gap analysis, and export. Presented as a _mode_, not a tab.

Rationale: deleting it throws away the strongest colour work in the app to save
one tab; keeping it as a peer tab makes a consumer product's primary navigation
50% professional tooling. Demoting it to a mode preserves the capability and the
audience without letting it dominate. The Sets tab is removed from the tab bar
(see `03`).

## Success signals

Ordered by how much they would change our confidence:

1. A first-time user saves a memory **with music** within 90 seconds of opening
   the app, without instruction.
2. Of memories saved with music, ≥60% keep the first or second suggestion —
   evidence the intent mapping is actually doing work.
3. Users return to _replay_ memories, not only to make new ones.
4. Palette-only memories get music added later, rather than being abandoned.
5. Vietnamese users complete the flow at the same rate as English users.

## What stays true from the previous direction

- Local-first: every memory, photo, palette and track _reference_ stays on the
  device. Nothing syncs. There is no account.
- No silent telemetry. The typed analytics contract stays; the transport stays
  a no-op until a deliberate decision says otherwise.
- The colour science is exact and stays visible — ΔE00, weights, and OKLCh
  values remain one tap away on every memory.
- Two skins, both first-class. Chroma is cinematic; Swiss is editorial. Music
  changes what they must express, not that they exist.
