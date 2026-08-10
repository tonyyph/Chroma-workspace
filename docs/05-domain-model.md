# 05 · Domain model

Lives in `packages/domain/src/`, alongside the existing `color` / `palette` /
`discovery` modules. Pure TypeScript + Zod, zero React, zero Expo — the boundary
that makes the colour engine testable applies to everything here.

New modules:

```
packages/domain/src/
  memory.ts          ChromaticMemory + draft + repository
  atmosphere.ts      AtmosphereReading, derived from a palette
  intent.ts          MusicIntent, derived from atmosphere
  music.ts           provider-neutral track/preview/recommendation types
  feedback.ts        MusicFeedback and preference accumulation
  analysis.ts        AIAnalysisResult and the provider contracts
```

## Naming

The existing code says `Palette`, `Color`, `PaletteSet`, `colorSchema` — US
spelling in identifiers, British in prose. That convention is kept exactly.
`ChromaticMemory` is the aggregate; the word "memory" alone is avoided in
identifiers where it could read as RAM.

---

## `ChromaticMemory`

```ts
export const chromaticMemorySchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  capturedAt: z.iso.datetime(),

  image: imageRefSchema,
  palette: memoryPaletteSchema,
  atmosphere: atmosphereReadingSchema,
  visualAnalysis: visualAnalysisSchema.nullable(),
  musicPairing: musicPairingSchema,
  personalContext: personalContextSchema,

  /** Precomputed scalars so Memories can filter without touching colour maths. */
  facets: memoryFacetsSchema,

  /** Working Sets and Collections both address a memory by id. */
  collectionIds: z.array(z.string().uuid()).max(50),
  isPinned: z.boolean(),
});
```

### Why `palette` is nested rather than referenced

A memory *is* its palette; there is no palette without a moment. Nesting keeps
one record, one write, one validation, and no join to render a card. It also
means the v1 migration is a pure widening — every field of `Palette` has a home.

```ts
const memoryPaletteSchema = z.object({
  colors: z.array(colorSchema).min(2).max(8),   // reused, unchanged
  deltaE: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  space: colorSpaceSchema,
  tuned: z.boolean(),
  source: paletteSourceSchema,
});
```

`colorSchema` is imported from `palette.ts` verbatim, including its
`rgb`-agrees-with-`hex` refinement. The weights-sum-to-one invariant moves onto
the memory's `superRefine`.

### `image`

```ts
const imageRefSchema = z.object({
  localUri: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  source: z.enum(['camera', 'photo-library', 'sample']),
  thumbnailUri: z.string().min(1).nullable(),
});
```

`'sample'` covers onboarding's bundled photograph, so a memory made during
onboarding is a real memory and not a special case.

### `atmosphere` — computed, never null

```ts
export const atmosphereReadingSchema = z.object({
  /** 0..1, dark → bright. Weighted mean OKLCh lightness. */
  luminosity: z.number().min(0).max(1),
  /** -1..1, cool → warm. Weighted circular hue position. */
  warmth: z.number().min(-1).max(1),
  /** 0..1. Weighted mean chroma, normalised against the OKLCh ceiling. */
  saturation: z.number().min(0).max(1),
  /** 0..1. Max WCAG contrast between any two weighted colours. */
  contrast: z.number().min(0).max(1),
  /** 0..1. Perceptual spread of the palette — ΔE00 between roles. */
  spread: z.number().min(0).max(1),
  /** 0..1, from the extraction's ΔE00. Low ΔE = a coherent scene. */
  coherence: z.number().min(0).max(1),
  /** Derived label, for copy and filtering. */
  mood: colourMoodSchema,
});

export const colourMoodSchema = z.enum([
  'serene', 'tender', 'luminous', 'vivid',
  'nocturnal', 'melancholy', 'earthy', 'stark',
]);
```

Deterministic and total: any valid palette produces a reading. This is why
`atmosphere` is non-nullable while `visualAnalysis` is nullable — one is
computed from data we already hold, the other needs a network round trip that
may never happen.

### `visualAnalysis` — nullable, provider-sourced

