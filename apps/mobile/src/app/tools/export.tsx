import { useRouter } from 'expo-router';

import { ExportScreen } from '@/features/tools/ExportScreen';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { usePaletteParam } from '@/hooks/usePaletteParam';

export default function ExportRoute() {
  const router = useRouter();
  const { palette, loading } = usePaletteParam();
  if (!palette) return <ToolFallback loading={loading} title="Export" />;
  return <ExportScreen isPro={false} onClose={router.back} palette={palette} />;
}
