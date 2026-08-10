import { z } from 'zod';

import { readAtmosphere } from './atmosphere';
import { unpairedPairing } from './music';
import {
  chromaticMemorySchema,
  deriveFacets,
  emptyPersonalContext,
  LEGACY_IMAGE_URI,
  type ChromaticMemory,
  type StoredRecordProblem,
} from './memory';
import { paletteSchema, type Palette } from './palette';

/**
 * v1 palettes to v2 memories, without losing anything.
 *
 * **The hazard this is built around.** v1's repository parsed the entire stored
 * array in one call and threw on any invalid record, and `schemaVersion` is a
 * `z.literal(1)`. So a careless migration does not corrupt one palette — it
 * makes the whole library unreadable, on a device, with no undo. Two rules
 * follow and everything here is a consequence of them:
 *
 *   1. Never parse the collection as a unit. Per record, keep what is valid,
 *      quarantine what is not.
 *   2. Never write a shape the previous build cannot read, and never delete the
 *      v1 key. It is the rollback, and it costs a few hundred kilobytes.
 *
 * See docs/09 for the full plan and the eleven tests this must pass.
 */

/** Not the real dimensions — v1 never stored them. Only the aspect is meaningful. */
const LEGACY_IMAGE_SIZE = { width: 1, height: 1 } as const;

export type MigrationReport = {
  outcome: 'migrated' | 'already-current' | 'nothing-to-do' | 'aborted';
  migrated: number;
  quarantined: readonly StoredRecordProblem[];
  /** Set when `outcome` is 'aborted'. The reason no v2 data was written. */
  abortReason: string | null;
};

export type MigrationPlan = {
  report: MigrationReport;
  /**
   * What to write, or null.
   *
   * Null rather than an empty array when nothing should be written, so a caller
   * cannot confuse "abort, leave v1 alone" with "write an empty library" — the
   * second would look like a successful migration that erased everything.
   */
  memories: readonly ChromaticMemory[] | null;
};

/**
 * One v1 palette becomes one v2 memory. Total, pure, and lossless.
 *
 * The id is **preserved**, which is what keeps `palette/[id]` deep links and the
 * daily notification route working across the migration.
 */
export function paletteToMemory(palette: Palette): ChromaticMemory {
  const atmosphere = readAtmosphere(palette.colors, palette.deltaE);
  const pairing = unpairedPairing;

  const memory = {
    schemaVersion: 2 as const,
    id: palette.id,
    createdAt: palette.createdAt,
    updatedAt: palette.createdAt,
    capturedAt: palette.capturedAt,

    image: {
      // A v1 palette with no photograph becomes a colour-only memory rather than
      // being dropped or forcing `localUri` nullable for every future record.
      localUri: palette.photoUri ?? LEGACY_IMAGE_URI,
      width: LEGACY_IMAGE_SIZE.width,
      height: LEGACY_IMAGE_SIZE.height,
      source: palette.photoUri === null ? ('legacy' as const) : ('photo-library' as const),
      thumbnailUri: null,
    },

    palette: {
      colors: palette.colors,
      deltaE: palette.deltaE,
      confidence: palette.confidence,
      space: palette.space,
      tuned: palette.tuned,
      source: palette.source,
    },

    atmosphere,
    visualAnalysis: null,
    musicPairing: pairing,

    personalContext: {
      ...emptyPersonalContext,
      title: palette.name,
      tags: palette.tags,
      location: palette.location === null ? null : { name: palette.location },
    },

    facets: deriveFacets({
      colors: palette.colors,
      atmosphere,
      pairing,
      capturedAt: palette.capturedAt,
    }),

    collectionIds: palette.setIds,
    isPinned: palette.isPinned,
  };

  return memory as ChromaticMemory;
}

/**
 * A memory back to the v1 shape, so every existing colour tool keeps working.
 *
 * `mergePalettes`, `paletteGaps`, `discovery`'s search and all ten `tools/*`
 * screens are written against `Palette`. Reimplementing them against the new
 * aggregate would be a large rewrite of code that is already correct and tested,
 * so instead the repository projects. `paletteToMemory → memoryToPalette` is the
 * identity on every v1 field, and a test asserts it.
 */
export function memoryToPalette(memory: ChromaticMemory): Palette {
  const palette = {
    schemaVersion: 1 as const,
    id: memory.id,
    name: memory.personalContext.title ?? 'Untitled capture',
    createdAt: memory.createdAt,
    capturedAt: memory.capturedAt,
    source: memory.palette.source,
    colors: memory.palette.colors,
    tags: memory.personalContext.tags,
    location: memory.personalContext.location?.name ?? null,
    photoUri: memory.image.localUri === LEGACY_IMAGE_URI ? null : memory.image.localUri,
    deltaE: memory.palette.deltaE,
    confidence: memory.palette.confidence,
    space: memory.palette.space,
    tuned: memory.palette.tuned,
    setIds: memory.collectionIds,
    isPinned: memory.isPinned,
  };
  return palette as Palette;
}

export type MigrationInput = {
  /** The raw v1 value, already JSON-parsed. Anything at all; it is untrusted. */
  storedPalettes: unknown;
};

/**
 * The migration itself. Pure — the caller does the reading and writing.
 *
 * Keeping I/O out means every branch below is testable without a storage
 * double, including the ones that matter most: one corrupt record among fifty,
 * and every record corrupt.
 */
export function migratePalettes({ storedPalettes }: MigrationInput): MigrationPlan {
  const nothing = (outcome: MigrationReport['outcome'], abortReason: string | null = null) => ({
    memories: null,
    report: { outcome, migrated: 0, quarantined: [], abortReason },
  });

  if (storedPalettes === null || storedPalettes === undefined) {
    return nothing('nothing-to-do');
  }

  if (!Array.isArray(storedPalettes)) {
    // Not an array at all: something other than this app wrote the key, or it is
    // corrupt at the top level. Refusing is safer than guessing, and v1 is left
    // exactly as it was.
    return nothing('aborted', 'Stored palettes were not an array.');
  }

  if (storedPalettes.length === 0) return nothing('nothing-to-do');

  const memories: ChromaticMemory[] = [];
  const quarantined: StoredRecordProblem[] = [];

  for (const [index, raw] of storedPalettes.entries()) {
    const parsed = paletteSchema.safeParse(raw);
    if (!parsed.success) {
      quarantined.push({ index, id: readId(raw), issues: summarise(parsed.error), raw });
      continue;
    }

    /**
     * The safety interlock.
     *
     * A memory that fails validation here is *our* bug, not the user's data —
     * their palette parsed fine one line ago. Quarantining it would blame them
     * for a defect we shipped, and writing it would persist something invalid,
     * so the whole migration aborts and the app carries on reading v1.
     */
    const validated = chromaticMemorySchema.safeParse(paletteToMemory(parsed.data));
    if (!validated.success) {
      return nothing(
        'aborted',
        `Palette ${parsed.data.id} produced an invalid memory: ${summarise(validated.error)}`,
      );
    }
    memories.push(validated.data);
  }

  return {
    memories,
    report: {
      outcome: 'migrated',
      migrated: memories.length,
      quarantined,
      abortReason: null,
    },
  };
}

function readId(raw: unknown): string | null {
  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    const id = (raw as { id: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

/** Compact enough to store beside a quarantined record without bloating it. */
function summarise(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}
