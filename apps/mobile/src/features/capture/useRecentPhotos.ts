import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useState } from 'react';

/**
 * What the strip is doing, and therefore what it draws.
 *
 * `limited` is separated from `granted` because the two need different chrome:
 * a limited grant shows the assets the user shared *and* a way to share more,
 * which a full grant has no use for. `unavailable` is separated from `denied`
 * because "there is no photo library here" is not a decision anyone can revisit.
 */
export type RecentsState = 'unasked' | 'granted' | 'limited' | 'denied' | 'unavailable';

export type RecentPhoto = Readonly<{ id: string; uri: string }>;

const stateFor = (permission: MediaLibrary.PermissionResponse): RecentsState => {
  if (permission.granted) return permission.accessPrivileges === 'limited' ? 'limited' : 'granted';
  return permission.canAskAgain ? 'unasked' : 'denied';
};

/**
 * The newest photographs in the library, and the permission dance behind them.
 *
 * **Nothing here is a precondition.** `launchImageLibraryAsync` runs out of
 * process and needs no grant at all, so the sheet's "All photos" row works in
 * every state below, including a hard refusal. What the grant buys is one tap
 * instead of three — convenience, and the strip is free to disappear.
 *
 * **It never asks on mount.** `getPermissionsAsync` only reads the current
 * answer and shows nothing; the dialog is raised by `ask`, from a tap. A
 * permission prompt that appears because a sheet opened is one the user cannot
 * connect to anything they did, and they refuse it on that basis — permanently,
 * since iOS asks once.
 */
export function useRecentPhotos(count = 12): {
  state: RecentsState;
  photos: readonly RecentPhoto[];
  ask: () => void;
  chooseMore: () => void;
} {
  const [state, setState] = useState<RecentsState>('unasked');
  const [photos, setPhotos] = useState<readonly RecentPhoto[]>([]);

  const load = useCallback(async () => {
    try {
      const page = await MediaLibrary.getAssetsAsync({
        first: count,
        mediaType: ['photo'],
        sortBy: ['creationTime'],
      });
      setPhotos(page.assets.map((entry) => ({ id: entry.id, uri: entry.uri })));
    } catch {
      // A grant that lists nothing is still a grant. Reporting `denied` here
      // would offer the user a permission they have already given.
      setPhotos([]);
    }
  }, [count]);

  const settle = useCallback(
    async (permission: MediaLibrary.PermissionResponse) => {
      const next = stateFor(permission);
      setState(next);
      if (next === 'granted' || next === 'limited') await load();
      else setPhotos([]);
    },
    [load],
  );

  useEffect(() => {
    let live = true;
    void (async () => {
      // A simulator with no photo library, or a platform without one, answers
      // here — before any permission question is worth asking.
      if (!(await MediaLibrary.isAvailableAsync())) {
        if (live) setState('unavailable');
        return;
      }
      const permission = await MediaLibrary.getPermissionsAsync(false, ['photo']);
      if (live) await settle(permission);
    })();
    return () => {
      live = false;
    };
  }, [settle]);

  const ask = useCallback(() => {
    void (async () => {
      const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      await settle(permission);
    })();
  }, [settle]);

  const chooseMore = useCallback(() => {
    void (async () => {
      await MediaLibrary.presentPermissionsPickerAsync(['photo']);
      // iOS does not report what the user changed — the docs are explicit that
      // the picker returns nothing useful — so the strip is refetched rather
      // than left showing the selection that was just edited.
      await load();
    })();
  }, [load]);

  return { state, photos, ask, chooseMore };
}
