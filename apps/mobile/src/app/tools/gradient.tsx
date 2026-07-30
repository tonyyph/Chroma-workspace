import { useRouter } from 'expo-router';

import { GradientScreen } from '@/features/tools/GradientScreen';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { usePaletteParam } from '@/hooks/usePaletteParam';

export default function GradientRoute() {
  const router = useRouter();
  const { palette, loading } = usePaletteParam();
  if (!palette) return <ToolFallback loading={loading} title="Gradient studio" />;
  return <GradientScreen onClose={router.back} onSave={router.back} palette={palette} />;
}
