import { ContrastScreen } from '@/features/tools/ContrastScreen';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { usePaletteParam } from '@/hooks/usePaletteParam';

export default function ContrastRoute() {
  const { palette, loading } = usePaletteParam();
  if (!palette) return <ToolFallback loading={loading} title="Contrast check" />;
  return <ContrastScreen palette={palette} />;
}
