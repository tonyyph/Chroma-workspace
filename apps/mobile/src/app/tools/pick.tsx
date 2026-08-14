import { useRouter } from 'expo-router';
import { ErrorBoundary } from '@/components';
import { ImportPickScreen } from '@/features/tools/ImportPickScreen';
import { usePaletteParam, usePalettes } from '@/hooks';

/**
 * G2 · picking colours by hand, off a palette that already exists.
 *
 * This replaces `/tools/import`, which was the way *in* to the app and opened
 * the system picker from an effect. It is a tool now: reached from a palette by
 * someone who has seen the five colours it found and wants different ones.
 *
 * A palette with no photograph has nothing to sample, so there is nothing to
 * show — it goes back rather than drawing an empty canvas with live controls
 * over it.
 */
export default function PickRoute() {
  const router = useRouter();
  const { palette } = usePaletteParam();
  const { save } = usePalettes();

  if (!palette?.photoUri) return null;

  return (
    <ErrorBoundary label="Picking colours" onReset={() => router.back()}>
      <ImportPickScreen
        colors={palette.colors}
        onCancel={router.back}
        onPick={(colors) => {
          void (async () => {
            try {
              await save({ ...palette, colors: [...colors] });
            } catch {
              // The palette is unchanged and still on screen behind this. The
              // detail view reports its own write failures.
            }
            router.back();
          })();
        }}
        uri={palette.photoUri}
      />
    </ErrorBoundary>
  );
}
