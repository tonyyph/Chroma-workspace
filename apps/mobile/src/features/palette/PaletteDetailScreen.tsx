import { round, space, ui } from '@chromawave/design-tokens';
import { shortAge, type Palette } from '@chromawave/domain';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { paletteRepository } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';
import { Button, Card, Chip, ColorRow, Gutter, Meta, Screen, Text } from '@/ui';

/** B4 · PALETTE DETAIL — proportional hero, tags, hex list, export row. */
export function PaletteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = usePreferences();
  const [palette, setPalette] = useState<Palette | null>(null);

  useEffect(() => {
    if (!id) return;
    void paletteRepository.get(id).then(setPalette);
  }, [id]);

  if (!palette) {
    return (
      <Screen>
        <Gutter style={styles.head}>
          <Meta>{t('palette.loading')}</Meta>
        </Gutter>
      </Screen>
    );
  }

  const meta = [
    t('palette.saved', { age: shortAge(palette.capturedAt) }),
    palette.location,
    t('palette.colourCount', { count: palette.colors.length }),
    palette.space === 'p3' ? 'sRGB / P3' : 'sRGB',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen>
      <Gutter style={styles.nav}>
        <Pressable
          accessibilityLabel={t('palette.back')}
          accessibilityRole="button"
          onPress={router.back}
        >
          <Text tone="secondary" variant="mono">
            {t('palette.back')}
          </Text>
        </Pressable>
        <Pressable accessibilityLabel={t('palette.more')} accessibilityRole="button">
          <Text tone="secondary" variant="mono">
            •••
          </Text>
        </Pressable>
      </Gutter>

      {/* The hero is the palette at its true proportions — the composition, not a grid. */}
      <Gutter>
        <View accessibilityLabel={palette.colors.map((s) => s.hex).join(', ')} style={styles.hero}>
          {palette.colors.map((swatch) => (
            <View key={swatch.hex} style={{ flex: swatch.weight, backgroundColor: swatch.hex }} />
          ))}
        </View>
      </Gutter>

      <Gutter style={styles.title}>
        <Text variant="title">{palette.name}</Text>
        <Meta style={styles.meta}>{meta}</Meta>
      </Gutter>

      <Gutter style={styles.tags}>
        {palette.tags.map((tag) => (
          <Chip key={tag} label={tag.toLocaleUpperCase()} tone="pro" />
        ))}
        <Chip label={t('palette.addTag')} tone="add" />
      </Gutter>

      <Gutter style={styles.list}>
        <Card padded={false} style={styles.listCard}>
          {palette.colors.map((swatch, index) => (
            <View
              key={swatch.hex}
              style={[styles.listRow, index < palette.colors.length - 1 && styles.listDivider]}
            >
              <ColorRow color={swatch} dense />
            </View>
          ))}
        </Card>
      </Gutter>

      <Gutter style={styles.exports}>
        {(['CSS', 'SVG', 'ASE'] as const).map((format) => (
          <Chip fill key={format} label={format} onPress={() => {}} />
        ))}
        <Chip fill label="PRO · JSON" tone="pro" />
      </Gutter>

      <Gutter style={styles.action}>
        <Button
          label={t('palette.share')}
          onPress={() => {
            void Clipboard.setStringAsync(palette.colors.map((s) => s.hex).join(', '));
          }}
          variant="contrast"
        />
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingTop: space.md,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space.sm,
    paddingBottom: space.cardGap,
  },
  hero: {
    flexDirection: 'row',
    height: 180,
    borderRadius: round.media - 2,
    overflow: 'hidden',
  },
  title: {
    paddingTop: space.md + 2,
    gap: 4,
  },
  meta: {
    color: ui.text.tertiary,
  },
  tags: {
    paddingTop: space.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  list: {
    paddingTop: space.md + 2,
  },
  listCard: {
    overflow: 'hidden',
  },
  listRow: {
    paddingHorizontal: space.cardGap,
    paddingVertical: 13,
  },
  listDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(237,234,227,.07)',
  },
  exports: {
    paddingTop: space.gutter,
    flexDirection: 'row',
    gap: space.xs,
  },
  action: {
    paddingTop: space.sm,
  },
});
