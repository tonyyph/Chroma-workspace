import { z } from 'zod';

import {
  atmosphereMoodSchema,
  atmosphereReadingSchema,
  readAtmosphere,
  type AtmosphereReading,
} from './atmosphere';
import { visualAnalysisSchema } from './analysis';
import { colorMetrics } from './discovery';
import {
  musicPairingSchema,
  unpairedPairing,
  type MusicPairing,
  type MusicTrackReference,
} from './music';
import {
  colorSchema,
  colorSpaceSchema,
  hexSchema,
  paletteSourceSchema,
  type Color,
} from './palette';

/**
 * A Chromatic Memory — the thing this product makes.
 *
 * A photograph, the colour system inside it, the atmosphere that colour implies,
 * one piece of music, and the reason those belong together. Everything else in
 * the codebase is either what produces one of those five parts or what shows
 * them afterwards.
 *
 * **The palette is nested, not referenced.** There is no palette without a
 * moment, so a memory owns its colours outright: one record, one write, one
 * validation, and no join to draw a card. It also makes the v1 migration a pure
 * widening — every field of the old `Palette` has a home here and none is lost.
 */

/**
 * `'legacy'` is what a migrated v1 palette that never had a photograph gets.
 * Rather than weaken `localUri` to nullable for every future record, those
 * memories carry a sentinel and render as colour-only — the palette bands fill
 * the frame where the photograph would be. They are first-class: filterable,
 * pairable, and openable like any other memory.
 */
export const imageSourceSchema = z.enum(['camera', 'photo-library', 'sample', 'legacy']);

/** The uri a colour-only memory carries. Never dereferenced; matched on. */
export const LEGACY_IMAGE_URI = 'chromawave://palette-only';

export const imageRefSchema = z.object({
  localUri: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  source: imageSourceSchema,
  thumbnailUri: z.string().min(1).nullable(),
});

export type ImageRef = z.infer<typeof imageRefSchema>;

export const isColorOnly = (image: ImageRef): boolean =>
  image.source === 'legacy' || image.localUri === LEGACY_IMAGE_URI;

/** Everything the extraction produced, unchanged from v1's `Palette`. */
export const memoryPaletteSchema = z.object({
  colors: z.array(colorSchema).min(2).max(8),
  deltaE: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  space: colorSpaceSchema,
  tuned: z.boolean(),
  source: paletteSourceSchema,
});

export type MemoryPalette = z.infer<typeof memoryPaletteSchema>;

export const savedLocationSchema = z.object({
  /**
   * A place name, never coordinates.
   *
   * The product has no use for precision that a person would not say out loud,
   * and storing what we cannot justify is how location data leaks. "Hà Nội" is
   * the memory; 21.0285, 105.8542 is a liability. See docs/08.
   */
  name: z.string().trim().min(1).max(80),
});

export type SavedLocation = z.infer<typeof savedLocationSchema>;

export const personalContextSchema = z.object({
  title: z.string().trim().max(80).nullable(),
  note: z.string().trim().max(500).nullable(),
  /** What the user said the moment felt like. Never inferred on their behalf. */
  mood: z.string().trim().max(40).nullable(),
  tags: z.array(z.string().trim().min(1).max(24)).max(8),
  location: savedLocationSchema.nullable(),
});

export type PersonalContext = z.infer<typeof personalContextSchema>;

export const emptyPersonalContext: PersonalContext = {
  title: null,
  note: null,
  mood: null,
  tags: [],
  location: null,
};

/**
 * Precomputed scalars, so filtering never touches colour maths.
 *
 * This exists because of a measured problem: the library's month grouping runs
 * ΔE00 comparisons on the render path, which is roughly a million trigonometric
 * calls per recompute on a 500-item library — and it recomputes on every search
 * keystroke. Filters would multiply that. Denormalised data that drifts is worse
 * than a slow filter, so `deriveFacets` is the only writer and a test asserts
 * every stored memory's facets still match its palette.
 */
