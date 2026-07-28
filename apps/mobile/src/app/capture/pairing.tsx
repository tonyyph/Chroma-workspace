import type { TrackRecommendation } from '@chromawave/domain';
import { spacing } from '@chromawave/design-tokens';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { PaletteStrip } from '@/components/PaletteStrip';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { TrackOption } from '@/components/TrackOption';
import { analytics, musicProvider } from '@/infrastructure/dependencies';
import { useCaptureStore } from '@/store/captureStore';
import { usePreferences } from '@/providers/PreferencesProvider';

export default function PairingScreen() {
  const palette = useCaptureStore((state) => state.palette);
  const recommendations = useCaptureStore((state) => state.recommendations);
  const selected = useCaptureStore((state) => state.selectedRecommendation);
  const setRecommendations = useCaptureStore((state) => state.setRecommendations);
  const selectRecommendation = useCaptureStore((state) => state.selectRecommendation);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    recommendations.length > 0 ? 'ready' : 'loading',
  );
  const [attempt, setAttempt] = useState(0);
  const { t } = usePreferences();

  useEffect(() => {
    if (!palette || recommendations.length > 0) return;
    let active = true;
    setStatus('loading');
    analytics.track('pairing_requested', { mood: palette.mood, provider: 'mock' });
    musicProvider
      .getRecommendations({
        mood: palette.mood,
        brightness: palette.metrics.brightness,
        saturation: palette.metrics.saturation,
        temperature: palette.metrics.temperature,
        contrast: palette.metrics.contrast,
      })
      .then((items) => {
        if (!active) return;
        setRecommendations(items);
        if (items[0]) selectRecommendation(items[0]);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [attempt, palette, recommendations.length, selectRecommendation, setRecommendations]);

  const retry = () => {
    setRecommendations([]);
    setStatus('loading');
    setAttempt((value) => value + 1);
  };

  if (!palette) {
    return (
      <Screen>
        <StateView
          actionLabel={t('pairing.return')}
          body={t('pairing.missingBody')}
          onAction={() => router.replace('/(tabs)/capture')}
          title={t('pairing.missing')}
        />
      </Screen>
    );
  }

  if (status === 'loading') {
    return (
      <Screen scroll={false}>
        <StateView body={t('pairing.loadingBody')} busy title={t('pairing.loading')} />
      </Screen>
    );
  }

  if (status === 'error') {
    return (
      <Screen scroll={false}>
        <StateView
          actionLabel={t('pairing.retry')}
          body={t('pairing.errorBody')}
          onAction={retry}
          title={t('pairing.error')}
        />
      </Screen>
    );
  }

  const accept = () => {
    if (!selected) return;
    analytics.track('pairing_accepted', {
      provider: 'mock',
      trackId: selected.track.id,
    });
    router.push('/capture/compose');
  };

  return (
    <Screen footer={<Button disabled={!selected} label={t('pairing.confirm')} onPress={accept} />}>
      <PageHeader
        body={t('pairing.body')}
        eyebrow={t('pairing.eyebrow')}
        title={t('pairing.title')}
      />
      <PaletteStrip animated={false} height={44} palette={palette} />
      <View accessibilityRole="radiogroup" style={styles.options}>
        {recommendations.map((recommendation: TrackRecommendation) => (
          <TrackOption
            key={recommendation.track.id}
            onPress={() => selectRecommendation(recommendation)}
            recommendation={recommendation}
            selected={selected?.track.id === recommendation.track.id}
          />
        ))}
      </View>
      <AppText style={styles.disclosure} tone="subtle" variant="caption">
        {t('pairing.disclosure')}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  disclosure: {
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
