# 06 · AI and recommendation architecture

## The principle

**Deterministic colour science is the engine. The LLM is a narrator and a
re-ranker, and the product works completely without it.**

This is not a compromise forced by missing API keys. `archive/09-pairing-engine.md`
reached the same conclusion in the original v1 design — "No large language model
is required" — and it was correct. An LLM-first pipeline would be slower, cost
money per capture, fail offline, be untestable, and be structurally capable of
inventing tracks. A deterministic core with an optional narrator is better on
every axis that matters.

What the LLM is genuinely good at, and is used for: reading *what is in the
photograph* (a rainy street, a child asleep), and writing one sentence of English
or Vietnamese that connects colour to sound. Neither is on the critical path.

## The pipeline

```
  Photograph
      │
      ▼  Skia 128² downscale · OKLab k-means · CIEDE2000      ← already built
  Palette (weighted, roled, ΔE00)
      │
      ├──────────────────────────────┐
      ▼ deterministic, <5ms          ▼ optional, network, 1–4s
  AtmosphereReading            VisualAnalysis (caption, scene, light, time)
      │                              │
      └──────────────┬───────────────┘
                     ▼  deterministic mapping + optional LLM refinement
                 MusicIntent
                     │
                     ▼  intent → provider query strings
              MusicSearchQuery[]
                     │
                     ▼  MusicProvider.search()          ← verified catalogue only
             raw provider results
                     │
                     ▼  normalise → MusicTrackReference[]
                     ▼  rank against intent (deterministic scoring)
                     ▼  diversity pass (no three tracks by one artist)
                     ▼  preview availability check
                     ▼  optional: LLM re-rank top 8 → top 5, and write reasons
             MusicRecommendation[]  (3–5)
```

Everything left of `MusicProvider.search()` runs offline. Everything right of it
requires network and degrades to a defined state.

## Stage 1 — Atmosphere (deterministic, total)

`packages/domain/src/atmosphere.ts`. Pure function of a palette. No I/O.

| Dimension    | Computed from                                                             |
| ------------ | ------------------------------------------------------------------------- |
| `luminosity` | Σ(weight × OKLCh lightness)                                               |
| `warmth`     | Weighted circular hue position; warm poles 15°/45°, cool pole 230° — reuses the existing `temperatureForHue` geometry from `color.ts:76` |
| `saturation` | Σ(weight × chroma) ÷ 0.37 (the practical sRGB OKLCh chroma ceiling), clamped |
| `contrast`   | max `contrastRatio` over weighted colour pairs, mapped 1:1–21:1 → 0..1     |
| `spread`     | mean `hexDeltaE00` between the three named roles ÷ 40, clamped            |
| `coherence`  | `1 − min(1, deltaE / 10)` — reuses the extraction's own confidence basis  |
| `mood`       | Decision table over the six scalars                                       |

The mood table is a table, not a model — eight labels, explicit thresholds,
unit-tested at its boundaries:

```
nocturnal   luminosity < .22
melancholy  luminosity < .45 ∧ saturation < .30 ∧ warmth < 0
serene      saturation < .35 ∧ contrast < .45
tender      warmth > .25 ∧ saturation < .50 ∧ luminosity > .55
earthy      warmth > .15 ∧ saturation .25–.60 ∧ luminosity .30–.65
luminous    luminosity > .70 ∧ contrast < .55
vivid       saturation > .60
stark       contrast > .70            (fallback)
```

Order matters and is asserted by tests. A palette can only produce one mood.

## Stage 2 — Visual analysis (optional, network)

```ts
export interface ImageUnderstandingProvider {
  readonly id: string;
  readonly version: string;
  analyse(input: {
    image: { base64: string; mimeType: string; width: number; height: number };
    signal: AbortSignal;
  }): Promise<VisualAnalysis>;
}
```

- Input is a **1024px longest-edge JPEG at q0.7**, EXIF stripped, produced by
  `expo-image-manipulator`. No location, no original resolution, no metadata.
