import { space, type Skin } from '@chromawave/design-tokens';
import type { Palette } from '@chromawave/domain';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { usePreferences, useSkin } from '@/providers';
import { Button, ButtonRow, Card, Sheet, SwatchStrip, Text, Toggle, useStyles } from '@/ui';

/** The four ratios the social templates ship in. */
const FORMATS = [
  { key: '1x1', labelKey: 'share.format.1x1' },
  { key: '4x5', labelKey: 'share.format.4x5' },
  { key: '9x16', labelKey: 'share.format.9x16' },
] as const;

export type ShareFormat = (typeof FORMATS)[number]['key'];

/** What the card should contain — the three option rows, resolved. */
export type ShareOptions = {
  format: ShareFormat;
  includePhoto: boolean;
  showHex: boolean;
  /** Free cards carry the wordmark; removing it is the Pro gate. */
  watermark: boolean;
};

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
  onShare: (options: ShareOptions) => void;
  onSaveImage: (options: ShareOptions) => void;
}) {
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();
  const [format, setFormat] = useState<ShareFormat>(FORMATS[0].key);
  const [includePhoto, setIncludePhoto] = useState(true);
  const [showHex, setShowHex] = useState(true);

  const options: ShareOptions = { format, includePhoto, showHex, watermark: !isPro };

  return (
    <Sheet style={styles.sheet}>
      <Text variant="section">{t('share.title', { name: palette.name })}</Text>

      {/* The tiles preview the card at each ratio and reflect the option rows,
          so toggling "SHOW HEX" changes what is about to be exported rather
          than only what the switch looks like. */}
      <View style={styles.formats}>
        {FORMATS.map((entry) => {
          const selected = entry.key === format;
          return (
            <Card
              accessibilityLabel={t(entry.labelKey)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              key={entry.key}
              onPress={() => setFormat(entry.key)}
              padded={false}
              style={[styles.format, selected && styles.formatSelected]}
            >
              <View style={[styles.formatPreview, RATIOS[entry.key]]}>
                {includePhoto && palette.photoUri ? (
                  <Image
                    contentFit="cover"
                    source={{ uri: palette.photoUri }}
                    style={StyleSheet.absoluteFill}
                  />
                ) : null}
                <SwatchStrip colors={palette.colors} height={26} />
                {showHex ? (
                  <Text style={styles.formatHex} variant="monoSmall">
                    {palette.colors[0]?.hex.slice(1)}
                  </Text>
                ) : null}
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
          onPress={() => onSaveImage(options)}
          style={styles.half}
          variant="secondary"
        />
        <Button label={t('share.share')} onPress={() => onShare(options)} style={styles.wide} />
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
  const skin = useSkin();
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();
  return (
    <Card style={styles.option}>
      <Text style={styles.optionLabel} tone={locked ? 'secondary' : 'primary'}>
        {label}
      </Text>
      {locked ? (
        <View style={[styles.pro, skin.tint.pro]}>
          <Text style={{ color: skin.tint.pro.color }} variant="chip">
            {t('common.pro')}
          </Text>
        </View>
      ) : (
        <Toggle label={label} onValueChange={onChange} value={value} />
      )}
    </Card>
  );
}

/** Tile heights that read as the ratio they stand for. */
const RATIOS: Record<ShareFormat, ViewStyle> = {
  '1x1': { height: 96 },
  '4x5': { height: 112 },
  '9x16': { height: 132 },
};

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    sheet: { flex: 0, paddingHorizontal: space.gutter, gap: space.md },
    formats: { flexDirection: 'row', gap: 10 },
    format: { flex: 1, overflow: 'hidden', paddingBottom: space.xs },
    formatSelected: { borderColor: skin.ui.action.primary, borderWidth: 2 },
    formatPreview: {
      backgroundColor: skin.ui.bg.media,
      justifyContent: 'flex-end',
      paddingBottom: space.sm,
      overflow: 'hidden',
    },
    formatHex: { textAlign: 'center', paddingTop: 5, color: 'rgba(237,234,227,.72)' },
    formatLabel: { textAlign: 'center', paddingTop: space.xs },
    options: { gap: 9 },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.cardGap,
      paddingVertical: 13,
      borderRadius: skin.round.control,
    },
    optionLabel: { fontSize: 14 },
    pro: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7 },
    half: { flex: 1 },
    wide: { flex: 1.3 },
  });
