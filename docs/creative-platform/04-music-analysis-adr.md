# 04 — ADR: music analysis and beat synchronisation

**Status:** accepted (decision D1, 2026-08-17). Implementation is Phase 4.

---

## 1. Decision

**The visual system is driven by inputs we actually measure. Beat detection is
not implemented, and nothing pretends it is.**

Concretely, pacing and emphasis come from:

| Signal                                       | Source                   | Nature                        |
| -------------------------------------------- | ------------------------ | ----------------------------- |
| `facets.energy`                              | `memory.ts:deriveFacets` | **colour**-derived, not audio |
| `warmth`, `luminosity`, `contrast`, `spread` | `domain/atmosphere.ts`   | colour-derived                |
| `mood`                                       | `AtmosphereReading`      | colour-derived                |
| `genres`, `releaseYear`                      | `MusicTrackReference`    | provider metadata             |

All are already computed, already stored, offline and sub-millisecond.

---

## 2. Why beat detection is not available

Three independent findings, all verified against source (audit §6):

**No provider reports musical features.** `music.ts:96-100` deliberately omits
`tempo` from `recommendationReasonKinds`, stating that "citing a number we did not
measure would be the exact dishonesty this product is built to avoid." Spotify's
audio-features and recommendation endpoints are closed to new applications, and
Spotify removed 30-second preview access for new apps on 2024-11-27
(`music.ts:10-14`). iTunes Search, the shipped provider, returns catalogue
metadata only.

**Nothing in the app can read audio samples.** `expo-audio` plays a URL. There is
no PCM access, no FFT, no amplitude metering, and no dependency that could
provide one. There is no waveform data in this application.

**We are not licensed to analyse what we can play.** Provider previews are
streamed under terms that permit playback. `MusicPreview.providerSupplied` is the
literal `true`, documented as: "there is no branch of this product that
constructs, trims, or hosts audio." Decoding a preview to extract beats is a
different act from playing it.

---

## 3. The capability ladder

The brief's ladder is the right model. This records which rungs are reachable.

| Rung                        | Reachable         | Note                                              |
| --------------------------- | ----------------- | ------------------------------------------------- |
| Metadata only               | **yes**           | title, artist, genres, year, artwork, attribution |
| External link only          | **yes**           | `externalUrl`, opened via `Linking`               |
| Legal preview available     | **playback only** | never analysis, never persisted                   |
| User-owned / imported audio | no                | needs an import flow and an analyser              |
| Royalty-free audio          | no                | needs a licensed library                          |
| Backend-analysed audio      | no                | needs a backend (audit §9)                        |

The UI must state which rung a given track is on rather than showing a disabled
control. `previewUnavailableReasons` (`not-offered` / `expired` /
`region-restricted` / `network`) already models this as _displayed states, not
spinners_, and the same discipline applies to analysis.

---

## 4. What Beat-Synced Memory becomes

A **visual sequence paced by the memory's own colour**, with the track named and
attributed alongside it. `domain/livingMemory.ts` already demonstrates the
approach and states it plainly: "the pacing comes from the atmosphere the colour
already produced: a serene memory breathes, a vivid one cuts."

Four intensity presets — **Calm, Flow, Pulse, Rush** — are multipliers over that
derived pacing, deterministic so exports are reproducible. Every automatic result
stays editable.

**Naming.** Calling this "Beat-Synced" while it is not synchronised to a beat is
the fabrication this ADR exists to prevent. The feature ships under a name that
describes what it does. "Beat-Synced Memory" is reserved for the day user-owned
audio and a real analyser arrive.

---

## 5. Export truthfulness

**A static carousel contains no audio.** PNGs carry no sound, and the app must not
imply otherwise. `StoryPreviewScreen` states this where someone is deciding what
to post, not buried in settings.

Permitted outputs:

- static carousel **plus an attached-track reference** (title, artist, and the
  `attribution` string the licence requires on screen);
- a Chromawave deep link — **note:** inbound deep-link handling does not exist yet
  (audit §3), so this is blocked on that work;
- silent video with a music-link card — blocked on video (decision D2);
- video with legally permitted audio — not available on any current rung.

`attribution` is carried on every `MusicTrackReference` precisely so a screen
cannot forget it: a surface that omits it is a licence breach, and the reliable
way to prevent that is to make the text arrive attached to the data.

---

## 6. Consequences

**Good.** No new provider, no new dependency, no licensing exposure, works
offline, and the pacing is _about the photograph_ — which is more on-product than
generic beat-cutting would be.

**Accepted.** The feature is less impressive than the brief's description. A user
expecting cuts landing on the downbeat will not get them. That expectation is
better disappointed by a name than by a feature that claims to sync and does not.

---

## 7. What would overturn this

- A user-owned audio import flow plus an on-device analyser — the cheapest real
  path, and the one to take first.
- A licensed royalty-free library with published tempo metadata.
- A backend able to analyse audio the user is entitled to have analysed.
- A provider re-opening audio features to new applications.

Any of these adds a rung. None of them changes the rule: **the number shown must
be the number measured.**
