import { makeColor, type Palette } from '@chromawave/domain';
import {
  byRecency,
  capturedThisMonth,
  moodTaste,
  signatureColors,
  styleTaste,
  totalColors,
} from './youInsights';

const palette = (overrides: Partial<Palette> & Pick<Palette, 'id'>): Palette => ({
  schemaVersion: 1,
  name: 'Fixture',
  createdAt: '2026-08-01T00:00:00.000Z',
  capturedAt: '2026-08-01T00:00:00.000Z',
  source: 'photo',
  colors: [makeColor('#7C5CFF', 0.6, 'dominant'), makeColor('#22D3EE', 0.4, 'support')],
  tags: [],
  location: null,
  photoUri: null,
  deltaE: 2,
  confidence: 0.9,
  space: 'srgb',
  tuned: false,
  setIds: [],
  isPinned: false,
  ...overrides,
});

describe('signatureColors', () => {
  it('takes the dominant band of each palette, most recent first', () => {
    const signature = signatureColors([
      palette({
        id: 'a',
        capturedAt: '2026-08-01T00:00:00.000Z',
        colors: [makeColor('#FFC24A', 0.7, 'dominant'), makeColor('#31241F', 0.3, 'support')],
      }),
      palette({ id: 'b', capturedAt: '2026-08-03T00:00:00.000Z' }),
    ]);
    expect(signature).toEqual(['#7C5CFF', '#FFC24A']);
  });

  it('shows a colour once however many palettes lead with it', () => {
    // This is the one place identity is the *value*: three violets say nothing
    // the first one did not, even though they are three distinct palettes.
    const signature = signatureColors([
      palette({ id: 'a' }),
      palette({ id: 'b' }),
      palette({ id: 'c' }),
    ]);
    expect(signature).toEqual(['#7C5CFF']);
  });

  it('caps the strip rather than drawing a hairline per palette', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      palette({
        id: `p${index}`,
        colors: [
          makeColor(`#${(index + 1).toString(16).padStart(2, '0')}5CFF`, 0.6, 'dominant'),
          makeColor('#22D3EE', 0.4, 'support'),
        ],
      }),
    );
    expect(signatureColors(many).length).toBeLessThanOrEqual(6);
  });

  it('returns nothing for an empty library rather than throwing', () => {
    expect(signatureColors([])).toEqual([]);
  });
});

describe('taste', () => {
  it('ranks moods by how much of the library sits in them', () => {
    const warm = palette({
      id: 'warm',
      colors: [makeColor('#FF7A5C', 0.6, 'dominant'), makeColor('#FFC24A', 0.4, 'support')],
    });
    const ranked = moodTaste([warm, warm, palette({ id: 'cool' })]);
    const warmth = ranked.find((entry) => entry.value === 'warm');

    expect(warmth?.count).toBe(2);
    expect(warmth?.share).toBeCloseTo(2 / 3, 5);
    expect(ranked.some((entry) => entry.value === 'cool' && entry.count === 1)).toBe(true);
    // Ranked descending, and a palette counts towards every mood it matches —
    // "warm and vibrant" is one palette described twice, so the counts here
    // deliberately add up to more than the library.
    expect(ranked).toEqual([...ranked].sort((a, b) => b.count - a.count));
  });

  it('leaves out moods and styles nothing matches', () => {
    const ranked = moodTaste([palette({ id: 'a' })]);
    expect(ranked.every((entry) => entry.count > 0)).toBe(true);
  });

  it('describes an empty library as having no taste rather than an even one', () => {
    expect(moodTaste([])).toEqual([]);
    expect(styleTaste([])).toEqual([]);
  });
});

describe('counts', () => {
  it('counts only captures in the current calendar month', () => {
    const now = new Date('2026-08-15T00:00:00.000Z');
    const library = [
      palette({ id: 'a', capturedAt: '2026-08-02T00:00:00.000Z' }),
      palette({ id: 'b', capturedAt: '2026-07-31T00:00:00.000Z' }),
      palette({ id: 'c', capturedAt: '2025-08-02T00:00:00.000Z' }),
    ];
    expect(capturedThisMonth(library, now)).toBe(1);
  });

  it('ignores an unparseable date rather than counting it as now', () => {
    expect(capturedThisMonth([palette({ id: 'a', capturedAt: 'not a date' })])).toBe(0);
  });

  it('sums every swatch across the library', () => {
    expect(totalColors([palette({ id: 'a' }), palette({ id: 'b' })])).toBe(4);
  });

  it('sorts by capture time, newest first, without mutating the input', () => {
    const library = [
      palette({ id: 'old', capturedAt: '2026-01-01T00:00:00.000Z' }),
      palette({ id: 'new', capturedAt: '2026-08-01T00:00:00.000Z' }),
    ];
    expect(byRecency(library).map((entry) => entry.id)).toEqual(['new', 'old']);
    expect(library.map((entry) => entry.id)).toEqual(['old', 'new']);
  });
});