- Output is parsed with `visualAnalysisSchema.safeParse`. A response that fails
  validation is a **failure**, not a best-effort merge — partial garbage in the
  caption is worse than no caption.
- Timeout 8s, abortable, one retry on 5xx/network, none on 4xx.
- Cached by `sha256(imageBytes) + analysisVersion` in MMKV so a re-run costs
  nothing (`expo-crypto` is already a dependency).
- Never blocks the palette or the recommendations. If it resolves after the user
  has moved on, the result is written to the draft and the copy updates in place.

`NullImageUnderstandingProvider` is the default and returns `null` immediately.
`DevFixtureImageProvider` exists behind `__DEV__ && flags.useFixtures` only, and
a test asserts it is unreachable in a production bundle.

## Stage 3 — MusicIntent

```ts
export const musicIntentSchema = z.object({
  valence: z.number().min(0).max(1),      // sombre → bright
  energy: z.number().min(0).max(1),       // still → driving
  warmth: z.number().min(0).max(1),       // cool/electronic → warm/organic
  intimacy: z.number().min(0).max(1),     // vast → close
  tension: z.number().min(0).max(1),      // resolved → unresolved
  pace: z.enum(['slow', 'medium', 'fast']),
  texture: z.array(z.string().max(24)).max(5),
  genres: z.array(z.string().max(32)).min(1).max(5),
  instruments: z.array(z.string().max(24)).max(5),
  eras: z.array(z.string().max(16)).max(3).nullable(),
  lyricalPreference: z.enum(['instrumental', 'vocal', 'either']),
  explanation: z.string().max(240),
  /** Rotated by "Try again" so a second run is genuinely different. */
  seed: z.number().int().min(0),
});
```

### The deterministic mapping

```
valence   = .55·luminosity + .25·(warmth+1)/2 + .20·saturation
energy    = .45·saturation + .30·contrast + .25·spread
warmth    = (atmosphere.warmth + 1) / 2
intimacy  = .60·(1 − spread) + .40·coherence
tension   = .50·contrast + .30·(1 − coherence) + .20·(1 − |warmth|)
pace      = energy < .33 ? slow : energy < .66 ? medium : fast
```

Coefficients are stated here so they can be argued with and tuned, and they live
in one exported constant so a tuning change is one diff and one test update.

Genres, texture and instruments come from a **mood × energy lookup table**, not
from arithmetic — "ambient, modern classical, slowcore" is a curatorial judgment
and belongs in a table a human can edit:

```
nocturnal  + low   → ambient · downtempo · modern classical
nocturnal  + high  → darkwave · trip hop · post-punk
serene     + low   → ambient · folk · new age
tender     + low   → indie folk · dream pop · soul
luminous   + med   → indie pop · city pop · bossa nova
vivid      + high  → funk · afrobeat · disco
earthy     + med   → americana · jazz · psychedelic folk
melancholy + low   → slowcore · shoegaze · piano
stark      + high  → industrial · minimal techno · noise rock
```

`visualAnalysis`, when present, **adjusts** the intent: `timeOfDay: 'night'`
lowers valence and pushes toward `intimacy`; `motion: 'active'` raises energy;
`indoorOutdoor: 'outdoor'` widens genre breadth. Bounded adjustments, ±0.15 each,
so a wrong caption can never dominate a correct palette reading.

### Optional LLM refinement

```ts
export interface RecommendationProvider {
  refineIntent(input: {
    atmosphere: AtmosphereReading;
    visual: VisualAnalysis | null;
    baseline: MusicIntent;
    userMood: string | null;
    note: string | null;
    preference: AccumulatedPreference;
    signal: AbortSignal;
  }): Promise<MusicIntent>;

  explain(input: {
    intent: MusicIntent;
    candidates: readonly MusicTrackReference[];   // verified. The only tracks in scope.
    language: Language;
    signal: AbortSignal;
  }): Promise<readonly TrackExplanation[]>;
}
```

