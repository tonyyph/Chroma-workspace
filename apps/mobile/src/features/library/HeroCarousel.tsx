import { round, space, tint, ui } from '@chromawave/design-tokens';
import type { Palette } from '@chromawave/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { memo, useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { type TrendingItem } from '@/data';
import { usePreferences } from '@/providers';
import { BandCanvas, Button, Carousel, Icon, Meta, Pressable, Text } from '@/ui';
import { HERO_HEIGHT, HERO_PEEK } from './heroMetrics';

/**
 * C1 · the landing carousel.
 *
 * Every slide is a *destination*, not an advertisement. The rule applied here is
 * that a slide earns its place only if tapping it takes the user somewhere they
 * could not reach in one tap otherwise, and only if that destination exists
 * right now — which is why the studio slide is absent until the library has a
 * palette to open it on. A carousel that scrolls past a card leading nowhere
 * teaches people to stop scrolling it.
 */
export type HeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  /** What the card and its button both do. */
  onPress: () => void;
  /** Colours the slide's artwork is drawn from — the palette it is about. */
  colors: readonly string[];
  art: 'field' | 'columns' | 'gradient';
  /** Drawn as a floating badge over the artwork. */
  badge?: { label: string; tone: 'pro' | 'info' } | undefined;
};

/**
 * Memoised: it is drawn in the library's list header, so it reconciled — Skia
 * artwork and all — every time a filter chip below it was tapped.
 */
export const HeroCarousel = memo(function HeroCarousel({
  featured,
  recent,
}: {
  /** The most-saved trending entry, or null when the feed could not be read. */
  featured: TrendingItem | null;
  /** The palette the studio slide would open. Null hides that slide. */
  recent: Palette | null;
}) {
  const router = useRouter();
  const { t } = usePreferences();

  const slides = useMemo<readonly HeroSlide[]>(() => {
    const built: HeroSlide[] = [
      {
        id: 'capture',
        eyebrow: t('hero.capture.eyebrow'),
        title: t('hero.capture.title'),
        body: t('hero.capture.body'),
        cta: t('hero.capture.cta'),
        onPress: () => router.push('/capture'),
        colors: ['#7C5CFF', '#22D3EE', '#FF7A5C'],
        art: 'field',
      },
    ];

    if (featured) {
      built.push({
        id: `trending:${featured.id}`,
        eyebrow: t('hero.trending.eyebrow'),
        title: featured.name,
        body: featured.blurb,
        cta: t('hero.trending.cta'),
        onPress: () => router.push('/trending'),
        colors: featured.colors.map((color) => color.hex),
        art: 'columns',
        badge: {
          label: t('trending.saves', { count: (featured.saves / 1000).toFixed(1) }),
          tone: 'info',
        },
      });
    }

    if (recent) {
      built.push({
        id: `studio:${recent.id}`,
        eyebrow: t('hero.studio.eyebrow'),
        title: t('hero.studio.title'),
        body: t('hero.studio.body', { name: recent.name }),
        cta: t('hero.studio.cta'),
        onPress: () => router.push(`/tools/gradient?id=${recent.id}`),
        colors: recent.colors.map((color) => color.hex),
        art: 'gradient',
      });
    }

    built.push({
      id: 'pro',
      eyebrow: t('hero.pro.eyebrow'),
      title: t('hero.pro.title'),
      body: t('hero.pro.body'),
      cta: t('hero.pro.cta'),
      onPress: () => router.push('/paywall?trigger=pro-tools'),
      colors: ['#7C5CFF', '#B79CFF', '#22D3EE'],
      art: 'field',
      badge: { label: t('common.pro'), tone: 'pro' },
    });

    return built;
  }, [featured, recent, router, t]);

  return (
    <Carousel
      accessibilityLabel={t('hero.label')}
      autoPlayMs={AUTOPLAY_MS}
      data={slides}
      height={HERO_HEIGHT}
      keyExtractor={(slide) => slide.id}
      peek={HERO_PEEK}
      renderItem={(slide) => <HeroCard slide={slide} />}
    />
  );
});

/**
 * Long enough to read the body copy before it moves. The usual 3s is tuned for a
 * banner with four words on it; these carry a sentence.
 */
const AUTOPLAY_MS = 6200;

