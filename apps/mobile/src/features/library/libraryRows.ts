import { mergePalettes, type Color, type Palette } from '@chromawave/domain';

/**
 * The library, cut into months.
 *
 * A personal archive of light has a natural order and it is not alphabetical or
 * "relevant" — it is when. Grouping by capture month turns a grid of things you
 * own into a record of what you were looking at, and gives each chapter a
 * colour of its own: the month's palettes merged is a fair answer to "what did
 * August look like".
 *
 * One flat array rather than a `SectionList`, so the screen keeps a single
 * recycling `FlatList`. Two nested scrollers or a section list with sticky
 * headers would both cost more than the grouping is worth.
 */
export type LibraryRow =
  | {
      kind: 'month';
      key: string;
      /** The first capture in the group, for the screen to format as a label. */
      iso: string;
      count: number;
      /** The month's own signature — every palette in it, merged. */
      colors: readonly Color[];
    }
  | { kind: 'palette'; key: string; palette: Palette };

/** `2026-08` — sorts and groups without constructing a Date per comparison. */
const monthKey = (iso: string) => iso.slice(0, 7);

/**
 * Input order is preserved, so the caller decides what "first" means. The
 * repository already returns palettes newest first, which is the order this is
 * designed to be read in.
 */
export function toLibraryRows(palettes: readonly Palette[]): readonly LibraryRow[] {
  const rows: LibraryRow[] = [];
  const groups = new Map<string, Palette[]>();
  const order: string[] = [];

  for (const palette of palettes) {
    const key = monthKey(palette.capturedAt);
    const group = groups.get(key);
    if (group) group.push(palette);
    else {
      groups.set(key, [palette]);
      order.push(key);
    }
  }

  for (const key of order) {
    const group = groups.get(key) ?? [];
    const first = group[0];
    if (!first) continue;
    rows.push({
      kind: 'month',
      key: `month:${key}`,
      iso: first.capturedAt,
      count: group.length,
      colors: mergePalettes(group),
    });
    for (const palette of group) {
      rows.push({ kind: 'palette', key: palette.id, palette });
    }
  }

  return rows;
}