Hard constraints, enforced in code rather than in the prompt:

1. `refineIntent` output is `musicIntentSchema.safeParse`d. Invalid → **use the
   baseline**, do not partially merge.
2. `explain` receives candidate ids and may only return ids from that set. Any
   unknown id is dropped. **The LLM cannot introduce a track.**
3. The LLM never sees a preview URL and never produces one.
4. Re-ranking may reorder the verified top 8; it may not add to it.
5. Every call is abortable and has a deterministic fallback that is already
   computed before the call is made.

## Stage 4 — Search, normalise, rank

**Query construction.** An intent becomes 2–4 `MusicSearchQuery` objects — the
catalogue APIs available to us are keyword search, not feature search, so queries
are built from genre + texture + era terms and issued in parallel:

```ts
export type MusicSearchQuery = {
  terms: string;              // "ambient instrumental calm"
  genre: string | null;
  limit: number;
  market: string | null;      // ISO-3166-1 alpha-2, from device locale
};
```

**Normalisation** maps each provider's payload into `MusicTrackReference`,
dropping anything without a title, artist, and stable id. Provider types never
cross this boundary — asserted by a test that scans `features/` and `domain/` for
provider-shaped field names (`trackId`, `previewUrl`, `collectionName`, `uri`).

**Ranking** is deterministic and unit-testable:

```
score = 1 − Σ wᵢ·|intentᵢ − candidateᵢ|          over the axes we can estimate
      + genreMatch      · 0.20
      + eraMatch        · 0.05
      + preferenceBias  · 0.10                   from accumulated feedback
      − artistRepeat    · 0.15                   diversity
      − rejectedRecently· 0.50
```

Candidate axis estimates come from what the catalogue actually gives us — genre,
release year, duration, explicitness — plus the query that found it. We do **not**
claim to know a track's valence and energy: where Spotify's audio-features
endpoint would once have supplied them, that endpoint is also restricted for new
apps (`07`). The honest statement is that ranking is *intent-to-query* matching
with a diversity and preference pass, and the reasons shown to the user cite only
dimensions we actually measured — colour, light, atmosphere — never a fabricated
audio feature.

**Preview availability** is checked before a card renders as playable. A card
without a preview is shown, marked, and remains selectable.

## Failure and caching

| Failure                  | Behaviour                                                     |
| ------------------------ | ------------------------------------------------------------- |
| Vision timeout/invalid   | `visualAnalysis: null`; deterministic intent only             |
| Refine timeout/invalid   | Baseline intent                                               |
| Explain fails            | Reasons composed from structured `reasons[]` and localised     |
| Provider search fails    | `status: 'failed'`; "Save colours only" offered               |
| Zero results             | Broaden query once (drop texture terms), then `'failed'`       |
| All previews missing     | Cards render with "Open in…"; selection still allowed          |
| Offline                  | Skip stages 2–4 entirely; go straight to result                |

Caches, all MMKV, all bounded:

- `analysis:{sha256(image)}:{version}` → `VisualAnalysis`, 50 entries LRU.
- `intent:{sha256(atmosphere+visual)}:{version}` → `MusicIntent`, 50 entries.
- `search:{sha256(query)}:{market}` → normalised tracks, 15 min TTL, 100 entries.

`recommendationVersion = "{intentVersion}.{rankerVersion}.{providerId}"` is stored
on every pairing, so a memory can state which generation produced it and a future
version can offer "re-match with the new engine" without guessing.

## No fake production behaviour

- No hardcoded track list ships in a production build.
- `DevFixture*` providers are constructed only under `__DEV__` and behind an
  explicit flag; a test asserts no fixture module is imported from a non-dev path.
- If no provider is configured, the app is **honest**: pairing is unavailable and
  says so. It does not show invented songs.