function HeroCard({ slide }: { slide: HeroSlide }) {
  const { width } = useWindowDimensions();
  const artWidth = width - space.gutter * 2;

  return (
    <Pressable
      accessibilityHint={slide.body}
      accessibilityLabel={slide.title}
      accessibilityRole="button"
      onPress={slide.onPress}
      style={styles.card}
    >
      <View style={StyleSheet.absoluteFill}>
        <HeroArt art={slide.art} colors={slide.colors} height={HERO_HEIGHT} width={artWidth} />
      </View>

      {/* Two scrims, not one: a flat overlay at the strength body copy needs
          would grey out the artwork it is sitting on. The gradient keeps the top
          of the card fully saturated and only darkens where the text lands. */}
      <LinearGradient
        colors={['rgba(8,7,14,0)', 'rgba(8,7,14,.58)', 'rgba(8,7,14,.92)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      {slide.badge ? (
        <View
          style={[styles.badge, slide.badge.tone === 'pro' ? styles.badgePro : styles.badgeInfo]}
        >
          <Text
            style={{ color: slide.badge.tone === 'pro' ? tint.pro.color : tint.info.color }}
            variant="chip"
          >
            {slide.badge.label}
          </Text>
        </View>
      ) : null}

      <View style={styles.copy}>
        <Meta style={styles.eyebrow}>{slide.eyebrow}</Meta>
        <Text numberOfLines={2} variant="section">
          {slide.title}
        </Text>
        <Text numberOfLines={2} style={styles.body} tone="secondary" variant="body">
          {slide.body}
        </Text>
        <View style={styles.actions}>
          <Button label={slide.cta} onPress={slide.onPress} size="xxs" variant="contrast" />
          <View style={styles.arrow}>
            <Icon color={ui.text.tertiary} name="arrowRight" scale="control" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Slide artwork, drawn from the slide's own colours.
 *
 * Three treatments rather than one, because three identical band fields in a row
 * read as a rendering error rather than as a set. Each is generated from colour
 * values the app already holds, so no slide depends on a bundled image that
 * could go stale against the palette it claims to show.
 */
function HeroArt({
  art,
  colors,
  height,
  width,
}: {
  art: HeroSlide['art'];
  colors: readonly string[];
  height: number;
  width: number;
}) {
  if (art === 'gradient') {
    return (
      <LinearGradient
        colors={gradientStops(colors)}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    );
  }

  if (art === 'columns') {
    return (
      <View style={styles.columns}>
        {colors.map((hex, index) => (
          <View
            key={`${index}:${hex}`}
            style={[
              styles.column,
              {
                backgroundColor: hex,
                // Staggered heights so the block reads as a composition rather
                // than a swatch chart.
                marginTop: index % 2 === 0 ? 0 : height * 0.12,
              },
            ]}
          />
        ))}
      </View>
    );
  }

  return (
    <BandCanvas
      background={ui.bg.media}
      colors={colors}
      height={height}
      style={StyleSheet.absoluteFill}
      width={width}
    />
  );
}

/** `LinearGradient` needs at least two stops, and takes a mutable tuple. */
function gradientStops(colors: readonly string[]): [string, string, ...string[]] {
  const [first = ui.bg.media, second = ui.action.primary, ...rest] = colors;
  return [first, second, ...rest];
}

const styles = StyleSheet.create({
  card: {
    height: HERO_HEIGHT,
    borderRadius: round.media,
    overflow: 'hidden',
    backgroundColor: ui.bg.media,
    justifyContent: 'flex-end',
  },
  copy: {
    padding: space.md,
    gap: 5,
  },
  eyebrow: {
    color: ui.accent.infoText,
  },
  body: {
    paddingBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  arrow: {
    opacity: 0.8,
  },
  badge: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: round.chip,
    borderWidth: 1,
  },
  badgePro: {
    backgroundColor: tint.pro.backgroundColor,
    borderColor: tint.pro.borderColor,
  },
  badgeInfo: {
    backgroundColor: tint.info.backgroundColor,
    borderColor: tint.info.borderColor,
  },
  columns: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    gap: 6,
    padding: 10,
    backgroundColor: ui.bg.media,
  },
  column: {
    flex: 1,
    borderRadius: round.swatch,
  },
});
