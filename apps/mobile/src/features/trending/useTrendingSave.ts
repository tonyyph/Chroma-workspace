import { colorSignature, ownedSignatureIndex } from '@cw/domain';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { trendingItems, type TrendingItem } from '@/data';
import { usePalettes } from '@/hooks';

/**
 * Saving a feed entry into the library, once.
 *
 * A trending entry is fixture content, not a record the user owns. Saving copies
 * it into their library as a real palette with a fresh id, which they then own
 * outright — but that copy operation is the app's easiest place to create a
 * duplicate, and it did:
 *
 *  · The SAVE control called the copy unconditionally, so a second press made a
 *    second palette with identical colours and a different id. Nothing
 *    downstream could tell them apart, because by id they *are* different.
 *  · "Saved" lived in one screen's `useState`, so leaving Explore and coming
 *    back offered SAVE again on something already in the library.
 *
 * Both are fixed at the source rather than in a renderer. What the user owns is
 * decided by looking for the entry's colours in the library — the one property
 * the copy and the original share — so it survives a remount, a rename, and a
 * save made from a different screen. A press while a copy is already in flight
 * is dropped, which closes the double-tap window the check alone leaves open.
 */
export type TrendingSaver = {
  /** The library palette this entry was saved as, or null if it never was. */
  ownedIdFor: (item: TrendingItem) => string | null;
  /** Colour signatures already in the library, for excluding them from a feed. */
  ownedSignatures: ReadonlySet<string>;
  save: (item: TrendingItem) => Promise<string | null>;
  /** Save if needed, then navigate to the palette the user now owns. */
  open: (item: TrendingItem) => Promise<void>;
  saveFailed: boolean;
  clearSaveFailed: () => void;
};

export function useTrendingSave(): TrendingSaver {
  const router = useRouter();
  const { palettes, save: savePalette } = usePalettes();
  const [saveFailed, setSaveFailed] = useState(false);
  const inFlight = useRef(new Set<string>());

  const owned = useMemo(() => ownedSignatureIndex(trendingItems, palettes), [palettes]);

  const ownedIdFor = useCallback((item: TrendingItem) => owned.get(item.id) ?? null, [owned]);

  /**
   * The *colours* of everything already owned, not the entry ids. A screen that
   * also lists the user's own palettes uses this to drop the feed copy, so the
   * same three colours are not offered twice under two names.
   */
  const ownedSignatures = useMemo<ReadonlySet<string>>(
    () =>
      new Set(
        trendingItems
          .filter((item) => owned.has(item.id))
          .map((item) => colorSignature(item.colors)),
      ),
    [owned],
  );

  const save = useCallback(
    async (item: TrendingItem): Promise<string | null> => {
      const existing = owned.get(item.id);
      if (existing) return existing;
      if (inFlight.current.has(item.id)) return null;

      inFlight.current.add(item.id);
      const now = new Date().toISOString();
      const id = Crypto.randomUUID();
      try {
        await savePalette({
          grade: null,
          schemaVersion: 1,
          id,
          name: item.name,
          createdAt: now,
          capturedAt: now,
          source: 'photo',
          colors: [...item.colors],
          // Where it was read, kept as a tag so the copy still says where it is
          // from once it is one library card among many. The handle that used to
          // sit alongside it named nobody.
          tags: [item.category],
          location: null,
          photoUri: null,
          deltaE: 0,
          confidence: 1,
          space: 'srgb',
          tuned: false,
          setIds: [],
          isPinned: false,
        });
        return id;
      } catch {
        // A button that silently does nothing is the worst possible outcome, so
        // the failure is surfaced rather than swallowed.
        setSaveFailed(true);
        return null;
      } finally {
        inFlight.current.delete(item.id);
      }
    },
    [owned, savePalette],
  );

  const open = useCallback(
    async (item: TrendingItem) => {
      // Tapping the row opens the palette, which has to exist first — the same
      // copy the SAVE control performs, without stopping to ask.
      const id = owned.get(item.id) ?? (await save(item));
      if (id) router.push(`/palette/${id}`);
    },
    [owned, router, save],
  );

  return {
    ownedIdFor,
    ownedSignatures,
    save,
    open,
    saveFailed,
    clearSaveFailed: () => setSaveFailed(false),
  };
}
