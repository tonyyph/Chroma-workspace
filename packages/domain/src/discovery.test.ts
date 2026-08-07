import { describe, expect, it } from 'vitest';

import {
  activeFilterCount,
  colorMetrics,
  colorSignature,
  dedupeById,
  emptyQuery,
  gapKinds,
  gapThresholds,
  matchesMood,
  matchesStyle,
  moodsOf,
  moodThresholds,
  ownedSignatureIndex,
  paletteGaps,
  queryPalettes,
  styleThresholds,
  stylesOf,
  toggleIn,
} from './discovery';
import { makeColor, type Palette } from './palette';

const base: Palette = {
  schemaVersion: 1,
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Harbour dusk',
  createdAt: '2026-07-28T00:00:00.000Z',
  capturedAt: '2026-07-28T00:00:00.000Z',
  source: 'photo',
  colors: [
    makeColor('#7C5CFF', 0.38, 'dominant'),
    makeColor('#4A3AA8', 0.24, 'support'),
    makeColor('#22D3EE', 0.18, 'signal'),
    makeColor('#FF7A5C', 0.12),
    makeColor('#F1E7D6', 0.08),
  ],
  tags: ['dusk'],
  location: 'Oslo',
  photoUri: null,
  deltaE: 2.4,
  confidence: 0.94,
  space: 'srgb',
  tuned: false,
  setIds: [],
  isPinned: false,
};

const palette = (id: string, overrides: Partial<Palette> = {}): Palette => ({
  ...base,
  id,
  ...overrides,
});

/** Two hues either side of the 360→0 wrap. A naive max-minus-min reads 300°. */
const wrapping = [makeColor('#FF0033', 0.5, 'dominant'), makeColor('#FF6600', 0.5, 'support')];

describe('colorMetrics', () => {
  it('measures the hue arc across the 360 wrap rather than the raw range', () => {
    // Crimson and orange are neighbours on the wheel; the arc containing both is
    // small even though their numeric hues sit at opposite ends of 0-360.
    expect(colorMetrics(wrapping).hueSpread).toBeLessThan(90);
  });

  it('weights the averages by each colour’s share of the image', () => {
    const heavyDark = colorMetrics([
      makeColor('#000000', 0.9, 'dominant'),
      makeColor('#FFFFFF', 0.1, 'support'),
    ]);
    const heavyLight = colorMetrics([
      makeColor('#000000', 0.1, 'dominant'),
      makeColor('#FFFFFF', 0.9, 'support'),
    ]);
    expect(heavyDark.meanLightness).toBeLessThan(heavyLight.meanLightness);
    // The range is a property of the extremes, so it is the same either way.
    expect(heavyDark.lightnessRange).toBeCloseTo(heavyLight.lightnessRange, 5);
  });

  it('normalises weights that do not sum to one', () => {
    const raw = colorMetrics([makeColor('#7C5CFF', 4, 'dominant'), makeColor('#7C5CFF', 4)]);
    expect(raw.meanLightness).toBeGreaterThan(0);
    expect(raw.meanLightness).toBeLessThanOrEqual(1);
  });

  it('reports nothing for an empty colour list rather than dividing by zero', () => {
    expect(colorMetrics([]).colorCount).toBe(0);
    expect(Number.isNaN(colorMetrics([]).meanChroma)).toBe(false);
  });
});

describe('colour moods', () => {
  it('splits warm from cool on the dominant hue', () => {
    expect(matchesMood(base.colors, 'cool')).toBe(true);
    expect(matchesMood(base.colors, 'warm')).toBe(false);
    expect(matchesMood([makeColor('#FF7A5C', 1, 'dominant')], 'warm')).toBe(true);
  });

  it('calls a light, desaturated palette pastel and a saturated one vibrant', () => {
    const pastel = [
      makeColor('#F6E3E7', 0.5, 'dominant'),
      makeColor('#E4EEF2', 0.3, 'support'),
      makeColor('#F2EEDF', 0.2, 'signal'),
    ];
    expect(matchesMood(pastel, 'pastel')).toBe(true);
    expect(matchesMood(pastel, 'vibrant')).toBe(false);

    const vibrant = [
      makeColor('#FF0055', 0.5, 'dominant'),
      makeColor('#00E0FF', 0.3, 'support'),
      makeColor('#FFD500', 0.2, 'signal'),
    ];
    expect(matchesMood(vibrant, 'vibrant')).toBe(true);
    expect(matchesMood(vibrant, 'pastel')).toBe(false);
  });

  it('calls one hue family monochrome, and greys monochrome too', () => {
    const oneFamily = [
      makeColor('#1B2A6B', 0.5, 'dominant'),
      makeColor('#3A54B8', 0.3, 'support'),
      makeColor('#7C90E8', 0.2, 'signal'),
    ];
    expect(matchesMood(oneFamily, 'monochrome')).toBe(true);

    const greys = [
      makeColor('#111111', 0.5, 'dominant'),
      makeColor('#888888', 0.3, 'support'),
      makeColor('#EEEEEE', 0.2, 'signal'),
    ];
    expect(matchesMood(greys, 'monochrome')).toBe(true);

    expect(matchesMood(base.colors, 'monochrome')).toBe(false);
  });

  it('places every palette in at least one mood, so no palette is unreachable', () => {
    expect(moodsOf(base.colors).length).toBeGreaterThan(0);
    expect(moodsOf([makeColor('#FFC24A', 1, 'dominant')]).length).toBeGreaterThan(0);
  });
});

