import type { Palette } from '@cw/domain';
import { useCallback } from 'react';
import { usePalettes, useSets } from '@/hooks';
import { analytics, hapticsService, soundService } from '@/infrastructure/dependencies';
import { persistPhoto } from '@/lib';
import { useCaptureStore } from '@/store';

/**
 * Writes the pending capture to the library and hands back what was written.
 *
 * **It does not navigate.** Two callers commit a capture and they go to
 * different places afterwards: the result sheet continues into pairing or back
 * to the project it was started from, and the import path goes straight to the
 * grade. Returning the palette rather than routing is what lets one write serve
 * both, and it is the only reason this is a hook rather than a function.
 */
export function useCaptureCommit(): (name: string) => Promise<Palette | null> {
  const { save } = usePalettes();
  const { sets, save: saveSet } = useSets();
  const toPalette = useCaptureStore((state) => state.toPalette);
  const discard = useCaptureStore((state) => state.discard);

  return useCallback(
    async (name: string) => {
      const draft = toPalette(name);
      if (!draft) return null;

      /**
       * Read at call time, not through a selector.
       *
       * The import path begins a capture and commits it on the very next line,
       * inside one event handler — so a `setId` captured by the last render is
       * the value from *before* the capture existed. Today that is always null
       * and nothing breaks; the first set-scoped import would silently lose its
       * membership. `toPalette` already reads current state, and this makes the
       * whole callback consistent about it.
       */
      const setId = useCaptureStore.getState().pending?.setId ?? null;
      // The frame is still in a purgeable cache at this point. Saving the record
      // without moving the file first is how a library ends up full of palettes
      // whose photos have quietly vanished.
      const palette = { ...draft, photoUri: persistPhoto(draft.photoUri, draft.id) };
      await save(palette);

      /**
       * A capture started from a project belongs to it. Membership is written
       * here rather than left for the user to do afterwards, because the whole
       * point of the gap line is that answering it closes the gap — a palette
       * that silently missed its set would leave the same sentence on screen.
       */
      const target = setId ? (sets.find((entry) => entry.id === setId) ?? null) : null;
      if (target && !target.paletteIds.includes(palette.id)) {
        try {
          await saveSet({
            ...target,
            paletteIds: [...target.paletteIds, palette.id],
            updatedAt: new Date().toISOString(),
          });
        } catch {
          // The palette is saved and carries the set id on its own record, so
          // nothing was lost — only the set's list missed this write.
        }
      }

      void hapticsService.fire('paletteSaved');
      void soundService.play('save');
      analytics.track('palette_saved', { tuned: palette.tuned, source: palette.source });
      discard();
      return palette;
    },
    [toPalette, save, sets, saveSet, discard],
  );
}
