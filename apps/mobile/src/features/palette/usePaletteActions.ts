import { type Palette } from '@cw/domain';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import type { ShareOptions } from '@/features/capture/ShareSheet';
import { usePalettes } from '@/hooks';
import { persistPhoto, renderShareCard, shareFile } from '@/lib';
import { usePreferences } from '@/providers';

/**
 * Everything the detail screen can *do* to a palette, separated from how it
 * looks.
 *
 * The four actions share one rule, which is the reason they are together: each
 * is a write-then-reflect. The store is updated first and the screen only
 * follows if the write landed, because updating state first showed a rename that
 * silently did not survive the next launch. `writeFailed` is that shared outcome,
 * and it is why the actions cannot each own their own error state.
 */
export function usePaletteActions() {
  const router = useRouter();
  const { t } = usePreferences();
  const { save: savePalette, remove: removePalette } = usePalettes();
  const [writeFailed, setWriteFailed] = useState(false);

  const commit = useCallback(
    async (next: Palette) => {
      setWriteFailed(false);
      try {
        await savePalette(next);
      } catch {
        setWriteFailed(true);
      }
    },
    [savePalette],
  );

  const remove = useCallback(
    async (target: Palette) => {
      try {
        await removePalette(target.id);
        router.back();
      } catch {
        setWriteFailed(true);
      }
    },
    [removePalette, router],
  );

  const duplicate = useCallback(
    async (source: Palette) => {
      const now = new Date().toISOString();
      const id = Crypto.randomUUID();
      const copy: Palette = {
        ...source,
        id,
        name: t('palette.copyName', { name: source.name }),
        createdAt: now,
        // The copy gets its own file. Sharing the original's would mean deleting
        // either palette took the other's photo with it.
        photoUri: persistPhoto(source.photoUri, id),
        // The copy is a new record but the light it was read from is not, so the
        // capture time is carried over rather than reset to now.
        isPinned: false,
        setIds: [],
      };
      setWriteFailed(false);
      try {
        await savePalette(copy);
        router.replace(`/palette/${copy.id}`);
      } catch {
        setWriteFailed(true);
      }
    },
    [router, savePalette, t],
  );

  /**
   * Renders the card and hands it to the system share sheet, which is also where
   * "Save Image" lives on both platforms. Both sheet buttons land here because
   * the difference between them is a choice inside that sheet, not here.
   */
  const exportCard = useCallback(async (target: Palette, options: ShareOptions) => {
    const bytes = renderShareCard({
      palette: target,
      format: options.format,
      showHex: options.showHex,
      watermark: options.watermark,
    });
    if (!bytes) {
      // No offscreen surface means no card; the hexes are still worth having.
      void Clipboard.setStringAsync(target.colors.map((color) => color.hex).join(', '));
      setWriteFailed(true);
      return;
    }
    const slug = target.name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-');
    if ((await shareFile(bytes, `${slug}-${options.format}.png`)) === 'failed') {
      setWriteFailed(true);
    }
  }, []);

  return { commit, remove, duplicate, exportCard, writeFailed };
}
