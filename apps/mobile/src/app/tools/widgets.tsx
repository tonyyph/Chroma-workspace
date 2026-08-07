import { useRouter } from 'expo-router';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { WidgetsScreen } from '@/features/tools/WidgetsScreen';
import { usePaletteParam } from '@/hooks';
import { usePreferences } from '@/providers';

export default function WidgetsRoute() {
  const { palette, loading } = usePaletteParam();
  const router = useRouter();
  const { t } = usePreferences();
  if (!palette) return <ToolFallback loading={loading} title={t('palette.widgets')} />;
  return <WidgetsScreen onClose={router.back} palette={palette} />;
}
