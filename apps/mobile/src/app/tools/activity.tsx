import { ActivityScreen } from '@/features/tools/ActivityScreen';
import { usePalettes } from '@/hooks/usePalettes';

export default function ActivityRoute() {
  const { palettes } = usePalettes();
  return <ActivityScreen palettes={palettes} />;
}
