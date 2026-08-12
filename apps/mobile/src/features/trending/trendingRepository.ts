import {
  colorSignature,
  dedupeById,
  matchesQuery,
  type ColorMood,
  type VisualStyle,
} from '@cw/domain';
import { trendingItems, type TrendingCategory, type TrendingItem } from '@/data';
import type { KeyValueStorage } from '@/infrastructure/KeyValueStorage';

/**
 * The read side of the trending feed.
 *
 * Screens never touch `trendingItems` directly. Everything that would be a
 * server's job in a networked build — filtering, ordering, paging, and refusing
 * a malformed response — happens here, so the day this reads an endpoint the
 * change is this file and nothing above it.
 *
 * It is deliberately asynchronous and cancellable even though the source is a
 * local array: a screen written against a synchronous feed acquires loading and
 * error states that are lies, and then cannot be given a real one.
 */

/**
 * `featured` was `popular`, and `popular` was a lie.
 *
 * It sorted by a `saves` count that was a number somebody typed into a fixture —
 * fabricated social proof for a feed with no users behind it. Featured is the
 * order the drop was authored in, which is a real editorial decision and the
 * only ranking this content actually has.
 */
export type TrendingSort = 'featured' | 'new';

export type TrendingRequest = {
  page: number;
  pageSize: number;
  category: TrendingCategory | 'all';
  moods: readonly ColorMood[];
  styles: readonly VisualStyle[];
  search: string;
  sort: TrendingSort;
  /** Colour signatures the caller already shows elsewhere, so the feed skips them. */
  exclude?: ReadonlySet<string>;
};

export type TrendingPage = {
  items: readonly TrendingItem[];
  page: number;
  /** Matching the request, across every page — what the result count reports. */
  total: number;
  hasMore: boolean;
};

export class TrendingFeedError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TrendingFeedError';
  }
}

export const defaultTrendingRequest: TrendingRequest = {
  page: 0,
  pageSize: 8,
  category: 'all',
  moods: [],
  styles: [],
  search: '',
  sort: 'featured',
};

/**
 * Where a published drop is read from.
 *
 * A static JSON file on a CDN, not an API: this content is written by a person
 * once a week and read by everyone, which is a file, and pretending otherwise
 * would mean running a service to serve fourteen palettes. Unset — in
 * development, in CI, and in any build that ships without one — the bundled
 * catalogue is the whole feed, which is why the offline path is the default
 * path rather than an edge case nobody exercises.
 */
const DROP_URL = process.env.EXPO_PUBLIC_FIELD_NOTES_URL ?? '';
const DROP_CACHE_KEY = '@chromawave/field-notes:v1';

/** Long enough that a week's drop is fetched once; short enough to catch a fix. */
const DROP_TTL_MS = 6 * 60 * 60 * 1000;

/** How many rows the home rail shows before "SEE ALL" is the better move. */
export const HOME_TRENDING_COUNT = 6;

/**
 * The catalogue, checked once and cached.
 *
 * A feed with two rows carrying the same id renders one of them with a
 * duplicate React key and drops the other's press handler; a feed with two rows
 * carrying the same colours is a duplicate to a reader whatever the ids say.
 * Both are data faults, so both are caught here rather than patched over in a
 * renderer.
 */
let validated: readonly TrendingItem[] | null = null;

export function validateCatalogue(source: readonly TrendingItem[]): readonly TrendingItem[] {
  const unique = dedupeById(source);
  if (unique.length !== source.length) {
    throw new TrendingFeedError('The trending feed carries repeated ids.');
  }

  const signatures = new Set<string>();
  for (const item of unique) {
    if (item.colors.length < 2) {
      throw new TrendingFeedError(`"${item.name}" has fewer than two colours.`);
    }
    const signature = colorSignature(item.colors);
    if (signatures.has(signature)) {
      throw new TrendingFeedError(`"${item.name}" repeats another entry's colours.`);
    }
    signatures.add(signature);
  }
  return unique;
}

