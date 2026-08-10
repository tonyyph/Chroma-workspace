# 14 · Verification matrix

`Implemented` = code exists · `Verified` = seen running in a real runtime ·
`Production-ready` = implemented, verified, tested, failure states handled,
provider and legal constraints satisfied.

**A Jest run never produces `Verified`.** Jest mocks Reanimated, has no audio
device, and cannot see a screen.

## Automated tests to add

### Domain (vitest, `packages/domain`)

| Test                                 | Asserts                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| `atmosphere` at every mood threshold | one mood per palette; order-dependent table correct         |
| `atmosphere` totality                | any schema-valid palette yields a valid reading             |
| `deriveIntent` determinism           | same input + seed → identical intent                        |
| `deriveIntent` bounds                | every scalar in range for extreme palettes                  |
| Visual-analysis adjustment bounds    | a wrong caption moves intent ≤0.15 per axis                 |
| `rankCandidates` determinism         | fixed input → fixed order                                   |
| Ranking diversity                    | no artist appears 3× in the top 5                           |
| Ranking honours rejection            | a rejected id ranks last or is dropped                      |
| `accumulatePreference`               | selections raise, rejections lower, genre weights           |
| `chromaticMemorySchema`              | weights sum to 1; roles unique; every listed state valid    |
| Preview URL never persisted          | serialised memory has no audio URL outside artwork/external |
| `paletteToMemory` round trip         | every v1 field survives                                     |
| Migration: 50 valid                  | count, ids, colours preserved                               |
| Migration: `photoUri: null`          | legacy colour-only memory                                   |
| Migration: 1 of 50 corrupt           | 49 migrate, 1 quarantined, v1 intact                        |
| Migration: all corrupt               | aborts, writes no v2, v1 intact                             |
| Migration: run twice                 | idempotent                                                  |
| Migration: interrupted               | re-runs cleanly                                             |
| `listInvalid`                        | one bad record does not hide the good ones                  |
| AI output validation                 | malformed LLM response → baseline, never partial merge      |
| LLM cannot add a track               | ids outside the candidate set are dropped                   |
| Provider normalisation               | missing title/artist/id dropped; nulls tolerated            |

### Mobile (jest, `apps/mobile`)

| Test                                      | Asserts                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| Only one preview at a time                | second `play()` moves the first out of `playing`                                           |
| Player stops on unmount                   | no orphaned audio                                                                          |
| Interruption pauses, does not auto-resume |                                                                                            |
| Preview unavailable                       | control disabled and labelled, never a lying affordance                                    |
| Offline pairing                           | palette-only memory saveable                                                               |
| Provider failure                          | `status: 'failed'`, retry offered, memory still saveable                                   |
| Track replacement                         | old id recorded as `replaced`, new track set                                               |
| Expired preview                           | re-resolved once, then `unavailable`                                                       |
| **No provider type leaks**                | `features/` and `domain/` free of `previewUrl`, `trackId`, `collectionName`, `wrapperType` |
| **Appearance leaks**                      | existing test extended to the new music tokens                                             |
| **Every card has a store link**           | no recommendation renders without attribution + link (legal, `07`)                         |
| **Player controls are labelled**          | no control without `accessibilityLabel` and state                                          |
| EN/VI parity                              | exact key parity; new keys inside width budgets                                            |
| No fixture in production                  | dev fixture providers unreachable from a non-dev path                                      |
| No secret-shaped literal                  | source scan for keys and unsafe `EXPO_PUBLIC_`                                             |

## Visual regression

**Step 1 (cheap, now):** snapshot the _resolved style object_ per skin for the
new music surfaces. Catches token drift and hardcoded values. Would have caught
this session's `round.full` leak.

**Step 2 (real, Phase 3):** a screenshot harness over both skins. Only this
catches worklet bugs, hero landing positions, and Swiss looking like chroma —
the three failures that have actually happened in this repository.

## Device / simulator matrix

Every row observed by a human. Nothing here can be automated away.

### Images

