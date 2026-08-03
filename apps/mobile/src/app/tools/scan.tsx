import { useRouter } from 'expo-router';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ScanScreen } from '@/features/tools/ScanScreen';
import { useCaptureStore } from '@/store/captureStore';

/**
 * G1 ends where every other capture path ends: the result sheet.
 *
 * "Build palette from N pins" used to navigate back and throw the pins away, so
 * a walk that pinned seven colours produced nothing at all.
 */
export default function ScanRoute() {
  const router = useRouter();
  const begin = useCaptureStore((state) => state.begin);

  return (
    <ErrorBoundary label="Scan mode" onReset={() => router.back()}>
      <ScanScreen
        onBuild={(colors) => {
          begin({
            colors,
            // Each pin was read from its own frame, so no single photo stands
            // for the palette.
            photoUri: null,
            deltaE: 0,
            confidence: 1,
            source: 'scan',
          });
          router.replace('/capture/result');
        }}
        onExit={router.back}
      />
    </ErrorBoundary>
  );
}
