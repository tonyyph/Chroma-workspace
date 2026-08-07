import { round, space, ui } from '@chromawave/design-tokens';
import { readStability, type Color, type Palette } from '@chromawave/domain';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { PalettePhoto } from '@/features/library/PalettePhoto';
import { usePreferences } from '@/providers';
import { Button, ButtonRow, Card, ColorRow, Icon, Meta, Sheet, Text } from '@/ui';

/**
 * B2 · RESULT SHEET — what was read, and what it was read from.
 *
 * **What changed and why.** The capture area was a 392pt panel of `bg/media`
 * with the word CAPTURE in the middle of it: the photograph the user had taken
 * one second earlier was never shown. On the screen immediately after the app's
 * core action, the evidence for the entire reading was a grey rectangle.
 *
 * The frame is now the ground, with the extracted bands lying along its bottom
 * edge — the reading sitting on the thing it was read from, which is the only
 * arrangement that lets someone check it at a glance.
 *
 * The sheet leads with the measurement rather than a name. At this point the
 * palette is called "Untitled capture", so the old title row was announcing a
 * placeholder in the largest type on screen, while ΔE — the number that says
 * whether to trust any of this, and the thing no competitor shows at all — was
 * a caption under it. They have swapped places.
 */
export function ResultScreen({
  palette,
  onSave,
  onTune,
  onRetake,
}: {
  palette: Palette;
  onSave: () => void;
  onTune: () => void;
  onRetake: () => void;
}) {
  const router = useRouter();
  const { t } = usePreferences();
  const named = palette.colors.filter((color) => color.role !== 'extra');
  const extras = palette.colors.filter((color) => color.role === 'extra');
  const stability = readStability(palette.deltaE);

  return (
    <View style={styles.root}>
      <View accessibilityLabel={t('result.capture')} style={styles.capture}>
        <PalettePhoto palette={palette} style={StyleSheet.absoluteFill} />
        {/* Top scrim only. The bottom of the frame carries the bands, and a
            scrim there would mute the very colours being reported. */}
        <LinearGradient
          colors={['rgba(8,7,14,.62)', 'rgba(8,7,14,0)']}
          locations={[0, 0.42]}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.captureChrome}>
          <Card
            accessibilityLabel={t('result.close')}
            onPress={() => router.back()}
            style={styles.captureChip}
          >
            <Icon name="close" scale="inline" />
            <Text variant="chip">{t('result.close')}</Text>
          </Card>
          <Card
            accessibilityLabel={t('result.retake')}
            onPress={onRetake}
            style={styles.captureChip}
          >
            <Text variant="chip">{t('result.retake')}</Text>
          </Card>
        </View>

        {/* The reading, lying on its source at true proportions. */}
        <View
          accessibilityLabel={palette.colors.map((color) => color.hex).join(', ')}
          style={styles.readout}
        >
          {palette.colors.map((color, index) => (
            <View
              key={`${index}:${color.hex}`}
              style={{ flex: color.weight, backgroundColor: color.hex }}
            />
          ))}
        </View>
      </View>

      <Sheet overlap={28} style={styles.sheet}>
        {/* The verdict, at the size the decision deserves. Colour is never the
            only carrier — the distance is a number and the stability is a word. */}
        <View style={styles.verdict}>
          <Text variant="display">{`ΔE ${palette.deltaE}`}</Text>
          <View style={styles.verdictMeta}>
            <Meta tone={stability === 'stable' ? 'info' : 'tertiary'}>
              {t('result.read', { stability: t(`common.stability.${stability}`) })}
            </Meta>
            <Meta>
              {`${t('result.confidence', { percent: Math.round(palette.confidence * 100) })} · ${
                palette.space === 'p3' ? 'P3' : 'sRGB'
              }`}
            </Meta>
          </View>
        </View>

        <View style={styles.rows}>
          {named.map((color) => (
            <Card key={color.hex} style={styles.row}>
              <ColorRow color={roleLabelled(color)} onCopy={copy} />
            </Card>
          ))}
          {extras.length ? (
            <View style={styles.extras}>
              {/* The named rows copy on tap; the extras are the same kind of row
                  at half width and were the only swatches that did not. */}
              {extras.map((color) => (
                <Card
                  accessibilityLabel={t('result.copyLabel', { hex: color.hex })}
                  key={color.hex}
                  onPress={() => copy(color.hex)}
                  style={styles.extra}
                >
                  <View style={[styles.extraSwatch, { backgroundColor: color.hex }]} />
                  <Text tone="secondary" variant="monoSmall">
                    {`${color.hex.slice(1)}\n${Math.round(color.weight * 100)}%`}
                  </Text>
                </Card>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <ButtonRow>
            <Button
              label={t('result.tune')}
              onPress={onTune}
              style={styles.tune}
              variant="secondary"
            />
            <Button label={t('result.save')} onPress={onSave} style={styles.save} />
          </ButtonRow>
        </View>
      </Sheet>
    </View>
  );
}

const copy = (hex: string) => {
  void Clipboard.setStringAsync(hex);
};

/** The row component takes a display role; capitalise the stored enum for it. */
function roleLabelled(color: Color) {
  const label = color.role.charAt(0).toUpperCase() + color.role.slice(1);
  return { hex: color.hex, weight: color.weight, role: label };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg.base },
  /**
   * Flexes rather than sitting at a fixed 392. The sheet below sizes to its
   * content, so a three-colour palette leaves room the photograph can use and a
   * six-colour one takes it back.
   */
  capture: { flex: 1, minHeight: 300, backgroundColor: ui.bg.media },
  captureChrome: {
    position: 'absolute',
    top: 64,
    left: space.gutter,
    right: space.gutter,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  captureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: ui.scrim.control,
    borderColor: ui.border.control,
    paddingHorizontal: space.sm,
    paddingVertical: 9,
    borderRadius: round.full,
  },
  readout: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Clear of the sheet's 28pt overlap, so the strip is never tucked under it.
    bottom: 28,
    height: 14,
    flexDirection: 'row',
  },
  sheet: { paddingHorizontal: space.sectionGap },
  verdict: { gap: space.xs, paddingBottom: space.md },
  verdictMeta: { gap: 3 },
  rows: { gap: space.xs },
  row: { paddingHorizontal: 13, paddingVertical: 11, borderRadius: round.control },
  extras: { flexDirection: 'row', gap: space.xs },
  extra: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: space.sm,
    paddingVertical: 10,
    borderRadius: round.control,
  },
  extraSwatch: { width: 28, height: 28, borderRadius: 9 },
  actions: { marginTop: 'auto', paddingTop: space.md },
  tune: { flex: 1 },
  save: { flex: 1.4 },
});