function catalogue(): readonly TrendingItem[] {
  validated ??= validateCatalogue(trendingItems);
  return validated;
}

/** Replaces the in-memory catalogue. Only a validated drop ever gets here. */
function adopt(items: readonly TrendingItem[]): void {
  validated = validateCatalogue(items);
}

type CachedDrop = { fetchedAt: number; items: readonly TrendingItem[] };

/**
 * Pulls the current drop, if this build knows where to look.
 *
 * Every failure path ends the same way — keep whatever the feed already had —
 * because a week-old drop, or the bundled one, is a better answer than an empty
 * screen. The only thing that ever replaces the catalogue is a payload that
 * passes the same validation the bundled one does, so a malformed drop cannot
 * put duplicate ids or a one-colour entry in front of anyone.
 */
export async function syncDrop(storage: KeyValueStorage): Promise<void> {
  if (!DROP_URL) return;

  const cached = await readCache(storage);
  if (cached) {
    adopt(cached.items);
    if (Date.now() - cached.fetchedAt < DROP_TTL_MS) return;
  }

  try {
    const response = await fetch(DROP_URL);
    if (!response.ok) return;
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return;
    // Cast-free: validateCatalogue rejects anything that is not a usable entry,
    // and its failure is caught here like any other.
    const items = validateCatalogue(payload as readonly TrendingItem[]);
    adopt(items);
    await storage.setItem(
      DROP_CACHE_KEY,
      JSON.stringify({ fetchedAt: Date.now(), items } satisfies CachedDrop),
    );
  } catch {
    // Offline, malformed, or rejected. The feed keeps what it has.
  }
}

async function readCache(storage: KeyValueStorage): Promise<CachedDrop | null> {
  try {
    const raw = await storage.getItem(DROP_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !('items' in parsed)) return null;
    const { items, fetchedAt } = parsed as CachedDrop;
    return { items: validateCatalogue(items), fetchedAt: Number(fetchedAt) || 0 };
  } catch {
    // A cache that cannot be read is a cache that is not there.
    return null;
  }
}

function matchesSearch(item: TrendingItem, search: string): boolean {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) return true;
  return (
    item.name.toLocaleLowerCase().includes(needle) ||
    item.blurb.toLocaleLowerCase().includes(needle) ||
    item.category.includes(needle) ||
    item.colors.some((color) => color.hex.toLocaleLowerCase().includes(needle))
  );
}

/** The whole matching set, unpaged. Exported for the counts a header reports. */
export function selectTrending(request: TrendingRequest): readonly TrendingItem[] {
  const matching = catalogue().filter(
    (item) =>
      (request.category === 'all' || item.category === request.category) &&
      matchesSearch(item, request.search) &&
      matchesQuery(item.colors, request) &&
      !request.exclude?.has(colorSignature(item.colors)),
  );

  // `featured` is the catalogue's own order, so it needs no comparator — the
  // drop is already in the sequence its editor put it in.
  return request.sort === 'new'
    ? [...matching].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    : matching;
}

/**
 * One page of the feed.
 *
 * The delay is not decoration: without it the first page resolves inside the
 * same tick the screen mounts in, the loading state never commits, and a
 * skeleton that is never seen in development is a skeleton that is broken in
 * production on a slower device.
 */
export async function fetchTrending(request: TrendingRequest): Promise<TrendingPage> {
  await new Promise((resolve) => setTimeout(resolve, FEED_LATENCY_MS));

  const matching = selectTrending(request);
  const start = request.page * request.pageSize;
  if (start < 0 || !Number.isFinite(start)) {
    throw new TrendingFeedError(`Page ${request.page} is not a page.`);
  }

  const items = matching.slice(start, start + request.pageSize);
  return {
    items,
    page: request.page,
    total: matching.length,
    hasMore: start + items.length < matching.length,
  };
}

const FEED_LATENCY_MS = 220;
