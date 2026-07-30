import { ToolFallback } from '@/features/tools/ToolFallback';
import { WidgetsScreen } from '@/features/tools/WidgetsScreen';
import { usePaletteParam } from '@/hooks/usePaletteParam';

export default function WidgetsRoute() {
  const { palette, loading } = usePaletteParam();
  if (!palette) return <ToolFallback loading={loading} title="Widgets" />;
  return <WidgetsScreen palette={palette} />;
}
