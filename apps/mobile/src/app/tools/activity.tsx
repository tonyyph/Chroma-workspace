import { ActivityScreen } from '@/features/tools/ActivityScreen';
import { usePalettes } from '@/hooks';

export default function ActivityRoute() {
  const { palettes, refreshing, refresh } = usePalettes();
  return (
    <ActivityScreen onRefresh={() => void refresh()} palettes={palettes} refreshing={refreshing} />
  );
}
