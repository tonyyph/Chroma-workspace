import { useLocalSearchParams, useRouter } from 'expo-router';
import { ErrorBoundary } from '@/components';
import { ViewfinderScreen } from '@/features/capture/ViewfinderScreen';

/**
 * The viewfinder is behind a boundary because Vision Camera's hooks throw during
 * render when the native module is unavailable — on a simulator, or after a build
 * that predates the camera being added.
 *
 * `?setId=` arrives when the capture was started from a set's gap line, and is
 * carried through to the save so the palette lands back in that project.
 */
export default function CaptureRoute() {
  const router = useRouter();
  const { setId } = useLocalSearchParams<{ setId?: string }>();
  return (
    <ErrorBoundary label="The camera" onReset={() => router.back()}>
      <ViewfinderScreen setId={setId ?? null} />
    </ErrorBoundary>
  );
}
