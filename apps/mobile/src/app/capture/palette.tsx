import { radius, spacing } from '@chromawave/design-tokens';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { PaletteStrip } from '@/components/PaletteStrip';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { analytics, paletteExtractor } from '@/infrastructure/dependencies';
import { useCaptureStore } from '@/store/captureStore';
import { usePreferences } from '@/providers/PreferencesProvider';

export default function PaletteScreen() {
  const photo = useCaptureStore((state) => state.photo);
  const palette = useCaptureStore((state) => state.palette);
  const setPalette = useCaptureStore((state) => state.setPalette);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    palette ? 'ready' : 'loading',
  );
  const [attempt, setAttempt] = useState(0);
  const { colors, feedback, t } = usePreferences();

  useEffect(() => {
    if (!photo || palette) return;
    let active = true;
    const startedAt = Date.now();
    setStatus('loading');

    paletteExtractor
      .extract(photo.uri)
      .then((result) => {
        if (!active) return;
        setPalette(result);
        setStatus('ready');
        analytics.track('palette_extracted', {
          colorCount: result.colors.length,
          durationMs: Date.now() - startedAt,
          mood: result.mood,
        });
        void feedback.success();
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, [attempt, feedback, palette, photo, setPalette]);

  if (!photo) {
    return (
      <Screen>
        <StateView
          actionLabel={t('palette.restart')}
          body={t('palette.expiredBody')}
          onAction={() => router.replace('/(tabs)/capture')}
          title={t('palette.expired')}
        />
      </Screen>
    );
  }

  if (status === 'loading') {
    return (
      <Screen scroll={false}>
        <StateView body={t('palette.loadingBody')} busy title={t('palette.loading')} />
      </Screen>
    );
  }

  if (status === 'error' || !palette) {
    return (
      <Screen scroll={false}>
        <StateView
          actionLabel={t('palette.retry')}
          body={t('palette.errorBody')}
          onAction={() => {
            setStatus('loading');
            setAttempt((value) => value + 1);
          }}
          title={t('palette.error')}
        />
      </Screen>
    );
  }

  const metricItems = [
    [t('palette.light'), `${Math.round(palette.metrics.brightness)}%`],
    [t('palette.color'), `${Math.round(palette.metrics.saturation * 100)}%`],
    [t('palette.contrast'), `${Math.round(palette.metrics.contrast)}%`],
  ] as const;

  return (
    <Screen
      footer={
        <Button
          accessibilityHint={t('palette.confirmHint')}
          label={t('palette.confirm')}
          onPress={() => router.push('/capture/pairing')}
        />
      }
    >
      <PageHeader
        body={t('palette.body')}
        eyebrow={t('palette.eyebrow')}
        title={t('palette.title', { mood: palette.mood })}
      />
      <PaletteStrip height={150} palette={palette} />
      <View style={styles.hexRow}>
        {palette.colors.map((swatch) => (
          <AppText key={swatch.hex} tone="subtle" variant="caption">
            {swatch.hex}
          </AppText>
        ))}
      </View>

      <View style={styles.metrics}>
        {metricItems.map(([label, value]) => (
          <View key={label} style={[styles.metric, { backgroundColor: colors.surface }]}>
            <AppText tone="subtle" variant="caption">
              {label}
            </AppText>
            <AppText variant="heading">{value}</AppText>
          </View>
        ))}
      </View>
      <View style={styles.note}>
        <View style={[styles.noteIndicator, { backgroundColor: colors.warning }]} />
        <AppText tone="muted" variant="caption">
          {t('palette.note')}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hexRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  metric: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    gap: spacing.xs,
  },
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: spacing.lg,
  },
  noteIndicator: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    marginTop: 4,
  },
});
