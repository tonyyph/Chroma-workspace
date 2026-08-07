import { describe, expect, it } from 'vitest';

import {
  colorForRole,
  filterPalettes,
  isWarm,
  makeColor,
  mergePalettes,
  MERGED_COLOR_LIMIT,
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

describe('mergePalettes', () => {
  /** Same five colours, reweighted — what re-shooting one scene actually gives. */
  const second: Palette = {
    ...base,
    id: '22222222-2222-4222-8222-222222222222',
    colors: [
      makeColor('#7C5CFF', 0.3, 'dominant'),
      makeColor('#22D3EE', 0.3, 'support'),
      makeColor('#5BC48A', 0.4, 'signal'),
    ],
  };

  it('returns nothing for no palettes', () => {
    expect(mergePalettes([])).toEqual([]);
  });

  it('keeps weights summing to one', () => {
    const merged = mergePalettes([base, second]);
    const total = merged.reduce((sum, color) => sum + color.weight, 0);
    expect(Math.abs(total - 1)).toBeLessThanOrEqual(0.02);
  });

  it('never exceeds the merged strip limit', () => {
    expect(mergePalettes([base, second, base]).length).toBeLessThanOrEqual(MERGED_COLOR_LIMIT);
  });

  it('assigns the three named roles in weight order, then extras', () => {
    const merged = mergePalettes([base, second]);
    expect(merged.map((color) => color.role).slice(0, 3)).toEqual([
      'dominant',
      'support',
      'signal',
    ]);
    expect(merged.slice(3).every((color) => color.role === 'extra')).toBe(true);
    const weights = merged.map((color) => color.weight);
    expect([...weights].sort((a, b) => b - a)).toEqual(weights);
  });

  it('collapses colours closer than the just-noticeable threshold', () => {
    // #7C5CFF and #7D5DFF are the same violet to any eye.
    const near: Palette = {
      ...base,
      id: '44444444-4444-4444-8444-444444444444',
      colors: [makeColor('#7D5DFF', 0.5, 'dominant'), makeColor('#7C5CFF', 0.5, 'support')],
    };
    expect(mergePalettes([near])).toHaveLength(1);
    expect(mergePalettes([near])[0]?.weight).toBe(1);
  });

  /**
   * The behaviour the two-palette version in `compare.tsx` got wrong. The
   * one-off colours have to be genuinely distinct from *each other* as well as
   * from the shared one, or they accumulate too — which is the same rule working,
   * not an exception to it.
   */
  it('promotes a colour that recurs across members over a one-off heavy colour', () => {
    const shared = makeColor('#22D3EE', 0.34, 'dominant');
    const recurring: Palette[] = [
      {
        ...base,
        id: '55555555-5555-4555-8555-555555555555',
        colors: [shared, makeColor('#FF3B00', 0.66, 'support')],
      },
      {
        ...base,
        id: '66666666-6666-4666-8666-666666666666',
        colors: [shared, makeColor('#5BC48A', 0.66, 'support')],
      },
      {
        ...base,
        id: '77777777-7777-4777-8777-777777777777',
        colors: [shared, makeColor('#E86AA8', 0.66, 'support')],
      },
    ];
    // 0.34 × 3 = 1.02 beats any single 0.66.
    expect(mergePalettes(recurring)[0]?.hex).toBe('#22D3EE');
  });

  it('accumulates one-off colours too when they are perceptually the same', () => {
    // Near-black greys compress in Lab: these are one colour, not three.
    const greys: Palette[] = ['#101010', '#151515', '#1A1A1A'].map((hex, index) => ({
      ...base,
      id: `8888888${index}-8888-4888-8888-888888888888`,
      colors: [makeColor('#22D3EE', 0.34, 'dominant'), makeColor(hex, 0.66, 'support')],
    }));
    expect(mergePalettes(greys)[0]?.hex).toBe('#101010');
  });

  it('does not depend on the order the palettes arrive in', () => {
    const forward = mergePalettes([base, second]).map((color) => color.hex);
    const reversed = mergePalettes([second, base]).map((color) => color.hex);
    expect([...forward].sort()).toEqual([...reversed].sort());
  });
});
