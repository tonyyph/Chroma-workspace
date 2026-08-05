import { useRouter } from 'expo-router';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ViewfinderScreen } from '@/features/capture/ViewfinderScreen';

/**
 * The viewfinder is behind a boundary because Vision Camera's hooks throw during
 * render when the native module is unavailable — on a simulator, or after a build
 * that predates the camera being added.
 */
export default function CaptureRoute() {
  const router = useRouter();
  return (
    <ErrorBoundary label="The camera" onReset={() => router.back()}>
      <ViewfinderScreen />
    </ErrorBoundary>
  );
}
