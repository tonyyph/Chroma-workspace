import {
  colorSignature,
  dedupeById,
  matchesQuery,
  type ColorMood,
  type VisualStyle,
} from '@chromawave/domain';
import { trendingItems, type TrendingCategory, type TrendingItem } from '@/data';

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

export type TrendingSort = 'popular' | 'new';

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
  sort: 'popular',
};

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

function matchesSearch(item: TrendingItem, search: string): boolean {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) return true;
  return (
    item.name.toLocaleLowerCase().includes(needle) ||
    item.author.toLocaleLowerCase().includes(needle) ||
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

  return request.sort === 'new'
    ? [...matching].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    : [...matching].sort((a, b) => b.saves - a.saves);
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
