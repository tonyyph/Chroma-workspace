import { makeColor } from '@chromawave/domain';
import { ContrastScreen } from '@/features/tools/ContrastScreen';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { usePaletteParam } from '@/hooks/usePaletteParam';
import { usePalettes } from '@/hooks/usePalettes';
import { usePreferences } from '@/providers/PreferencesProvider';

export default function ContrastRoute() {
  const { palette, loading } = usePaletteParam();
  const { save } = usePalettes();
  const { t } = usePreferences();

  if (!palette) return <ToolFallback loading={loading} title={t('contrast.title')} />;

  return (
    <ContrastScreen
      onApplyFix={(from, to) => {
        // The fix replaces one colour in place — role, weight and lock all carry
        // over, so the palette's composition is unchanged apart from the hex.
        const colors = palette.colors.map((color) =>
          color.hex === from ? makeColor(to, color.weight, color.role, color.locked) : color,
        );
        void save({ ...palette, colors, tuned: true });
      }}
      palette={palette}
    />
  );
}
