import { dedupeById } from '@chromawave/domain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type TrendingItem } from '@/data';
import { fetchTrending, type TrendingRequest } from './trendingRepository';

export type TrendingStatus = 'loading' | 'ready' | 'error';

export type TrendingFeed = {
  items: readonly TrendingItem[];
  status: TrendingStatus;
  /** True while a later page is arriving, so the list keeps what it has. */
  loadingMore: boolean;
  refreshing: boolean;
  /** Matching rows across every page — what a result count reports. */
  total: number;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  retry: () => void;
};

/**
 * Pages the trending feed for one query.
 *
 * Three things here are the reason this is a hook and not a `useEffect` in a
 * screen:
 *
 *  1. **Requests race.** Changing a filter while a page is in flight lands the
 *     older response last, showing results for a filter the user has already
 *     left. Every response carries the token of the request that asked for it
 *     and is dropped if it is no longer the current one.
 *  2. **Pages merge.** Page 2 is appended to page 1, and an append is exactly
 *     where the same item can arrive twice — a refresh landing between two page
 *     reads shifts the window. The merge runs through `dedupeById`, so a shifted
 *     window drops the repeat instead of rendering it.
 *  3. **A new query resets the window.** Keeping page 3 across a filter change
 *     asks for rows 24-32 of a set that has four.
 */
export function useTrending(request: Omit<TrendingRequest, 'page'>): TrendingFeed {
  const { category, moods, styles, search, sort, pageSize, exclude } = request;

  // Every input reduced to one string. Callers rebuild `moods`, `styles` and
  // `exclude` on each render — they are derived values — so depending on their
  // identities would refetch forever.
  const queryKey = [
    category,
    moods.join(','),
    styles.join(','),
    search.trim(),
    sort,
    pageSize,
    exclude ? [...exclude].sort().join(',') : '',
  ].join('|');

  const [items, setItems] = useState<readonly TrendingItem[]>([]);
  const [status, setStatus] = useState<TrendingStatus>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  /** Bumped to re-read the same query — retry and pull-to-refresh. */
  const [attempt, setAttempt] = useState(0);

  /**
   * The window is stored *with the query it belongs to* rather than as a bare
   * page number that something has to remember to reset. A page from a previous
   * query is not a smaller page, it is a page of a different list — so it is
   * derived away here instead of being corrected after the fact by an effect,
   * which would let one commit fetch page 3 of a set that has four rows.
   */
  const [feedWindow, setFeedWindow] = useState({ key: queryKey, page: 0 });
  const page = feedWindow.key === queryKey ? feedWindow.page : 0;

  // Only the latest read may write, and the check has to see the value from the
  // render that started it rather than a stale closure.
  const token = useRef(0);

  // The request object is rebuilt on every render — `moods`, `styles` and
  // `exclude` are all derived — but it only *means* anything new when `queryKey`
  // changes, which is what this pins its identity to.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableRequest = useMemo(() => request, [queryKey]);

  useEffect(() => {
    const current = ++token.current;
    const first = page === 0;
    if (first) {
      // A refresh keeps its rows on screen; a new query has nothing to keep.
      setStatus((previous) => (previous === 'ready' ? previous : 'loading'));
    } else {
      setLoadingMore(true);
    }

    let active = true;
    void fetchTrending({ ...stableRequest, page })
      .then((result) => {
        if (!active || current !== token.current) return;
        setItems((previous) => (first ? result.items : dedupeById([...previous, ...result.items])));
        setTotal(result.total);
        setHasMore(result.hasMore);
        setStatus('ready');
      })
      .catch(() => {
        if (!active || current !== token.current) return;
        // A failed *later* page must not blank the rows already on screen.
        if (first) setStatus('error');
      })
      .finally(() => {
        if (!active || current !== token.current) return;
        setLoadingMore(false);
        setRefreshing(false);
      });

    return () => {
      active = false;
    };
  }, [stableRequest, page, attempt]);

  const loadMore = useCallback(() => {
    setFeedWindow({ key: queryKey, page: page + 1 });
  }, [page, queryKey]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setFeedWindow({ key: queryKey, page: 0 });
    setAttempt((current) => current + 1);
  }, [queryKey]);

  const retry = useCallback(() => {
    setStatus('loading');
    setFeedWindow({ key: queryKey, page: 0 });
    setAttempt((current) => current + 1);
  }, [queryKey]);

  return {
    items,
    status,
    loadingMore,
    refreshing,
    total,
    // Guarding on the in-flight page stops an onEndReached burst from asking for
    // three pages at once and getting them out of order.
    hasMore: hasMore && !loadingMore,
    loadMore,
    refresh,
    retry,
  };
}