```ts
const visualAnalysisSchema = z.object({
  caption: z.string().max(240).nullable(),
  subjects: z.array(z.string().max(40)).max(6),
  scene: z.string().max(40).nullable(),
  lighting: z.string().max(40).nullable(),
  timeOfDay: z.enum(['dawn','morning','midday','afternoon','dusk','night']).nullable(),
  weather: z.string().max(40).nullable(),
  indoorOutdoor: z.enum(['indoor', 'outdoor']).nullable(),
  motion: z.enum(['still', 'gentle', 'active']).nullable(),
  confidence: z.number().min(0).max(1),
  /** Which provider and prompt version produced it, so it can be re-run. */
  analysisVersion: z.string().max(32),
  analysedAt: z.iso.datetime(),
});
```

Every field nullable inside a nullable object: a vision provider that returns
only a caption is a *partial success*, not a failure.

### `musicPairing`

```ts
const musicPairingSchema = z.object({
  status: recommendationStatusSchema,
  selectedTrack: musicTrackReferenceSchema.nullable(),
  recommendations: z.array(musicRecommendationSchema).max(12),
  intent: musicIntentSchema.nullable(),
  recommendationVersion: z.string().max(32).nullable(),
  feedback: z.array(musicFeedbackSchema).max(50),
  pairedAt: z.iso.datetime().nullable(),
});

export const recommendationStatusSchema = z.enum([
  'unpaired',      // no attempt yet — a valid, complete memory
  'pending',       // in flight (never persisted; runtime only)
  'suggested',     // candidates exist, none chosen
  'paired',        // a track is selected
  'unavailable',   // chosen track no longer resolves in the catalogue
  'failed',        // last attempt failed; retryable
]);
```

`'unpaired'` is deliberately the zero value, so every migrated v1 palette lands
in a legitimate state rather than an error one.

### `facets` — the filtering contract

```ts
const memoryFacetsSchema = z.object({
  dominantHue: z.number().min(0).max(360),
  dominantHex: hexSchema,
  warmth: z.number().min(-1).max(1),
  energy: z.number().min(0).max(1),
  luminosity: z.number().min(0).max(1),
  mood: colourMoodSchema,
  paired: z.boolean(),
  genres: z.array(z.string().max(32)).max(5),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
});
```

This exists purely so Memories filtering never calls `hexDeltaE00`. It is
derived on write by `deriveFacets(memory)` and asserted consistent by a test —
denormalised data that drifts is worse than a slow filter.

---

## Music types — provider-neutral by construction

```ts
export const musicProviderIdSchema = z.enum(['itunes', 'appleMusic', 'deezer', 'none']);

export const musicTrackReferenceSchema = z.object({
  provider: musicProviderIdSchema,
  /** The provider's own id. Opaque to the domain. */
  providerTrackId: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  artist: z.string().min(1).max(200),
  album: z.string().max(200).nullable(),
  artworkUrl: z.string().url().nullable(),
  durationMs: z.number().int().positive().nullable(),
  /** ISRC when the provider supplies it — the only cross-provider identity. */
  isrc: z.string().length(12).nullable(),
  genres: z.array(z.string().max(32)).max(5),
  releaseYear: z.number().int().min(1900).max(2100).nullable(),
  /** Where to send the user to hear the whole thing, legally. */
  externalUrl: z.string().url().nullable(),
  /** Attribution string the provider's terms require us to display. */
  attribution: z.string().max(80),
});
```

**`previewUrl` is deliberately absent from the persisted reference.** Preview
URLs are temporary, provider-controlled, and in some cases signed. Persisting one
means a memory opened in a year plays a dead link, or — worse — that we have
stored a durable pointer to copyrighted audio. `MusicPreview` is resolved at
playback time and never written to disk:

```ts
export type MusicPreview = {
  url: string;
  durationMs: number;
  /** Wall-clock after which this must be re-resolved. */
  expiresAt: string | null;
  /** True when the provider supplied it; we never construct one. */
  providerSupplied: true;
};
```

A persistence test asserts no `http` URL pointing at audio ever appears in a
serialised memory except `artworkUrl` and `externalUrl` (`14`).

