import { useEffect, useRef } from 'react';
import { publishWidgetSnapshot } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers';
import { useLibraryStore } from '@/store/libraryStore';

/**
 * Keeps the home screen widget in step with the library.
 *
 * **Why here rather than inside the repository's save.** A widget shows the
 * library, not one memory, so the thing worth reacting to is the library
 * *changing* — and `libraryStore` is already the one copy every screen
 * subscribes to and every write refreshes. Hanging this off the store means the
 * six different call sites that write a memory (pair, save, tune, delete, set
 * membership, migration) all publish without any of them knowing the widget
 * exists. Hanging it off `StoredMemoryRepository.save` would have published
 * mid-migration, once per record.
 *
 * Mounted once, from the navigator. The publish itself is gated on content
 * having changed — see `snapshotChanged` — so a re-render that produces the same
 * library costs one comparison and no reload.
 */
export function useWidgetSnapshot(): void {
  const { preferences } = usePreferences();
  const palettes = useLibraryStore((store) => store.palettes);
  const loaded = useLibraryStore((store) => store.loaded);
  const skin = preferences.skin;

  /**
   * One publish at a time, and the latest request wins.
   *
   * Saving three memories quickly would otherwise start three reads of the same
   * library and race to write the same file. The flag serialises them; the
   * pending flag makes sure the last state is the one that lands rather than
   * being dropped because a publish happened to be in flight.
   */
  const running = useRef(false);
  const pending = useRef(false);

  useEffect(() => {
    // Nothing before the first read completes: publishing an empty file on a
    // cold start would blank every widget for as long as the read takes, then
    // spend a second reload putting it back.
    if (!loaded) return;

    let cancelled = false;

    const run = async () => {
      if (running.current) {
        pending.current = true;
        return;
      }
      running.current = true;
      try {
        do {
          pending.current = false;
          await publishWidgetSnapshot(skin);
        } while (pending.current && !cancelled);
      } finally {
        running.current = false;
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // `palettes` is the change signal rather than a value this reads: the
    // publish goes to the memory repository for the records themselves.
  }, [loaded, palettes, skin]);
}