describe('visual styles', () => {
  it('calls a two-colour palette minimal and a five-hue one not', () => {
    expect(
      matchesStyle([makeColor('#0C0B18', 0.6, 'dominant'), makeColor('#EDEAE3', 0.4)], 'minimal'),
    ).toBe(true);
    expect(matchesStyle(base.colors, 'minimal')).toBe(false);
  });

  it('calls a paper-and-ink palette editorial', () => {
    const editorial = [
      makeColor('#111111', 0.45, 'dominant'),
      makeColor('#F7F4EC', 0.45, 'support'),
      makeColor('#8A3B2E', 0.1, 'signal'),
    ];
    expect(matchesStyle(editorial, 'editorial')).toBe(true);
  });

  it('separates muted amber from full-strength cyan', () => {
    const retro = [
      makeColor('#C4623B', 0.5, 'dominant'),
      makeColor('#E0C08A', 0.3, 'support'),
      makeColor('#5C3A2E', 0.2, 'signal'),
    ];
    expect(matchesStyle(retro, 'retro')).toBe(true);
    expect(matchesStyle(retro, 'futuristic')).toBe(false);

    const futuristic = [
      makeColor('#00E5FF', 0.5, 'dominant'),
      makeColor('#7C5CFF', 0.3, 'support'),
      makeColor('#0B0A16', 0.2, 'signal'),
    ];
    expect(matchesStyle(futuristic, 'futuristic')).toBe(true);
    expect(matchesStyle(futuristic, 'retro')).toBe(false);
  });

  it('calls held-back greens organic', () => {
    const organic = [
      makeColor('#6E7F4F', 0.5, 'dominant'),
      makeColor('#B8B08A', 0.3, 'support'),
      makeColor('#2E3524', 0.2, 'signal'),
    ];
    expect(stylesOf(organic)).toContain('organic');
  });
});

describe('query', () => {
  it('narrows across groups and widens within one', () => {
    const cool = palette('22222222-2222-4222-8222-222222222222');
    const warm = palette('33333333-3333-4333-8333-333333333333', {
      colors: [makeColor('#FF7A5C', 0.6, 'dominant'), makeColor('#FFC24A', 0.4, 'support')],
    });

    // Within a group: warm OR cool returns both.
    expect(queryPalettes([cool, warm], { ...emptyQuery, moods: ['warm', 'cool'] })).toHaveLength(2);
    // One mood narrows to that mood.
    expect(queryPalettes([cool, warm], { ...emptyQuery, moods: ['warm'] })).toEqual([warm]);
    // Across groups: a mood that matches and a style that does not returns nothing.
    expect(
      queryPalettes([cool, warm], { ...emptyQuery, moods: ['warm'], styles: ['futuristic'] }),
    ).toEqual([]);
  });

  it('applies the base filter as well as the derived axes', () => {
    const pinned = palette('44444444-4444-4444-8444-444444444444', { isPinned: true });
    const loose = palette('55555555-5555-4555-8555-555555555555');
    expect(queryPalettes([pinned, loose], { ...emptyQuery, base: 'pinned' })).toEqual([pinned]);
  });

  it('matches search against name, tag and hex', () => {
    const tagged = palette('66666666-6666-4666-8666-666666666666', {
      name: 'Rooftop',
      tags: ['brutal'],
    });
    expect(queryPalettes([tagged], { ...emptyQuery, search: 'roof' })).toHaveLength(1);
    expect(queryPalettes([tagged], { ...emptyQuery, search: 'brut' })).toHaveLength(1);
    expect(queryPalettes([tagged], { ...emptyQuery, search: '7c5cff' })).toHaveLength(1);
    expect(queryPalettes([tagged], { ...emptyQuery, search: 'nothing' })).toHaveLength(0);
  });

  it('never returns the same palette twice, however the input was merged', () => {
    const one = palette('77777777-7777-4777-8777-777777777777');
    expect(queryPalettes([one, one, { ...one }], emptyQuery)).toHaveLength(1);
  });

  it('counts what is active so the reset affordance can be honest', () => {
    expect(activeFilterCount(emptyQuery)).toBe(0);
    expect(
      activeFilterCount({ base: 'pinned', moods: ['warm'], styles: ['retro'], search: ' x ' }),
    ).toBe(4);
    // Whitespace is not a search.
    expect(activeFilterCount({ ...emptyQuery, search: '   ' })).toBe(0);
  });

  it('toggles a value in and out without mutating the source array', () => {
    const moods = ['warm'] as const;
    expect(toggleIn(moods, 'cool')).toEqual(['cool', 'warm']);
    expect(toggleIn(moods, 'warm')).toEqual([]);
    expect(moods).toEqual(['warm']);
  });
});

