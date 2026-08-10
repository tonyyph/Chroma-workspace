import { mergePalettes, paletteSignature, type Color, type Palette } from '@chromawave/domain';

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
 * Month signatures, cached on the membership that produced them.
 *
 * `mergePalettes` compares every colour against every kept colour with
 * `hexDeltaE00` — trigonometry-heavy CIEDE2000. That is roughly `5N × D/2` calls
 * per month, so a 500-palette library is on the order of a **million** calls per
 * recompute. The screen recomputes on every search keystroke, because the row
 * list derives from the filtered palettes.
 *
 * The colours of a month only change when its membership changes, so the merge
 * is keyed on exactly that: the ids in the group, plus each palette's own colour
 * signature so a retune invalidates the entry it should. Typing in the search
 * field reorders and filters groups; it does not change what any surviving group
 * is made of, which is why this turns a per-keystroke million-call merge into a
 * map lookup.
 *
 * `PaletteSet.merged` is persisted for the same reason. This is the same
 * decision applied to the path that did not have it.
 */
const signatureCache = new Map<string, readonly Color[]>();

/** Bounded so a long session cannot grow this without limit. */
const CACHE_LIMIT = 240;

function monthSignature(group: readonly Palette[]): readonly Color[] {
  // Cheap to build and exact: it changes if a palette joins, leaves, or is
  // retuned, and does not change otherwise.
  const key = group.map((palette) => `${palette.id}:${paletteSignature(palette)}`).join('|');

  const cached = signatureCache.get(key);
  if (cached) return cached;

  const merged = mergePalettes(group);
  if (signatureCache.size >= CACHE_LIMIT) {
    // Oldest first: Map preserves insertion order, so the first key is the
    // least recently added.
    const oldest = signatureCache.keys().next().value;
    if (oldest !== undefined) signatureCache.delete(oldest);
  }
  signatureCache.set(key, merged);
  return merged;
}

/** Exposed for tests and for a future "clear caches" action in You. */
export function clearMonthSignatureCache(): void {
  signatureCache.clear();
}

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
      colors: monthSignature(group),
    });
    for (const palette of group) {
      rows.push({ kind: 'palette', key: palette.id, palette });
    }
  }

  return rows;
}
