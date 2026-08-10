import { brandBands, space, ui } from '@chromawave/design-tokens';
import { mergePalettes, type Color, type Palette } from '@chromawave/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers';
import { Meta, Text } from '@/ui';

/**
 * The whole library as one colour.
 *
 * **What this replaced.** The home screen opened with a carousel of up to four
 * promotional slides — capture (already the raised button in the centre of the
 * tab bar), this week's field notes (a tab away), the gradient studio, and Pro.
 * Four things to go and do, above the archive the screen exists to hold.
 *
 * A personal collection should open with the collection. Merging every palette
 * the user has kept produces something no other install has, changes as they
 * capture, and is made entirely of their own work — which is a better reason to
 * look at a home screen than an advertisement is.
 *
 * Falls back to the brand's own bands only when there is genuinely nothing yet,
 * and says so rather than pretending the empty state is a signature.
 */
export const LibrarySignature = memo(function LibrarySignature({
  palettes,
}: {
  palettes: readonly Palette[];
}) {
  const { t } = usePreferences();

  /**
   * Capped at the most recent sixty.
   *
   * Merging is a ΔE00 comparison of every colour against every colour kept so
   * far, so the cost climbs with the library — and a signature drawn from a
   * thousand captures is a brown average anyway. Sixty is a season's worth, and
   * a season is what a signature should describe.
   */
  const signature = useMemo<readonly Color[]>(
    () => (palettes.length ? mergePalettes(palettes.slice(0, 60)) : []),
    [palettes],
  );

  const bands = signature.length
    ? signature
    : brandBands.map((hex, index) => ({ hex, weight: [0.46, 0.32, 0.22][index] ?? 0 }));

  return (
    <View accessibilityLabel={bands.map((band) => band.hex).join(', ')} style={styles.root}>
      <View style={styles.bands}>
        {bands.map((band, index) => (
          <View
            key={`${index}:${band.hex}`}
            style={{ flex: band.weight, backgroundColor: band.hex }}
          />
        ))}
      </View>

      {/* Fades into the ground at both ends so the signature reads as something
          the screen is made of rather than a picture laid on top of it. */}
      <LinearGradient
        colors={['rgba(8,7,14,.55)', 'rgba(8,7,14,0)', 'rgba(8,7,14,.9)']}
        locations={[0, 0.4, 1]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.copy}>
        <Meta>{t('library.signature')}</Meta>
        {signature.length ? null : (
          <Text style={styles.empty} tone="secondary" variant="body">
            {t('library.signature.empty')}
          </Text>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { height: 210, backgroundColor: ui.bg.media, justifyContent: 'flex-end' },
  /** Vertical: a signature is a stack of weights, and stacking keeps the
   *  smallest one a band rather than a sliver at the edge of the screen. */
  bands: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  copy: { paddingHorizontal: space.gutter, paddingBottom: space.md, gap: 4 },
  empty: { maxWidth: 280 },
});