```ts
export const musicRecommendationSchema = z.object({
  track: musicTrackReferenceSchema,
  rank: z.number().int().min(0).max(11),
  /** 0..1 — how well the candidate matched the intent. Computed, never LLM. */
  score: z.number().min(0).max(1),
  reasons: z.array(musicRecommendationReasonSchema).min(1).max(4),
  /** Prose. LLM-written when available, else composed from `reasons`. */
  explanation: z.string().max(240),
  previewAvailable: z.boolean(),
});

export const musicRecommendationReasonSchema = z.object({
  kind: z.enum(['warmth','energy','luminosity','pace','texture','genre','era','mood','contrast']),
  /** -1..1: how strongly this dimension drove the match. */
  weight: z.number().min(-1).max(1),
});
```

Reasons are **structured first, prose second**. That is what lets the explanation
be localised into Vietnamese properly, rendered as match indicators, unit-tested,
and generated without an LLM.

### `MusicFeedback`

```ts
export const musicFeedbackSchema = z.object({
  providerTrackId: z.string().max(64),
  signal: z.enum(['selected','rejected','replaced','played-through','skipped-early']),
  at: z.iso.datetime(),
  /** Genres/eras carried forward so preference accrues without storing history. */
  genres: z.array(z.string().max(32)).max(5),
});
```

Explicit (`selected`, `rejected`) and implicit (`played-through`,
`skipped-early`) both captured. Aggregated by `accumulatePreference(feedback[])`
into a bias applied to ranking — never into a stored user profile.

---

## Draft state

```ts
export type ChromaticMemoryDraft = {
  image: ImageRef;
  palette: MemoryPalette;
  atmosphere: AtmosphereReading;
  visualAnalysis: VisualAnalysis | null;
  intent: MusicIntent | null;
  recommendations: MusicRecommendation[];
  selectedTrack: MusicTrackReference | null;
  status: RecommendationStatus;
  error: PairingError | null;
};
```

Held in `captureStore` (which already does exactly this job for pending
captures), never persisted. `toChromaticMemory(draft, name, note)` is the single
constructor, mirroring today's `captureStore.toPalette`.

---

## Repository

```ts
export interface ChromaticMemoryRepository {
  list(): Promise<readonly ChromaticMemory[]>;
  get(id: string): Promise<ChromaticMemory | null>;
  save(memory: ChromaticMemory): Promise<void>;
  remove(id: string): Promise<void>;
  /** Records that failed validation, so a corrupt row is visible, not silent. */
  listInvalid(): Promise<readonly StoredRecordProblem[]>;
}
```

`listInvalid` exists because of the failure mode found in `01 §4`: today one bad
record throws and the whole library disappears. v2 reads record-by-record with
`safeParse`, keeps what is valid, and *reports* what is not.

`PaletteRepository` and `SetRepository` **stay**, backed by projections over
memories, so `mergePalettes`, `paletteGaps` and all ten `tools/*` screens keep
compiling against the interfaces they already use.

---

## States the model must represent

| State                                   | How                                                       |
| --------------------------------------- | --------------------------------------------------------- |
| Memory with no track yet                | `status: 'unpaired'`, `selectedTrack: null`               |
| Recommendations loading                 | `'pending'` — runtime only, never persisted               |
| AI analysis failed                      | `visualAnalysis: null`; atmosphere still present          |
| Music provider failed                   | `'failed'` + `error`; retryable                           |
| Preview unavailable                     | `previewAvailable: false`; card selectable                |
| Offline with saved metadata             | Track fields are local; only preview needs network        |
| Track later removed from catalogue      | `'unavailable'`; metadata retained                        |
| Re-run recommendations                  | New `recommendationVersion`; feedback preserved           |
| Manual search and select                | Same `selectedTrack` write path                           |
| Replace a track                         | Old id → `feedback: 'replaced'`, new track set            |
| Explicit + implicit feedback            | `musicFeedbackSchema.signal`                              |
| Legacy palette migrated                 | `'unpaired'`, `visualAnalysis: null`, full colour data    |
