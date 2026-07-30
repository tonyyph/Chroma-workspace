import { round, space, tint, ui } from '@chromawave/design-tokens';
import type { Palette } from '@chromawave/domain';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { usePreferences } from '@/providers/PreferencesProvider';
import { Button, ButtonRow, Card, Sheet, SwatchStrip, Text, Toggle } from '@/ui';

/** The four ratios the social templates ship in. */
const FORMATS = [
  { key: '1x1', labelKey: 'share.format.1x1' },
  { key: '4x5', labelKey: 'share.format.4x5' },
  { key: '9x16', labelKey: 'share.format.9x16' },
] as const;

export type ShareFormat = (typeof FORMATS)[number]['key'];

/**
 * C4 · SHARE SHEET · "format picker + Pro upsell inline".
 *
 * The watermark row is deliberately visible and disabled rather than hidden —
 * the design shows the Pro gate in place, not the feature removed.
 */
export function ShareSheet({
  palette,
  isPro,
  onShare,
  onSaveImage,
}: {
  palette: Palette;
  isPro: boolean;
  onShare: (format: ShareFormat) => void;
  onSaveImage: (format: ShareFormat) => void;
}) {
  const { t } = usePreferences();
  const [format, setFormat] = useState<ShareFormat>(FORMATS[0].key);
  const [includePhoto, setIncludePhoto] = useState(true);
  const [showHex, setShowHex] = useState(true);

  return (
    <Sheet style={styles.sheet}>
      <Text variant="section">{t('share.title', { name: palette.name })}</Text>

      <View style={styles.formats}>
        {FORMATS.map((entry) => {
          const selected = entry.key === format;
          return (
            <Card
              accessibilityLabel={t(entry.labelKey)}
              accessibilityRole="radio"
              key={entry.key}
              onPress={() => setFormat(entry.key)}
              padded={false}
              style={[styles.format, selected && styles.formatSelected]}
            >
              <View style={styles.formatPreview}>
                <SwatchStrip colors={palette.colors} height={26} />
              </View>
              <Text style={styles.formatLabel} tone={selected ? 'link' : 'tertiary'} variant="chip">
                {t(entry.labelKey)}
              </Text>
            </Card>
          );
        })}
      </View>

      <View style={styles.options}>
        <OptionRow
          label={t('share.includePhoto')}
          onChange={setIncludePhoto}
          value={includePhoto}
        />
        <OptionRow label={t('share.showHex')} onChange={setShowHex} value={showHex} />
        <OptionRow label={t('share.removeWatermark')} locked={!isPro} value={isPro} />
      </View>

      <ButtonRow>
        <Button
          label={t('share.saveImage')}
          onPress={() => onSaveImage(format)}
          style={styles.half}
          variant="secondary"
        />
        <Button label={t('share.share')} onPress={() => onShare(format)} style={styles.wide} />
      </ButtonRow>
    </Sheet>
  );
}

function OptionRow({
  label,
  value,
  onChange,
  locked = false,
}: {
  label: string;
  value: boolean;
  onChange?: (value: boolean) => void;
  locked?: boolean;
}) {
  const { t } = usePreferences();
  return (
    <Card style={styles.option}>
      <Text style={styles.optionLabel} tone={locked ? 'secondary' : 'primary'}>
        {label}
      </Text>
      {locked ? (
        <View style={[styles.pro, tint.pro]}>
          <Text style={{ color: tint.pro.color }} variant="chip">
            {t('common.pro')}
          </Text>
        </View>
      ) : (
        <Toggle label={label} onValueChange={onChange} value={value} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 0, paddingHorizontal: space.gutter, gap: space.md },
  formats: { flexDirection: 'row', gap: 10 },
  format: { flex: 1, overflow: 'hidden', paddingBottom: space.xs },
  formatSelected: { borderColor: ui.action.primary, borderWidth: 2 },
  formatPreview: {
    height: 96,
    backgroundColor: ui.bg.media,
    justifyContent: 'flex-end',
    paddingBottom: space.sm,
  },
  formatLabel: { textAlign: 'center', paddingTop: space.xs },
  options: { gap: 9 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.cardGap,
    paddingVertical: 13,
    borderRadius: round.control,
  },
  optionLabel: { fontSize: 14 },
  pro: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 },
  half: { flex: 1 },
  wide: { flex: 1.3 },
});
