import { makeColor, type Palette } from '@chromawave/domain';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useChromaticSurface, usePalettes, useSets } from '@/hooks';
import { analytics, hapticsService, soundService } from '@/infrastructure/dependencies';
import { persistPhoto } from '@/lib';
import { usePreferences } from '@/providers';
import { useCaptureStore } from '@/store';
import { Button, EmptyGlyph, Gutter, Screen, ScreenHeader, Text } from '@/ui';
import { ResultScreen } from './ResultScreen';
import { TuneScreen } from './TuneScreen';

/**
 * B2 → B3. Owns the pending capture: the result sheet shows it, Tune replaces its
 * colours, and Save commits it to the library. Nothing is persisted until Save,
 * so backing out of either screen leaves the library untouched.
 */
export default function ResultRoute() {
  const router = useRouter();
  const { save } = usePalettes();
  const { sets, save: saveSet } = useSets();
  const { t } = usePreferences();
  const pending = useCaptureStore((state) => state.pending);
  const setId = useCaptureStore((state) => state.pending?.setId ?? null);
  const retune = useCaptureStore((state) => state.retune);
  const discard = useCaptureStore((state) => state.discard);
  const toPalette = useCaptureStore((state) => state.toPalette);
  const [tuning, setTuning] = useState(false);

  // The tune screen edits a Palette, so the pending capture is presented as one.
  // It is never written in this form — Save rebuilds it through `toPalette`.
  // Keyed on `pending` because that is what changes; `toPalette` is a stable
  // store action that reads the current state when called.
  const draft = useMemo<Palette | null>(
    () => (pending ? toPalette('Untitled capture') : null),
    [pending, toPalette],
  );

  // The field takes the reading's colour the moment it lands, so the palette is
  // already the room by the time the user decides whether to keep it.
  useChromaticSurface(draft?.colors ?? null);

  const commit = useCallback(
    async (name: string) => {
      const draft = toPalette(name);
      if (!draft) return;
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
      /**
       * Back to the project when there is one: the merged band re-proportioning
       * to include this capture is the result of the action, and landing on the
       * palette detail instead would hide it.
       *
       * Otherwise straight into pairing. The save already produced a complete
       * Chromatic Memory — `MemoryBackedPaletteRepository` widens a palette the
       * memory store has never seen — so this is not "finish the record", it is
       * the second half of what the product is for. Backing out of that screen
       * lands on the memory, which is a finished thing either way.
       */
      router.replace(target ? `/set/${target.id}` : `/pair?id=${palette.id}`);
    },
    [toPalette, save, sets, saveSet, setId, discard, router],
  );

  if (!pending || !draft) {
    return (
      <Screen>
        <Gutter>
          <ScreenHeader title={t('result.none.title')} />
          <EmptyGlyph kind="no-library" />
          <Text tone="secondary" variant="body">
            {t('result.none.body')}
          </Text>
          <Button
            label={t('result.none.action')}
            onPress={() => router.replace('/(tabs)')}
            size="xs"
          />
        </Gutter>
      </Screen>
    );
  }

  if (tuning) {
    return (
      <TuneScreen
        onApply={(next) => {
          retune(next.colors);
          next.colors.forEach((color) => {
            if (color.role !== 'extra') {
              analytics.track('palette_tuned', {
                band: color.role,
                property: 'hue',
                delta: 0,
              });
            }
          });
          setTuning(false);
        }}
        onCancel={() => setTuning(false)}
        palette={draft}
      />
    );
  }

  return (
    <ResultScreen
      onRetake={() => {
        discard();
        router.back();
      }}
      onSave={() => void commit(draft.name)}
      onTune={() => setTuning(true)}
      palette={draft}
    />
  );
}

/** Re-exported so the extractor's colour factory is reachable from one place. */
export { makeColor };
