import { describe, expect, it } from 'vitest';

import { makeColor, type Color } from '../palette';
import { paletteBands } from './bands';
import {
  animateBands,
  bandsToDraw,
  effectivePhase,
  livingPaletteConfig,
  livingPaletteConfigSchema,
  livingPalettePresets,
  MAX_PERIOD_MS,
  MIN_PERIOD_MS,
  orderedColors,
  phaseAt,
  STILL_PHASE,
} from './livingPalette';

const colors: readonly Color[] = [
  makeColor('#7C5CFF', 0.5, 'dominant'),
  makeColor('#22D3EE', 0.3, 'support'),
  makeColor('#E8320C', 0.2, 'signal'),
];

const SPAN = 1000;
const still = () => paletteBands(colors, SPAN, true);

const totalLength = (bands: readonly { length: number }[]) =>
  bands.reduce((sum, band) => sum + band.length, 0);

/* ------------------------------------------------- the proportions claim */

describe('motion never changes what the palette claims', () => {
  it.each(livingPalettePresets)('preserves total covered length under %s', (preset) => {
    const config = livingPaletteConfig(preset);

    for (let step = 0; step <= 20; step += 1) {
      const bands = animateBands(still(), SPAN, config, step / 20);
      // The strip always covers exactly its span: no gap, no overflow, whatever
      // the phase. This is the invariant a "visible reset jump" would break.
      expect(totalLength(bands)).toBeCloseTo(SPAN, 6);
    }
  });

  it('preserves each colour’s share under breathe', () => {
    const config = livingPaletteConfig('pulse');
    const bands = animateBands(still(), SPAN, config, 0.37);

    // Breathing touches opacity only, so the widths are the static ones exactly.
    expect(bands.map((band) => band.length)).toEqual(still().map((band) => band.length));
  });

  it('preserves each colour’s total share under flow, across the wrap', () => {
    const config = livingPaletteConfig('rush');
    const bands = animateBands(still(), SPAN, config, 0.42);

    // A band split at the seam appears twice; its two pieces must still add up
    // to the width its weight earned.
    for (const color of colors) {
      const own = bands.filter((band) => band.hex === color.hex);
      const expected = still().find((band) => band.hex === color.hex)?.length ?? 0;
      expect(totalLength(own)).toBeCloseTo(expected, 6);
    }
  });

  it('never emits a band of zero or negative length', () => {
    for (const preset of livingPalettePresets) {
      const config = livingPaletteConfig(preset);
      for (let step = 0; step <= 40; step += 1) {
        for (const band of animateBands(still(), SPAN, config, step / 40)) {
          expect(band.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never lets a colour disappear', () => {
    const config = livingPaletteConfig('rush');
    for (let step = 0; step <= 20; step += 1) {
      for (const band of animateBands(still(), SPAN, config, step / 20)) {
        // A palette with a missing colour is a different palette.
        expect(band.opacity).toBeGreaterThan(0.3);
      }
    }
  });
});

/* ------------------------------------------------------------ determinism */

describe('determinism', () => {
  it('gives the same bands for the same phase, every time', () => {
    const config = livingPaletteConfig('flow');
    const once = animateBands(still(), SPAN, config, 0.618);
    const twice = animateBands(still(), SPAN, config, 0.618);
    expect(once).toEqual(twice);
  });

  it('wraps rather than drifting, so a cycle returns to where it began', () => {
    const config = livingPaletteConfig('flow');
    expect(animateBands(still(), SPAN, config, 1)).toEqual(animateBands(still(), SPAN, config, 0));
    expect(animateBands(still(), SPAN, config, 2.5)).toEqual(
      animateBands(still(), SPAN, config, 0.5),
    );
  });

  it('handles a negative phase without producing a negative offset', () => {
    const config = livingPaletteConfig('rush');
    for (const band of animateBands(still(), SPAN, config, -0.25)) {
      expect(band.offset).toBeGreaterThanOrEqual(0);
    }
  });

  it('survives a non-finite phase rather than emitting NaN geometry', () => {
    const config = livingPaletteConfig('calm');
    for (const band of animateBands(still(), SPAN, config, Number.NaN)) {
      expect(Number.isFinite(band.offset)).toBe(true);
      expect(Number.isFinite(band.length)).toBe(true);
    }
  });
});

/* -------------------------------------------------------- reduced motion */

describe('reduced motion', () => {
  it('pins to the still phase', () => {
    expect(effectivePhase(0.73, true)).toBe(STILL_PHASE);
    expect(effectivePhase(0.73, false)).toBeCloseTo(0.73);
  });

  it('leaves a complete composition, not a diminished one', () => {
    for (const preset of livingPalettePresets) {
      const config = livingPaletteConfig(preset);
      const bands = bandsToDraw(still(), SPAN, config, 0.4, true);

      // Every colour present, at full strength, covering the whole span. A
      // staggered breathe evaluated at phase zero would leave later bands
      // part-way dimmed — a diminished composition, not a static one.
      expect(bands).toHaveLength(colors.length);
      expect(totalLength(bands)).toBeCloseTo(SPAN, 6);
      for (const band of bands) expect(band.opacity).toBe(1);
    }
  });

  it('draws the static palette when no animation is configured', () => {
    const bands = still();
    expect(bandsToDraw(bands, SPAN, null, 0.6, false)).toBe(bands);
  });

  it('animates only when motion is allowed and configured', () => {
    const config = livingPaletteConfig('rush');
    expect(bandsToDraw(still(), SPAN, config, 0.4, false)).not.toEqual(still());
  });
});

/* -------------------------------------------------------------- presets */

describe('presets', () => {
  it.each(livingPalettePresets)('%s is a valid config', (preset) => {
    expect(livingPaletteConfigSchema.safeParse(livingPaletteConfig(preset)).success).toBe(true);
  });

  it('orders calm slowest and rush fastest', () => {
    expect(livingPaletteConfig('calm').periodMs).toBeGreaterThan(
      livingPaletteConfig('rush').periodMs,
    );
    expect(livingPaletteConfig('rush').intensity).toBeGreaterThan(
      livingPaletteConfig('calm').intensity,
    );
  });

  it('refuses a period fast enough to strobe', () => {
    const config = { ...livingPaletteConfig('rush'), periodMs: MIN_PERIOD_MS - 1 };
    expect(livingPaletteConfigSchema.safeParse(config).success).toBe(false);
  });

  it('refuses a period so slow nothing appears to happen', () => {
    const config = { ...livingPaletteConfig('calm'), periodMs: MAX_PERIOD_MS + 1 };
    expect(livingPaletteConfigSchema.safeParse(config).success).toBe(false);
  });

  it('refuses an intensity outside its range', () => {
    expect(
      livingPaletteConfigSchema.safeParse({ ...livingPaletteConfig('calm'), intensity: 1.4 })
        .success,
    ).toBe(false);
  });
});

describe('phaseAt', () => {
  it('turns elapsed time into a wrapped phase', () => {
    const config = livingPaletteConfig('flow');
    expect(phaseAt(0, config)).toBe(0);
    expect(phaseAt(config.periodMs, config)).toBe(0);
    expect(phaseAt(config.periodMs / 2, config)).toBeCloseTo(0.5);
    expect(phaseAt(config.periodMs * 3.25, config)).toBeCloseTo(0.25);
  });
});

describe('ordering', () => {
  it('reverses colours without touching any weight', () => {
    const config = { ...livingPaletteConfig('calm'), reversed: true };
    const reversed = orderedColors(colors, config);

    expect(reversed.map((color) => color.hex)).toEqual(
      [...colors].reverse().map((color) => color.hex),
    );
    // Every weight travelled with its own colour.
    for (const color of colors) {
      expect(reversed.find((entry) => entry.hex === color.hex)?.weight).toBe(color.weight);
    }
  });

  it('leaves the order alone when not reversed', () => {
    expect(orderedColors(colors, livingPaletteConfig('calm'))).toEqual(colors);
  });
});

describe('empty and degenerate input', () => {
  it('returns nothing for no bands', () => {
    expect(animateBands([], SPAN, livingPaletteConfig('flow'), 0.5)).toEqual([]);
  });

  it('returns the bands untouched for a zero span', () => {
    const bands = still();
    expect(animateBands(bands, 0, livingPaletteConfig('flow'), 0.5)).toBe(bands);
  });
});
