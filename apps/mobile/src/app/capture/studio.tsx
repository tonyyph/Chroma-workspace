import { CameraStudioScreen } from '@/features/studio/CameraStudioScreen';

/**
 * A sibling of the viewfinder rather than a mode inside it: the two have
 * different chrome, different controls and a different second half, and folding
 * them together would mean a screen that is two screens wearing one name.
 */
export default function StudioRoute() {
  return <CameraStudioScreen />;
}
