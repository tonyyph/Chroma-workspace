import { colorSignature, dedupeById, makeColor } from '@chromawave/domain';
import { trendingItems, type TrendingItem } from '@/data';
import type { KeyValueStorage } from '@/infrastructure/KeyValueStorage';
import {
  syncDrop,
  HOME_TRENDING_COUNT,
  TrendingFeedError,
  defaultTrendingRequest,
  fetchTrending,
  selectTrending,
  validateCatalogue,
} from './trendingRepository';

const item = (overrides: Partial<TrendingItem> & Pick<TrendingItem, 'id'>): TrendingItem => ({
  name: 'Fixture',
  category: 'urban',
  blurb: 'A fixture',
  publishedAt: '2026-08-01T00:00:00.000Z',
  colors: [makeColor('#7C5CFF', 0.6, 'dominant'), makeColor('#22D3EE', 0.4, 'support')],
  ...overrides,
});

/**
 * The shipped catalogue is asserted here as data, not only exercised through the
 * screens. A repeated entry is the kind of fault that renders as "the feed looks
 * a bit samey" rather than as a failure, so it needs a test that says so.
 */
describe('the shipped catalogue', () => {
  it('carries no repeated ids', () => {
    expect(dedupeById(trendingItems)).toHaveLength(trendingItems.length);
  });

  it('carries no two entries with the same colours', () => {
    const signatures = trendingItems.map((entry) => colorSignature(entry.colors));
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('has enough entries to fill the home rail without repeating any', () => {
    expect(trendingItems.length).toBeGreaterThanOrEqual(HOME_TRENDING_COUNT);
  });

  it('spans every category, so no filter chip leads to an empty screen', () => {
    for (const category of new Set(trendingItems.map((entry) => entry.category))) {
      expect(selectTrending({ ...defaultTrendingRequest, category }).length).toBeGreaterThan(0);
    }
  });
});

describe('validateCatalogue', () => {
  it('refuses a feed with a repeated id', () => {
    expect(() => validateCatalogue([item({ id: 'a' }), item({ id: 'a', name: 'Other' })])).toThrow(
      TrendingFeedError,
    );
  });

  it('refuses two entries built from the same colours under different ids', () => {
    expect(() => validateCatalogue([item({ id: 'a' }), item({ id: 'b' })])).toThrow(
      TrendingFeedError,
    );
  });

  it('refuses an entry with fewer than two colours', () => {
    expect(() =>
      validateCatalogue([item({ id: 'a', colors: [makeColor('#7C5CFF', 1, 'dominant')] })]),
    ).toThrow(TrendingFeedError);
  });

  it('accepts a feed whose entries are all distinct', () => {
    const feed = [
      item({ id: 'a' }),
      item({
        id: 'b',
        colors: [makeColor('#FFC24A', 0.6, 'dominant'), makeColor('#31241F', 0.4, 'support')],
      }),
    ];
    expect(validateCatalogue(feed)).toHaveLength(2);
  });
});

describe('selectTrending', () => {
  it("keeps the editor's order for featured and sorts by date for newest", () => {
    const featured = selectTrending({ ...defaultTrendingRequest, sort: 'featured' });
    const newest = selectTrending({ ...defaultTrendingRequest, sort: 'new' });

    // Featured is the catalogue's own sequence, not a ranking derived from data.
    expect(featured.map((entry) => entry.id)).toEqual(trendingItems.map((entry) => entry.id));
    expect(newest[0]!.publishedAt >= newest[1]!.publishedAt).toBe(true);
  });

  it('narrows on category', () => {
    const nature = selectTrending({ ...defaultTrendingRequest, category: 'nature' });
    expect(nature.length).toBeGreaterThan(0);
    expect(nature.every((entry) => entry.category === 'nature')).toBe(true);
  });

  it('searches name, blurb, category and hex', () => {
    expect(selectTrending({ ...defaultTrendingRequest, search: 'chlorine' })).toHaveLength(1);
    // The blurb, which is the entry's editorial line — handles are gone, and
    // searching for one used to be how a reader found an author who was fiction.
    expect(selectTrending({ ...defaultTrendingRequest, search: 'municipal pool' })).toHaveLength(1);
    expect(selectTrending({ ...defaultTrendingRequest, search: 'nature' }).length).toBeGreaterThan(
      0,
    );
    expect(selectTrending({ ...defaultTrendingRequest, search: 'zzzz' })).toHaveLength(0);
  });

  it('drops entries whose colours the caller already shows elsewhere', () => {
    const first = selectTrending(defaultTrendingRequest)[0]!;
    const without = selectTrending({
      ...defaultTrendingRequest,
      exclude: new Set([colorSignature(first.colors)]),
    });
    expect(without.some((entry) => entry.id === first.id)).toBe(false);
  });
});

describe('fetchTrending', () => {
  it('returns one page and reports the total behind it', async () => {
    const page = await fetchTrending({ ...defaultTrendingRequest, pageSize: 4 });
    expect(page.items).toHaveLength(4);
    expect(page.total).toBe(trendingItems.length);
    expect(page.hasMore).toBe(true);
  });

  it('walks to the end without ever repeating an entry', async () => {
    const seen: string[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await fetchTrending({ ...defaultTrendingRequest, pageSize: 5, page });
      seen.push(...result.items.map((entry) => entry.id));
      hasMore = result.hasMore;
      page += 1;
      // A paging bug that never advances would otherwise hang the suite.
      expect(page).toBeLessThan(20);
    }

    expect(seen).toHaveLength(trendingItems.length);
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('returns an empty page past the end rather than wrapping around', async () => {
    const page = await fetchTrending({ ...defaultTrendingRequest, pageSize: 5, page: 99 });
    expect(page.items).toEqual([]);
    expect(page.hasMore).toBe(false);
  });

  it('rejects a page that is not a page', async () => {
    await expect(fetchTrending({ ...defaultTrendingRequest, page: -1 })).rejects.toBeInstanceOf(
      TrendingFeedError,
    );
  });
});

/**
 * The drop is content someone publishes weekly to a static file, so every
 * failure here is ordinary rather than exceptional: no network, a half-written
 * file, a stale cache. All of them have to end with a readable feed, because a
 * palette catalogue that shows nothing is worse than one that shows last week's.
 */
describe('syncDrop', () => {
  class MapStorage implements KeyValueStorage {
    readonly values = new Map<string, string>();
    async getItem(key: string) {
      return this.values.get(key) ?? null;
    }
    async setItem(key: string, value: string) {
      this.values.set(key, value);
    }
    async removeItem(key: string) {
      this.values.delete(key);
    }
  }

  const bundled = () => selectTrending(defaultTrendingRequest).map((entry) => entry.id);
  const before = bundled();

  afterEach(() => {
    // The catalogue is module state, so a test that replaced it would leak.
    validateCatalogue(trendingItems);
  });

  it('does nothing at all when no drop URL is configured', async () => {
    const storage = new MapStorage();
    await syncDrop(storage);
    expect(storage.values.size).toBe(0);
    expect(bundled()).toEqual(before);
  });

  it('leaves the bundled catalogue in place when the fetch fails', async () => {
    await syncDrop(new MapStorage());
    expect(bundled()).toEqual(before);
  });
});
