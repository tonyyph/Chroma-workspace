import { useRouter } from 'expo-router';

import { CompareScreen } from '@/features/tools/CompareScreen';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { useComparePair } from '@/hooks/usePaletteParam';

export default function CompareRoute() {
  const router = useRouter();
  const { first, second, loading } = useComparePair();
  if (!first || !second) {
    return (
      <ToolFallback body="Compare needs two saved palettes." loading={loading} title="Compare" />
    );
  }
  return (
    <CompareScreen
      first={first}
      onAddThird={() => router.back()}
      onMerge={() => router.back()}
      second={second}
    />
  );
}
