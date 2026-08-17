import { useRouter } from 'expo-router';
import { NewStoryScreen } from '@/features/story/NewStoryScreen';

/**
 * `/story/new` — a static segment, so it wins over `/story/[id]` the way
 * `/set/new` already does. Naming a story "new" would otherwise make it
 * unopenable.
 */
export default function NewStoryRoute() {
  const router = useRouter();

  return (
    <NewStoryScreen
      onClose={() => router.back()}
      onCreated={(storyId) => router.replace({ pathname: '/story/[id]', params: { id: storyId } })}
    />
  );
}
