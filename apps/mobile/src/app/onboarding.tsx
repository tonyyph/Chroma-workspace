import AsyncStorage from '@react-native-async-storage/async-storage';
import { analytics } from '@/infrastructure/dependencies';
import { spacing } from '@chromawave/design-tokens';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/Button';
import { ChromaticArtwork } from '@/components/ChromaticArtwork';
import { Screen } from '@/components/Screen';
import { ONBOARDING_KEY } from './index';
import { usePreferences } from '@/providers/PreferencesProvider';

const principles = [
  ['SEE', 'onboarding.see'],
  ['HEAR', 'onboarding.hear'],
  ['KEEP', 'onboarding.keep'],
] as const;

export default function OnboardingScreen() {
  const [saving, setSaving] = useState(false);
  const { colors, t } = usePreferences();

  useEffect(() => {
    analytics.track('onboarding_started', {});
  }, []);

  const complete = async () => {
    setSaving(true);
    await AsyncStorage.setItem(ONBOARDING_KEY, 'complete');
    analytics.track('onboarding_completed', { stepCount: 1 });
    router.replace('/(tabs)');
  };

  return (
    <Screen
      footer={
        <Button
          accessibilityHint={t('onboarding.enterHint')}
          label={t('onboarding.enter')}
          loading={saving}
          onPress={() => void complete()}
        />
      }
    >
      <View style={styles.hero}>
        <BrandMark size={72} />
        <AppText tone="accent" variant="label">
          CHROMAWAVE
        </AppText>
        <AppText variant="display">{t('onboarding.remember')}</AppText>
        <AppText italic tone="muted" variant="title">
          {t('onboarding.return')}
        </AppText>
        <AppText tone="muted">{t('onboarding.body')}</AppText>
      </View>

      <ChromaticArtwork caption={t('onboarding.caption')} compact />

      <View style={[styles.principles, { borderColor: colors.border }]}>
        {principles.map(([number, description], index) => (
          <View key={number} style={[styles.principle, { borderColor: colors.border }]}>
            <AppText tone="subtle" variant="caption">
              {String(index + 1).padStart(2, '0')}
            </AppText>
            <View style={styles.principleCopy}>
              <AppText tone="accent" variant="caption">
                {number}
              </AppText>
              <AppText>{t(description)}</AppText>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 390,
    justifyContent: 'flex-end',
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  principles: {
    marginTop: spacing.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  principle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  principleCopy: {
    flex: 1,
    gap: spacing.xs,
  },
});
