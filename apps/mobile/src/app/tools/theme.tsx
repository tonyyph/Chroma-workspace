import { useRouter } from 'expo-router';

import { ApplyThemeScreen } from '@/features/tools/ApplyThemeScreen';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { usePaletteParam } from '@/hooks/usePaletteParam';

export default function ThemeRoute() {
  const router = useRouter();
  const { palette, loading } = usePaletteParam();
  if (!palette) return <ToolFallback loading={loading} title="See it applied" />;
  return (
    <ApplyThemeScreen
      onExport={() => router.push(`/tools/export?id=${palette.id}`)}
      palette={palette}
    />
  );
}
