import { useRouter } from 'expo-router';
import { ExportScreen } from '@/features/tools/ExportScreen';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { usePaletteParam } from '@/hooks';
import { useEntitlement, usePreferences } from '@/providers';

export default function ExportRoute() {
  const router = useRouter();
  const { t } = usePreferences();
  const { palette, loading } = usePaletteParam();
  // Semantic role names are the Pro line on this screen; the four code targets
  // themselves are not gated.
  const isPro = useEntitlement('semantic_export_names');
  // The title was the string "Export" — the only tool fallback that did not go
  // through the catalogue, and so the only one that stayed English in Vietnamese.
  if (!palette) return <ToolFallback loading={loading} title={t('export.title')} />;
  return <ExportScreen isPro={isPro} onClose={router.back} palette={palette} />;
}
