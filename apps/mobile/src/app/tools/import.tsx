import { useRouter } from 'expo-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ImportPickScreen } from '@/features/tools/ImportPickScreen';
import { useCaptureStore } from '@/store/captureStore';

/**
 * G2 feeds the same result sheet the shutter does.
 *
 * It previously called `router.back()` and dropped the colours on the floor —
 * every sample point the user placed was discarded the moment they tapped
 * EXTRACT. The pending capture is the hand-off B2 already understands.
 */
export default function ImportRoute() {
  const router = useRouter();
  const begin = useCaptureStore((state) => state.begin);

  return (
    <ErrorBoundary label="Photo import" onReset={() => router.back()}>
      <ImportPickScreen
        onCancel={router.back}
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
