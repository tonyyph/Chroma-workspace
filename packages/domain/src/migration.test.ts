import { describe, expect, it } from 'vitest';

import { chromaticMemorySchema, LEGACY_IMAGE_URI } from './memory';
import { memoryToPalette, migratePalettes, paletteToMemory } from './migration';
import { NEUTRAL_GRADE } from './grading';
import { makeColor, paletteSchema, type Palette } from './palette';

const uuid = (n: number) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;

function v1Palette(overrides: Partial<Palette> = {}, index = 1): Palette {
  return paletteSchema.parse({
    schemaVersion: 1,
    id: uuid(index),
    name: 'Harbour dusk',
    createdAt: '2026-07-27T18:00:00.000Z',
    capturedAt: '2026-07-27T18:00:00.000Z',
    source: 'photo',
    colors: [
      makeColor('#7C5CFF', 0.38, 'dominant'),
      makeColor('#4A3AA8', 0.24, 'support'),
      makeColor('#22D3EE', 0.18, 'signal'),
      makeColor('#FF7A5C', 0.12),
      makeColor('#F1E7D6', 0.08),
    ],
    tags: ['dusk', 'urban'],
    location: 'Oslo',
    photoUri: 'file:///photos/a.jpg',
    deltaE: 2.4,
    confidence: 0.94,
    space: 'srgb',
    tuned: false,
    setIds: [],
    isPinned: false,
    ...overrides,
  });
}

describe('paletteToMemory', () => {
  it('produces a memory that validates', () => {
    const parsed = chromaticMemorySchema.safeParse(paletteToMemory(v1Palette()));
    expect(parsed.success).toBe(true);
  });

  it('preserves the id, so existing deep links keep resolving', () => {
    const palette = v1Palette();
    expect(paletteToMemory(palette).id).toBe(palette.id);
  });

  it('carries every colour across byte for byte', () => {
    const palette = v1Palette();
    expect(paletteToMemory(palette).palette.colors).toEqual(palette.colors);
  });

  it('lands in the unpaired state, which is a complete memory not an error', () => {
    const memory = paletteToMemory(v1Palette());
    expect(memory.musicPairing.status).toBe('unpaired');
    expect(memory.musicPairing.selectedTrack).toBeNull();
    expect(memory.facets.paired).toBe(false);
  });

  it('computes an atmosphere from colours that never had one', () => {
    const memory = paletteToMemory(v1Palette());
    expect(memory.atmosphere.mood).toBeTruthy();
    // deltaE 2.4 of a 10 ceiling.
    expect(memory.atmosphere.coherence).toBeCloseTo(0.76, 2);
  });

  it('leaves visual analysis null — nothing was ever uploaded', () => {
    expect(paletteToMemory(v1Palette()).visualAnalysis).toBeNull();
  });

  it('turns a palette with no photograph into a colour-only memory', () => {
    const memory = paletteToMemory(v1Palette({ photoUri: null }));
    expect(memory.image.source).toBe('legacy');
    expect(memory.image.localUri).toBe(LEGACY_IMAGE_URI);
    expect(chromaticMemorySchema.safeParse(memory).success).toBe(true);
  });
});

describe('memoryToPalette', () => {
  it('round-trips every v1 field', () => {
    const original = v1Palette();
    expect(memoryToPalette(paletteToMemory(original))).toEqual(original);
  });

  it('round-trips a palette with no photograph', () => {
    const original = v1Palette({ photoUri: null });
    expect(memoryToPalette(paletteToMemory(original))).toEqual(original);
  });

  it('round-trips a palette carrying set membership and pins', () => {
    const original = v1Palette({ setIds: [uuid(9)], isPinned: true, location: null, tags: [] });
    expect(memoryToPalette(paletteToMemory(original))).toEqual(original);
  });

  it('still satisfies the v1 schema, so every colour tool keeps working', () => {
    const projected = memoryToPalette(paletteToMemory(v1Palette()));
    expect(paletteSchema.safeParse(projected).success).toBe(true);
  });
});

