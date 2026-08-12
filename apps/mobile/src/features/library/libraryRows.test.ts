import { makeColor, type Palette } from '@cw/domain';
import { clearMonthSignatureCache, toLibraryRows } from './libraryRows';

const at = (id: string, capturedAt: string): Palette => ({
  thumbnailUri: null,
  grade: null,
  schemaVersion: 1,
  id,
  name: `Palette ${id}`,
  createdAt: capturedAt,
  capturedAt,
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
});

/**
 * The archive is grouped by when, so these are about the shape of the list the
 * screen renders rather than about colour. A month header arriving in the wrong
 * place, or twice, is the kind of fault that only shows up as a visual oddity
 * halfway down a long scroll.
 */
describe('toLibraryRows', () => {
  it('returns nothing for an empty archive', () => {
    expect(toLibraryRows([])).toEqual([]);
  });

  it('opens each month with a header carrying its count', () => {
    const rows = toLibraryRows([
      at('a', '2026-08-09T10:00:00.000Z'),
      at('b', '2026-08-02T10:00:00.000Z'),
      at('c', '2026-07-30T10:00:00.000Z'),
    ]);

    expect(rows.map((row) => row.kind)).toEqual([
      'month',
      'palette',
      'palette',
      'month',
      'palette',
    ]);
    expect(rows.filter((row) => row.kind === 'month').map((row) => row.count)).toEqual([2, 1]);
  });

  it('keeps the order it was given, which is the order the archive reads in', () => {
    const rows = toLibraryRows([
      at('a', '2026-08-09T10:00:00.000Z'),
      at('b', '2026-08-02T10:00:00.000Z'),
    ]);
    expect(rows.filter((row) => row.kind === 'palette').map((row) => row.key)).toEqual(['a', 'b']);
  });

  it('gives every row a key unique across headers and palettes', () => {
    const rows = toLibraryRows([
      at('a', '2026-08-09T10:00:00.000Z'),
      at('b', '2026-07-09T10:00:00.000Z'),
    ]);
    const keys = rows.map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('gives a month a signature merged from everything in it', () => {
    const rows = toLibraryRows([at('a', '2026-08-09T10:00:00.000Z')]);
    const header = rows[0];
    expect(header?.kind).toBe('month');
    if (header?.kind === 'month') {
      expect(header.colors.length).toBeGreaterThan(0);
      const total = header.colors.reduce((sum, color) => sum + color.weight, 0);
      expect(Math.abs(total - 1)).toBeLessThanOrEqual(0.02);
    }
  });

  it('separates the same month in different years', () => {
    const rows = toLibraryRows([
      at('a', '2026-08-09T10:00:00.000Z'),
      at('b', '2025-08-09T10:00:00.000Z'),
    ]);
    expect(rows.filter((row) => row.kind === 'month')).toHaveLength(2);
  });
});

/**
 * The measured problem this cache exists for: `mergePalettes` is a CIEDE2000
 * comparison of every colour against every kept colour, and the screen rebuilds
 * its rows on every search keystroke. A 500-palette library was on the order of
 * a million trigonometric calls per keypress.
 */
describe('month signatures are not recomputed on every pass', () => {
  beforeEach(() => clearMonthSignatureCache());

  const library = Array.from({ length: 40 }, (_, index) =>
    at(`p${index}`, `2026-08-${String((index % 28) + 1).padStart(2, '0')}T10:00:00.000Z`),
  );

  it('returns the identical signature array for unchanged membership', () => {
    const first = toLibraryRows(library);
    const second = toLibraryRows(library);

    const firstMonth = first.find((row) => row.kind === 'month');
    const secondMonth = second.find((row) => row.kind === 'month');

    // Reference equality: the merge did not run again.
    expect(firstMonth?.kind === 'month' && secondMonth?.kind === 'month').toBe(true);
    if (firstMonth?.kind === 'month' && secondMonth?.kind === 'month') {
      expect(secondMonth.colors).toBe(firstMonth.colors);
    }
  });

  it('recomputes when a palette joins the month', () => {
    const before = toLibraryRows(library);
    const after = toLibraryRows([...library, at('new', '2026-08-15T10:00:00.000Z')]);

    const beforeMonth = before.find((row) => row.kind === 'month');
    const afterMonth = after.find((row) => row.kind === 'month');
    if (beforeMonth?.kind === 'month' && afterMonth?.kind === 'month') {
      expect(afterMonth.colors).not.toBe(beforeMonth.colors);
      expect(afterMonth.count).toBe(beforeMonth.count + 1);
    }
  });

  it('recomputes when a palette in the month is retuned', () => {
    const before = toLibraryRows(library);
    const retuned = [
      {
        ...library[0]!,
        colors: [makeColor('#FF0000', 0.5, 'dominant'), makeColor('#00FF00', 0.5, 'support')],
      },
      ...library.slice(1),
    ];
    const after = toLibraryRows(retuned);

    const beforeMonth = before.find((row) => row.kind === 'month');
    const afterMonth = after.find((row) => row.kind === 'month');
    if (beforeMonth?.kind === 'month' && afterMonth?.kind === 'month') {
      // The signature is keyed on colours as well as ids, so a retune that keeps
      // membership identical still invalidates the entry.
      expect(afterMonth.colors).not.toBe(beforeMonth.colors);
    }
  });

  it('serves a filtered subset without recomputing the untouched months', () => {
    const july = at('july', '2026-07-01T10:00:00.000Z');
    const full = toLibraryRows([...library, july]);
    // A search that drops the July item leaves August's membership unchanged.
    const filtered = toLibraryRows(library);

    const fullAugust = full.find((row) => row.kind === 'month' && row.key === 'month:2026-08');
    const filteredAugust = filtered.find(
      (row) => row.kind === 'month' && row.key === 'month:2026-08',
    );
    if (fullAugust?.kind === 'month' && filteredAugust?.kind === 'month') {
      expect(filteredAugust.colors).toBe(fullAugust.colors);
    }
  });
});