export const memoryFacetsSchema = z.object({
  dominantHue: z.number().min(0).max(360),
  dominantHex: hexSchema,
  warmth: z.number().min(-1).max(1),
  energy: z.number().min(0).max(1),
  luminosity: z.number().min(0).max(1),
  mood: atmosphereMoodSchema,
  paired: z.boolean(),
  genres: z.array(z.string().min(1).max(32)).max(5),
  /** `2026-08` — groups and sorts without constructing a Date per comparison. */
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
});

export type MemoryFacets = z.infer<typeof memoryFacetsSchema>;

export const chromaticMemorySchema = z
  .object({
    schemaVersion: z.literal(2),
    id: z.string().uuid(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    capturedAt: z.iso.datetime(),

    image: imageRefSchema,
    palette: memoryPaletteSchema,
    /** Computed, so never null. Contrast with `visualAnalysis`, which needs a network. */
    atmosphere: atmosphereReadingSchema,
    visualAnalysis: visualAnalysisSchema.nullable(),
    musicPairing: musicPairingSchema,
    personalContext: personalContextSchema,
    facets: memoryFacetsSchema,

    collectionIds: z.array(z.string().uuid()).max(50),
    isPinned: z.boolean(),
  })
  .superRefine((memory, context) => {
    // Carried over from v1's `paletteSchema`: every proportional band in the app
    // divides by this, and a palette whose weights do not sum to one draws wrong.
    const total = memory.palette.colors.reduce((sum, color) => sum + color.weight, 0);
    if (Math.abs(total - 1) > 0.02) {
      context.addIssue({
        code: 'custom',
        message: 'Colour weights must sum to one.',
        path: ['palette', 'colors'],
      });
    }
    // 'extra' repeats by design; the three named roles are singular.
    const named = memory.palette.colors.map((c) => c.role).filter((role) => role !== 'extra');
    if (new Set(named).size !== named.length) {
      context.addIssue({
        code: 'custom',
        message: 'Each named role may be assigned to at most one colour.',
        path: ['palette', 'colors'],
      });
    }
    // A pairing that says it is paired and carries no track would render a track
    // block with nothing in it.
    if (memory.musicPairing.status === 'paired' && memory.musicPairing.selectedTrack === null) {
      context.addIssue({
        code: 'custom',
        message: 'A paired memory must carry its track.',
        path: ['musicPairing', 'selectedTrack'],
      });
    }
    // `pending` is a runtime state. Persisting it would leave a memory stuck
    // mid-flight forever after a crash, with no process left to finish it.
    if (memory.musicPairing.status === 'pending') {
      context.addIssue({
        code: 'custom',
        message: 'Pending is a runtime state and must not be persisted.',
        path: ['musicPairing', 'status'],
      });
    }
  });

export type ChromaticMemory = z.infer<typeof chromaticMemorySchema>;

/* ------------------------------------------------------------------- facets */

/**
 * The one place facets are produced. Called on every write.
 *
 * `energy` deliberately mirrors `intent.deriveIntent`'s energy term rather than
 * inventing a second definition, so a memory filtered as "high energy" is high
 * energy by the same measure that chose its music.
 */
export function deriveFacets(input: {
  colors: readonly Color[];
  atmosphere: AtmosphereReading;
  pairing: MusicPairing;
  capturedAt: string;
}): MemoryFacets {
  const metrics = colorMetrics(input.colors);
  const dominant =
    input.colors.find((color) => color.role === 'dominant') ?? input.colors[0] ?? null;

  const energy =
    0.45 * input.atmosphere.saturation +
    0.3 * input.atmosphere.contrast +
    0.25 * input.atmosphere.spread;

  return {
    dominantHue: Math.round(metrics.dominantHue * 10) / 10,
    dominantHex: dominant?.hex ?? '#000000',
    warmth: input.atmosphere.warmth,
    energy: Math.round(Math.min(1, Math.max(0, energy)) * 1000) / 1000,
    luminosity: input.atmosphere.luminosity,
    mood: input.atmosphere.mood,
    paired: input.pairing.status === 'paired' && input.pairing.selectedTrack !== null,
    genres: input.pairing.selectedTrack?.genres.slice(0, 5) ?? [],
    monthKey: input.capturedAt.slice(0, 7),
  };
}

/* -------------------------------------------------------------------- draft */

/**
 * A memory in flight, between capture and save.
 *
 * Never persisted — the analogue of today's `captureStore.pending`, widened for
 * the stages that now sit between a palette and a saved record. Holding it as
 * one object is what lets the pairing screen show a palette while music is still
 * arriving, and what lets "Save colours only" work at any point.
 */
export type ChromaticMemoryDraft = {
  image: ImageRef;
  palette: MemoryPalette;
  atmosphere: AtmosphereReading;
  visualAnalysis: z.infer<typeof visualAnalysisSchema> | null;
  pairing: MusicPairing;
  personalContext: PersonalContext;
  capturedAt: string;
};

/**
 * The single constructor. Mirrors v1's `captureStore.toPalette`.
 *
 * Returns a parse result rather than throwing, because the caller is a save
 * button: it needs to tell the user what went wrong, not unwind.
 */
export function toChromaticMemory(
  draft: ChromaticMemoryDraft,
  input: { id: string; now?: string; collectionIds?: readonly string[] },
): z.ZodSafeParseResult<ChromaticMemory> {
  const now = input.now ?? new Date().toISOString();
  return chromaticMemorySchema.safeParse({
    schemaVersion: 2,
    id: input.id,
    createdAt: now,
    updatedAt: now,
    capturedAt: draft.capturedAt,
    image: draft.image,
    palette: draft.palette,
    atmosphere: draft.atmosphere,
    visualAnalysis: draft.visualAnalysis,
    // A draft that never reached the provider carries the runtime `pending`
    // state; it is normalised here rather than rejected, because the user
    // pressing save while music is still loading is a save, not an error.
    musicPairing:
      draft.pairing.status === 'pending'
        ? { ...draft.pairing, status: 'unpaired' as const }
        : draft.pairing,
    personalContext: draft.personalContext,
    facets: deriveFacets({
      colors: draft.palette.colors,
      atmosphere: draft.atmosphere,
      pairing: draft.pairing,
      capturedAt: draft.capturedAt,
    }),
    collectionIds: input.collectionIds ?? [],
    isPinned: false,
  });
}

/**
 * Attaches a chosen track, keeping facets and timestamps honest.
 *
 * A helper rather than a spread at the call site because three things have to
 * move together — the track, the status, and the derived facets — and the one
 * that is easy to forget is the one that silently breaks filtering.
 */
export function withSelectedTrack(
  memory: ChromaticMemory,
  track: MusicTrackReference,
  now: string = new Date().toISOString(),
): ChromaticMemory {
  const pairing: MusicPairing = {
    ...memory.musicPairing,
    status: 'paired',
    selectedTrack: track,
    pairedAt: now,
    error: null,
  };
  return {
    ...memory,
    updatedAt: now,
    musicPairing: pairing,
    facets: deriveFacets({
      colors: memory.palette.colors,
      atmosphere: memory.atmosphere,
      pairing,
      capturedAt: memory.capturedAt,
    }),
  };
}

/** The reading a memory would have if it were re-derived from its own colours. */
export const rereadAtmosphere = (memory: ChromaticMemory): AtmosphereReading =>
  readAtmosphere(memory.palette.colors, memory.palette.deltaE);

/* --------------------------------------------------------------- repository */

/** A record that would not validate, kept rather than dropped. See docs/09. */
export type StoredRecordProblem = {
  index: number;
  id: string | null;
  issues: string;
  raw: unknown;
};

export interface ChromaticMemoryRepository {
  list(): Promise<readonly ChromaticMemory[]>;
  get(id: string): Promise<ChromaticMemory | null>;
  save(memory: ChromaticMemory): Promise<void>;
  remove(id: string): Promise<void>;
  /**
   * Records that failed validation.
   *
   * Exists because v1 parsed the whole collection at once and threw on any bad
   * record, which lost the entire library rather than one item. v2 keeps what is
   * valid and *reports* what is not, so corruption is visible instead of fatal.
   */
  listInvalid(): Promise<readonly StoredRecordProblem[]>;
}

export { unpairedPairing };
