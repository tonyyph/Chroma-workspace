import { type Palette } from '@cw/domain';
import { brandBands, space, type Skin } from '@cw/tokens';
import { BlurView } from 'expo-blur';
import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { usePreferences, useSkin } from '@/providers';
import { BandCanvas, Gradient, Meta, Text, useStyles } from '@/ui';
import { signatureColors } from './youInsights';

const HERO_HEIGHT = 184;

/** The brand bands, for a library with nothing in it yet. */
const BRAND_FALLBACK = brandBands;

/**
 * The hero: the user's own dominant bands, full-bleed, with the identity card
 * floating over the join.
 *
 * Full-bleed and overlapping is the whole point — a signature inset into the
 * gutter like everything else would be one more card. The card below overlaps it
 * by its own corner radius so the two read as one object with a lit edge rather
 * than as a picture with a caption.
 */
export function SignatureHero({ palettes }: { palettes: readonly Palette[] }) {
  const skin = useSkin();
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();
  const { width } = useWindowDimensions();
  const signature = useMemo(() => signatureColors(palettes), [palettes]);
  // An empty library still gets a hero — in the brand's own bands, and saying so.
  const colors = signature.length ? signature : BRAND_FALLBACK;

  return (
    <View style={styles.hero}>
      <View style={styles.heroArt}>
        <BandCanvas colors={colors} height={HERO_HEIGHT} width={width} />
        <Gradient role={skin.effects.scrimBottom('soft')} />
      </View>

      <View style={styles.identity}>
        <View style={styles.identityGlass}>
          <BlurView
            intensity={skin.glass.shell.intensity}
            style={StyleSheet.absoluteFill}
            tint="dark"
          />
          <View style={styles.identityRow}>
            <View accessibilityLabel={t('you.signature.label')} style={styles.avatar}>
              {colors.slice(0, 3).map((hex, index) => (
                <View key={`${index}:${hex}`} style={{ flex: 1, backgroundColor: hex }} />
              ))}
            </View>
            <View style={styles.identityCopy}>
              <Text variant="section">{t('you.title')}</Text>
              <Meta style={styles.identityMeta}>{t('you.meta')}</Meta>
            </View>
          </View>
          <Text style={styles.identityBody} tone="secondary" variant="body">
            {signature.length ? t('you.signature.body') : t('you.signature.empty')}
          </Text>
          <View style={styles.signatureStrip}>
            {colors.map((hex, index) => (
              <View
                key={`${index}:${hex}`}
                style={[styles.signatureChip, { backgroundColor: hex }]}
              />
            ))}
          </View>
          <Meta style={styles.identityEyebrow}>{t('you.signature.eyebrow')}</Meta>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    hero: {
      marginBottom: space.sm,
    },
    heroArt: {
      height: HERO_HEIGHT,
      backgroundColor: skin.ui.bg.media,
      overflow: 'hidden',
    },
    identity: {
      paddingHorizontal: space.gutter,
      // The overlap is the layering: the card sits on the join rather than under it.
      marginTop: -skin.round.sheet * 1.55,
    },
    identityGlass: {
      borderRadius: skin.round.sheet,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: skin.elevation.floating.borderColor,
      backgroundColor: skin.glass.shell.tint,
      padding: space.sm + 2,
      gap: space.xs + 2,
    },
    identityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs + 4,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: skin.round.media,
      overflow: 'hidden',
    },
    identityCopy: {
      flex: 1,
      gap: 2,
    },
    identityMeta: {
      color: skin.ui.text.tertiary,
    },
    identityBody: {
      paddingTop: 1,
    },
    identityEyebrow: {
      color: skin.ui.text.quaternary,
    },
    signatureStrip: {
      flexDirection: 'row',
      gap: 4,
    },
    signatureChip: {
      flex: 1,
      height: 8,
      // Clamped to half the height either way, so chroma renders exactly the 4
      // it always did; swiss squares it off.
      borderRadius: skin.round.swatch,
    },
  });
