import { describe, expect, it } from 'vitest';

import {
  colorForRole,
  filterPalettes,
  isWarm,
  makeColor,
  paletteSchema,
  readStability,
  roledColors,
  setSchema,
  shortAge,
  type Palette,
} from './palette';

const base: Palette = {
  schemaVersion: 1,
  id: '11111111-1111-4111-8111-111111111111',
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
  tags: ['dusk', 'urban', 'cool'],
  location: 'Oslo',
  photoUri: null,
  deltaE: 2.4,
  confidence: 0.94,
  space: 'srgb',
  tuned: false,
  setIds: [],
  isPinned: false,
};

describe('paletteSchema', () => {
  it('accepts the reference palette from the design document', () => {
    expect(paletteSchema.safeParse(base).success).toBe(true);
  });

  it('rejects weights that do not describe a whole image', () => {
    const result = paletteSchema.safeParse({
      ...base,
      colors: base.colors.map((c) => ({ ...c, weight: 0.5 })),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a role assigned to two swatches', () => {
    const result = paletteSchema.safeParse({
      ...base,
      colors: [makeColor('#7C5CFF', 0.5, 'dominant'), makeColor('#22D3EE', 0.5, 'dominant')],
    });
    expect(result.success).toBe(false);
  });

  it('requires uppercase hex so strips and labels never disagree', () => {
    const lower = { ...makeColor('#7C5CFF', 0.5, 'dominant'), hex: '#7c5cff' };
    expect(
      paletteSchema.safeParse({ ...base, colors: [lower, makeColor('#22D3EE', 0.5)] }).success,
    ).toBe(false);
  });

  it('rejects a colour whose rgb has drifted from its hex', () => {
    // rgb and oklch are derived; a stored colour that disagrees is corrupt.
    const drifted = {
      ...makeColor('#7C5CFF', 0.5, 'dominant'),
      rgb: { red: 0, green: 0, blue: 0 },
    };
    expect(
      paletteSchema.safeParse({ ...base, colors: [drifted, makeColor('#22D3EE', 0.5)] }).success,
    ).toBe(false);
  });

  it('allows several extras but only one of each named role', () => {
    const many = {
      ...base,
      colors: [
        makeColor('#7C5CFF', 0.4, 'dominant'),
        makeColor('#4A3AA8', 0.2),
        makeColor('#22D3EE', 0.2),
        makeColor('#FF7A5C', 0.2),
      ],
    };
    expect(paletteSchema.safeParse(many).success).toBe(true);
  });
});

describe('roles', () => {
  it('returns the three roled swatches in band order', () => {
    expect(roledColors(base).map((c) => c.hex)).toEqual(['#7C5CFF', '#4A3AA8', '#22D3EE']);
  });

  it('falls back to source order when a capture produced no roles', () => {
    const unroled = { ...base, colors: base.colors.map((c) => ({ ...c, role: 'extra' as const })) };
    expect(roledColors(unroled)).toHaveLength(3);
  });

  it('finds a swatch by role', () => {
    expect(colorForRole(base, 'signal')?.hex).toBe('#22D3EE');
    expect(
      colorForRole({ ...base, colors: [base.colors[0]!, base.colors[3]!] }, 'signal'),
    ).toBeNull();
  });
});

describe('readStability', () => {
  it('treats the document’s 2.4 as the edge of imperceptible drift', () => {
    expect(readStability(2.3)).toBe('stable');
    expect(readStability(2.4)).toBe('drifting');
    expect(readStability(9)).toBe('unstable');
  });
});

describe('library filters', () => {
  it('reads violet as cool and coral as warm', () => {
    expect(isWarm(base)).toBe(false);
    expect(
      isWarm({
        ...base,
        colors: [makeColor('#FF7A5C', 0.6, 'dominant'), makeColor('#F1E7D6', 0.4)],
      }),
    ).toBe(true);
  });

  it('returns only pinned palettes for the pinned chip', () => {
    const pinned = { ...base, id: '22222222-2222-4222-8222-222222222222', isPinned: true };
    expect(filterPalettes([base, pinned], 'pinned')).toEqual([pinned]);
    expect(filterPalettes([base, pinned], 'all')).toHaveLength(2);
  });
});

describe('shortAge', () => {
  it('matches the compact forms on the library cards', () => {
    const now = new Date('2026-07-29T18:00:00.000Z');
    expect(shortAge('2026-07-29T12:00:00.000Z', now)).toBe('TODAY');
    expect(shortAge('2026-07-27T18:00:00.000Z', now)).toBe('2D');
    expect(shortAge('2026-07-15T18:00:00.000Z', now)).toBe('2W');
    expect(shortAge('2026-05-29T18:00:00.000Z', now)).toBe('2MO');
  });
});

describe('makeColor', () => {
  it('derives rgb and oklch so the schema check can never fire in normal use', () => {
    const color = makeColor('#7c5cff', 0.4, 'dominant');
    expect(color.hex).toBe('#7C5CFF');
    expect(color.rgb).toEqual({ red: 124, green: 92, blue: 255 });
    expect(color.oklch.hue).toBeGreaterThan(270);
    expect(color.locked).toBe(false);
  });
});

describe('setSchema', () => {
  it('accepts the shared collection from C3', () => {
    const result = setSchema.safeParse({
      schemaVersion: 1,
      id: '33333333-3333-4333-8333-333333333333',
      name: 'Brand refresh moodboard',
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-29T00:00:00.000Z',
      paletteIds: ['11111111-1111-4111-8111-111111111111'],
      members: ['you', 'mira', 'dao'],
      merged: null,
    });
    expect(result.success).toBe(true);
  });
});