describe('migratePalettes', () => {
  it('migrates a realistic library', () => {
    const stored = Array.from({ length: 50 }, (_, index) => v1Palette({}, index + 1));
    const { memories, report } = migratePalettes({ storedPalettes: stored });

    expect(report.outcome).toBe('migrated');
    expect(report.migrated).toBe(50);
    expect(report.quarantined).toHaveLength(0);
    expect(memories).toHaveLength(50);
    expect(memories!.map((m) => m.id)).toEqual(stored.map((p) => p.id));
  });

  it('keeps the good records when one is corrupt, and quarantines the bad one', () => {
    const stored: unknown[] = Array.from({ length: 50 }, (_, index) => v1Palette({}, index + 1));
    stored[7] = { id: uuid(999), name: 'broken', colors: 'not an array' };

    const { memories, report } = migratePalettes({ storedPalettes: stored });

    expect(report.outcome).toBe('migrated');
    expect(memories).toHaveLength(49);
    expect(report.quarantined).toHaveLength(1);
    expect(report.quarantined[0]!.index).toBe(7);
    expect(report.quarantined[0]!.id).toBe(uuid(999));
    // The raw record is kept, so nothing is lost that could later be recovered.
    expect(report.quarantined[0]!.raw).toEqual(stored[7]);
    expect(report.quarantined[0]!.issues).toBeTruthy();
  });

  it('quarantines every record rather than throwing when all are corrupt', () => {
    const { memories, report } = migratePalettes({
      storedPalettes: [{ nonsense: true }, { alsoNonsense: 1 }],
    });
    expect(report.outcome).toBe('migrated');
    expect(report.quarantined).toHaveLength(2);
    expect(memories).toHaveLength(0);
  });

  it('refuses to write anything when the stored value is not an array', () => {
    const { memories, report } = migratePalettes({ storedPalettes: { not: 'an array' } });
    expect(report.outcome).toBe('aborted');
    expect(report.abortReason).toBeTruthy();
    // Null, not [] — writing an empty library would look like a success that
    // erased everything.
    expect(memories).toBeNull();
  });

  it('does nothing for a fresh install', () => {
    expect(migratePalettes({ storedPalettes: null }).report.outcome).toBe('nothing-to-do');
    expect(migratePalettes({ storedPalettes: undefined }).report.outcome).toBe('nothing-to-do');
    expect(migratePalettes({ storedPalettes: [] }).report.outcome).toBe('nothing-to-do');
    expect(migratePalettes({ storedPalettes: [] }).memories).toBeNull();
  });

  it('is idempotent — running twice produces the same memories', () => {
    const stored = Array.from({ length: 5 }, (_, index) => v1Palette({}, index + 1));
    const first = migratePalettes({ storedPalettes: stored });
    const second = migratePalettes({ storedPalettes: stored });
    expect(second.memories).toEqual(first.memories);
  });

  it('never persists the runtime pending state', () => {
    const { memories } = migratePalettes({ storedPalettes: [v1Palette()] });
    for (const memory of memories!) {
      expect(memory.musicPairing.status).not.toBe('pending');
    }
  });

  it('writes no audio URL into a serialised memory', () => {
    const { memories } = migratePalettes({ storedPalettes: [v1Palette()] });
    const json = JSON.stringify(memories);
    expect(json).not.toMatch(/\.mp3|\.m4a|\.aac|previewUrl/i);
  });
});

describe('a grade survives the round trip', () => {
  it('carries a graded palette through to a memory and back', () => {
    const graded = {
      ...v1Palette(),
      grade: { ...NEUTRAL_GRADE, temperature: 0.4, shadowTint: { hue: 245, strength: 0.3 } },
    };
    const back = memoryToPalette(paletteToMemory(graded));
    expect(back.grade).toEqual(graded.grade);
  });

  it('leaves an ungraded palette ungraded', () => {
    expect(memoryToPalette(paletteToMemory(v1Palette())).grade).toBeNull();
  });
});
