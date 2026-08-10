import { makeColor, type Palette } from '@chromawave/domain';
import { toLibraryRows } from './libraryRows';

const at = (id: string, capturedAt: string): Palette => ({
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
