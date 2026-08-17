import { useRouter } from 'expo-router';
import { StoryPreviewScreen } from '@/features/story/StoryPreviewScreen';

/**
 * Reads the story from the editor's store rather than loading it again.
 *
 * Preview is only reachable from the editor, and the document there is the one
 * with the unsaved edits in it. Re-reading from storage would preview the last
 * autosave instead of what is on screen — which is the one thing a preview must
 * never do.
 */
export default function StoryPreviewRoute() {
  const router = useRouter();
  return <StoryPreviewScreen onClose={() => router.back()} />;
}
