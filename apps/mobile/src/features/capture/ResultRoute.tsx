import { makeColor, type Palette } from '@cw/domain';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useChromaticSurface } from '@/hooks';
import { analytics } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers';
import { useCaptureStore } from '@/store';
import { Button, EmptyGlyph, Gutter, Screen, ScreenHeader, Text } from '@/ui';
import { ResultScreen } from './ResultScreen';
import { TuneScreen } from './TuneScreen';
import { useCaptureCommit } from './useCaptureCommit';

/**
 * B2 → B3. Owns the pending capture: the result sheet shows it, Tune replaces its
 * colours, and Save commits it to the library. Nothing is persisted until Save,
 * so backing out of either screen leaves the library untouched.
 */
export default function ResultRoute() {
  const router = useRouter();
  const { t } = usePreferences();
  const pending = useCaptureStore((state) => state.pending);
  const retune = useCaptureStore((state) => state.retune);
  const discard = useCaptureStore((state) => state.discard);
  const toPalette = useCaptureStore((state) => state.toPalette);
  const commitCapture = useCaptureCommit();
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
      const palette = await commitCapture(name);
      if (!palette) return;
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
       *
       * The set is read off the committed palette rather than the store: the
       * commit clears the pending capture, and `toPalette` already copied the
       * id onto `setIds`.
       */
      const set = palette.setIds[0];
      router.replace(set ? `/set/${set}` : `/pair?id=${palette.id}`);
    },
    [commitCapture, router],
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