| Input                     | Watch for                                              |
| ------------------------- | ------------------------------------------------------ |
| Bright, high key          | palette not washed out; readable accents               |
| Dark, low key             | bands distinguishable; scrim adequate                  |
| Low saturation            | mood not defaulting to `stark`; intent still plausible |
| High chroma               | no gamut clipping; hue preserved                       |
| Portrait                  | hero framing; ribbon position                          |
| Landscape                 | same                                                   |
| Near-monochrome           | ≥2 colours extracted; schema minimum satisfied         |
| Legacy colour-only memory | renders without a photograph                           |

### Music and audio

| Case                                | Watch for                                       |
| ----------------------------------- | ----------------------------------------------- |
| Preview plays                       | **audio actually leaves the speaker**           |
| Skip between candidates             | previous stops before next starts               |
| Missing album art                   | layout holds; no broken-image box               |
| Preview unavailable                 | honest state; store link works                  |
| Store link                          | opens Apple Music / the store correctly         |
| Slow network (Link Conditioner, 3G) | staged progress readable; palette still instant |
| Offline                             | palette-only save works; no endless spinner     |
| Airplane mode mid-search            | clean failure, retry offered                    |
| Incoming call during preview        | pauses, no auto-resume                          |
| Headphones unplugged                | pauses                                          |
| Backgrounded during preview         | pauses; nothing continues                       |
| Silent switch on                    | platform behaviour honoured                     |
| Cold start → replay a saved memory  | metadata offline; preview re-resolves           |

### Accessibility and localisation

| Case                      | Watch for                                      |
| ------------------------- | ---------------------------------------------- |
| Dynamic Type XXL          | pairing card does not clip title or artist     |
| Long Vietnamese metadata  | no truncation; budgets hold                    |
| VoiceOver on pairing card | order: title → artist → reason → play → choose |
| VoiceOver playback state  | announced once, not per frame                  |
| Reduce Motion             | static entrances; **playhead still advances**  |
| Colour-blind              | match strength never colour-alone              |

### Both skins, every screen

Onboarding · Capture · Analysis · Pairing · Result · Memory detail · Memories ·
Today · Collections · You · Paywall.

**Swiss acceptance:** a Swiss and a chroma screenshot of the same memory must
differ in _layout_, not only palette. If they differ only in colour, Swiss has
failed (`13 R8`).

### Carried over from `archive/25` — still unverified, still required

- Hero transition landing position (highest-risk unseen item in the repository).
- Ribbon height and month-rule weight.
- Swiss scrims over real photographs.
- Adapted backdrop legibility against arbitrary palettes.
- Reduce Motion producing static fallbacks rather than frozen animation.

## Performance targets

| Measurement                         | Target                    | Method                      |
| ----------------------------------- | ------------------------- | --------------------------- |
| Image selected → palette on screen  | < 800 ms                  | timestamp both ends         |
| Palette → first recommendation      | < 2.5 s on 4G             | ditto                       |
| Tap "Hear it" → audio starts        | < 1.2 s                   | ditto                       |
| Memories first render, 500 memories | < 400 ms                  | seeded fixture library      |
| Memories filter tap, 500 memories   | < 100 ms                  | **the R7 regression guard** |
| Memories scroll                     | 60 fps sustained          | Instruments                 |
| Hero transition                     | 60 fps, no dropped frames | Instruments                 |
| Memory footprint, 500 memories      | < 250 MB                  | Instruments                 |
| Ambient shader, both skins          | measured, not assumed     | Instruments                 |

The 500-memory fixture is generated by a script, not typed by hand, and is the
same fixture for every performance run so numbers are comparable across commits.

## Release gate

Not `Production-ready` until:

1. Every automated test above passes.
2. Every device row has been observed by a human.
3. Performance targets are measured, not estimated.
4. Apple's preview and artwork terms have been reviewed for this use (`13 R3`).
5. No fixture data reachable in a production bundle.
6. No secret in the bundle.
7. The paywall either takes money or says it cannot.
