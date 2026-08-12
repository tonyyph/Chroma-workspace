import { readableOn, roledColors, shortAge, type Palette } from '@cw/domain';
import { space } from '@cw/tokens';
import { StyleSheet, View } from 'react-native';
import { PalettePhoto } from '@/features/library/PalettePhoto';
import { usePreferences, useSkin } from '@/providers';
import { Gradient, HERO_HEIGHT, Meta, Text } from '@/ui';

/**
 * THE SUBJECT.
 *
 * Full-bleed and edge to edge rather than a rounded card inset in a gutter: this
 * palette is what the screen is about, and a 180pt tile floating in the middle of
 * the ground made it one item among seven. The name sits *on* it, in a colour
 * derived from the palette itself and held to AA against the band behind it, so
 * the title and its subject are one object instead of a caption under a picture.
 */
export function PaletteHero({ palette }: { palette: Palette }) {
  const skin = useSkin();
  const { t } = usePreferences();

  /**
   * The name is written on the palette, so it has to be legible against it —
   * and the band it lands on is whatever the user photographed. `readableOn`
   * moves lightness only, so the title keeps the palette's own hue and still
   * clears AA against the darkest band the scrim leaves showing.
   */
  const titleInk = readableOn(
    roledColors(palette)[0]?.hex ?? skin.ui.text.primary,
    palette.colors[0]?.hex ?? skin.ui.bg.base,
    3,
  );

  const meta = [
    t('palette.saved', { age: shortAge(palette.capturedAt) }),
    palette.location,
    t('palette.colourCount', { count: palette.colors.length }),
    palette.space === 'p3' ? 'sRGB / P3' : 'sRGB',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      accessibilityLabel={palette.colors.map((swatch) => swatch.hex).join(', ')}
      style={[styles.hero, { backgroundColor: skin.ui.bg.media }]}
    >
      {palette.photoUri ? <PalettePhoto palette={palette} style={StyleSheet.absoluteFill} /> : null}
      <View style={styles.heroBands}>
        {palette.colors.map((swatch) => (
          <View key={swatch.hex} style={{ flex: swatch.weight, backgroundColor: swatch.hex }} />
        ))}
      </View>
      <Gradient role={skin.effects.scrimBottom('strong')} />
      <View style={styles.heroCopy}>
        <Text numberOfLines={3} style={{ color: titleInk }} variant="hero">
          {palette.name}
        </Text>
        <Meta tone="secondary">{meta}</Meta>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Edge to edge and tall: the subject, not a thumbnail of it. */
  hero: {
    // Shared with the flight overlay, which computes its destination rather
    // than measuring this — see `HeroTransition`.
    height: HERO_HEIGHT,
    justifyContent: 'flex-end',
  },
  /** Behind the scrim and over the photo — the palette as the ground it came from. */
  heroBands: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', opacity: 0.94 },
  heroCopy: { paddingHorizontal: space.gutter, paddingBottom: space.gutter, gap: space.xs },
});
