import { makeColor, type Palette } from '@chromawave/domain';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { usePalettes } from '@/hooks/usePalettes';
import { analytics, hapticsService, soundService } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';
import { useCaptureStore } from '@/store/captureStore';
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
  const { t } = usePreferences();
  const pending = useCaptureStore((state) => state.pending);
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

  const commit = useCallback(
    async (name: string) => {
      const palette = toPalette(name);
      if (!palette) return;
      await save(palette);
      void hapticsService.fire('paletteSaved');
      void soundService.play('save');
      analytics.track('palette_saved', { tuned: palette.tuned, source: palette.source });
      discard();
      router.replace(`/palette/${palette.id}`);
    },
    [toPalette, save, discard, router],
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