describe('deduplication', () => {
  it('keeps the first occurrence and the original order', () => {
    const items = [{ id: 'b' }, { id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(dedupeById(items).map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });

  it('does not merge two records that merely share a name', () => {
    const first = palette('88888888-8888-4888-8888-888888888888', { name: 'Same' });
    const second = palette('99999999-9999-4999-8999-999999999999', { name: 'Same' });
    expect(dedupeById([first, second])).toHaveLength(2);
  });

  it('reads a colour signature independent of band order', () => {
    expect(colorSignature([makeColor('#FFC24A', 0.5), makeColor('#22D3EE', 0.5)])).toBe(
      colorSignature([makeColor('#22D3EE', 0.5), makeColor('#FFC24A', 0.5)]),
    );
  });

  it('finds the library copy of a feed entry the user already saved', () => {
    const feed = [
      { id: 'chlorine-haze', colors: base.colors },
      { id: 'not-saved', colors: [makeColor('#123456', 1, 'dominant')] },
    ];
    const owned = ownedSignatureIndex(feed, [base]);
    expect(owned.get('chlorine-haze')).toBe(base.id);
    expect(owned.has('not-saved')).toBe(false);
  });

  it('keeps the earliest copy when a palette was saved twice', () => {
    const later = palette('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const owned = ownedSignatureIndex([{ id: 'feed', colors: base.colors }], [base, later]);
    expect(owned.get('feed')).toBe(base.id);
  });
});

describe('paletteGaps', () => {
  const kinds = (colors: Parameters<typeof paletteGaps>[0]) =>
    paletteGaps(colors).map((gap) => gap.kind);

  it('reports nothing for no colours rather than three gaps', () => {
    expect(paletteGaps([])).toEqual([]);
  });

  it('finds no gap in a system that has range, an accent and a legal pairing', () => {
    // Near-black to near-white carries its own contrast; the cyan is the accent.
    expect(
      kinds([
        makeColor('#0C0B18', 0.5, 'dominant'),
        makeColor('#EDEAE3', 0.3, 'support'),
        makeColor('#22D3EE', 0.2, 'signal'),
      ]),
    ).toEqual([]);
  });

  it('reports a missing signal when nothing is saturated enough to be an accent', () => {
    const greys = [
      makeColor('#1A1A1A', 0.4, 'dominant'),
      makeColor('#8A8A8A', 0.3, 'support'),
      makeColor('#F0F0F0', 0.3, 'signal'),
    ];
    expect(kinds(greys)).toContain('missing-signal');
    // …but greys spanning black to white are not short of range or pairings.
    expect(kinds(greys)).not.toContain('narrow-lightness');
    expect(kinds(greys)).not.toContain('no-safe-pairing');
  });

  it('uses peak chroma, so one accent among muted colours is not a missing signal', () => {
    expect(
      kinds([
        makeColor('#1A1A1A', 0.4, 'dominant'),
        makeColor('#8A8A8A', 0.3, 'support'),
        makeColor('#FF3B00', 0.3, 'signal'),
      ]),
    ).not.toContain('missing-signal');
  });

  it('reports narrow lightness when every colour sits at the same level', () => {
    expect(
      kinds([
        makeColor('#7C5CFF', 0.4, 'dominant'),
        makeColor('#5C7CFF', 0.3, 'support'),
        makeColor('#5CFF7C', 0.3, 'signal'),
      ]),
    ).toContain('narrow-lightness');
  });

  it('reports no safe pairing when no two members clear AA', () => {
    const gaps = paletteGaps([
      makeColor('#7C5CFF', 0.5, 'dominant'),
      makeColor('#8F73FF', 0.5, 'support'),
    ]);
    expect(gaps.map((gap) => gap.kind)).toContain('no-safe-pairing');
    expect(gaps.find((gap) => gap.kind === 'no-safe-pairing')?.threshold).toBe(
      gapThresholds.contrastAA,
    );
  });

  it('treats a single colour as having no pairing at all', () => {
    const gaps = paletteGaps([makeColor('#7C5CFF', 1, 'dominant')]);
    expect(gaps.map((gap) => gap.kind)).toContain('no-safe-pairing');
    expect(gaps.find((gap) => gap.kind === 'no-safe-pairing')?.measured).toBe(1);
  });

  it('reports gaps in a stable order so the screen does not reshuffle', () => {
    const gaps = kinds([makeColor('#7C5CFF', 1, 'dominant')]);
    expect(gaps).toEqual(gapKinds.filter((kind) => gaps.includes(kind)));
  });

  it('borrows its thresholds from the vocabulary the filters already use', () => {
    expect(gapThresholds.signalChroma).toBe(moodThresholds.vibrantChroma);
    expect(gapThresholds.lightnessRange).toBe(styleThresholds.editorialLightnessRange);
  });
});
