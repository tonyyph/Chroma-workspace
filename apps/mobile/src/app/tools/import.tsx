import { useRouter } from 'expo-router';
import { ErrorBoundary } from '@/components';
import { useCaptureCommit } from '@/features/capture/useCaptureCommit';
import { ImportPickScreen } from '@/features/tools/ImportPickScreen';
import { useCaptureStore } from '@/store';

/**
 * G2 feeds the same result sheet the shutter does — and, when asked, skips it.
 *
 * EXTRACT hands the colours to B2, which is what someone building a palette
 * wants. MAKE CINEMATIC commits the same record and goes straight to the grade,
 * because the five steps in between are five steps someone who imported a
 * photograph to make it look like something never asked for.
 */
export default function ImportRoute() {
  const router = useRouter();
  const begin = useCaptureStore((state) => state.begin);
  const commit = useCaptureCommit();

  return (
    <ErrorBoundary label="Photo import" onReset={() => router.back()}>
      <ImportPickScreen
        onCancel={router.back}
        onCinematic={(colors, photoUri) => {
          // `begin` writes the store synchronously, and `commit` reads the
          // current state when it is called rather than closing over it — so
          // the capture is committable on the very next line.
          begin({ colors, photoUri, deltaE: 0, confidence: 1, source: 'photo' });
          void (async () => {
            const palette = await commit('Imported photo');
            // A commit that produced nothing means the read gave fewer than two
            // colours. The screen the user came from is still behind them.
            if (!palette) return;
            router.replace(`/tools/grade?id=${palette.id}`);
          })();
        }}
        onExtract={(colors, photoUri) => {
          begin({
            colors,
            photoUri,
            // The points were placed by hand, so there is no sampling drift to
            // report and no estimate to hedge — this is what was asked for.
            deltaE: 0,
            confidence: 1,
            source: 'photo',
          });
          router.replace('/capture/result');
        }}
      />
    </ErrorBoundary>
  );
}
