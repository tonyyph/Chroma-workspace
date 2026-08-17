import { useLocalSearchParams, useRouter } from 'expo-router';
import { StoryEditorScreen } from '@/features/story/StoryEditorScreen';

export default function StoryEditorRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <StoryEditorScreen
      onClose={() => router.back()}
      onPreview={() => router.push({ pathname: '/story/[id]/preview', params: { id } })}
      storyId={id}
    />
  );
}
