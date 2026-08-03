import { brandBands, round, space, ui } from '@chromawave/design-tokens';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermission } from 'react-native-vision-camera';

import { BrandMark } from '@/components/BrandMark';
import { analytics } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';
import { BandCanvas, Button, Card, Text } from '@/ui';

type Step = 1 | 2 | 3;

/**
 * FLOW A · A2-A4. "Four taps to first capture. Permissions are asked in
 * context, never on screen one." A1 is the native splash plus the launch
 * sequence, so this stack starts at A2.
 */
export function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const insets = useSafeAreaInsets();
  const { t } = usePreferences();

  const { hasPermission, requestPermission } = useCameraPermission();

  const finish = () => {
    analytics.track('onboarding_completed', { stepCount: 3 });
    router.replace('/(tabs)');
  };

  /**
   * A4's whole point is asking in context, so the button asks. The intro is over
   * either way — a refusal is an answer, and the capture screen has its own gate
   * for that case.
   */
  const allowCamera = async () => {
    if (!hasPermission) await requestPermission().catch(() => undefined);
    finish();
  };

  /** "Import a photo instead" has to actually reach the importer. */
  const importInstead = () => {
    analytics.track('onboarding_completed', { stepCount: 3 });
    router.replace('/tools/import');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {step === 1 ? <Welcome /> : null}
      {step === 2 ? <HowItWorks /> : null}
      {step === 3 ? <CameraPermission /> : null}

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Dots active={step} />
        {step === 3 ? (
          <>
            <Button
              label={t('onboarding.allowCamera')}
              onPress={() => void allowCamera()}
              size="lg"
            />
            <Button
              label={t('onboarding.importInstead')}
              onPress={importInstead}
              size="md"
              variant="secondary"
            />
          </>
        ) : (
          <>
            <Button
              label={t('onboarding.continue')}
              onPress={() => setStep((current) => (current + 1) as Step)}
              size="lg"
            />
            {step === 1 ? (
              <Button label={t('onboarding.skip')} onPress={finish} variant="ghost" />
            ) : (
              // Step 2 has no skip, so without this there is no way back to
              // step 1 once "Continue" has been tapped.
              <Button
                label={t('onboarding.back')}
                onPress={() => setStep((current) => Math.max(1, current - 1) as Step)}
                variant="ghost"
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

/** A2 · WELCOME · 1 of 3 */
function Welcome() {
  const { width } = useWindowDimensions();
  const { t } = usePreferences();
  return (
    <View style={styles.body}>
      <View style={styles.photoSlot}>
        <Text tone="tertiary" variant="chip">
          {t('onboarding.welcome.photoSlot')}
        </Text>
      </View>
      <View style={styles.bands}>
        <BandCanvas blur={10} height={86} strokeWidth={22} width={width} />
      </View>
      <View style={styles.copy}>
        <Text variant="display">{t('onboarding.welcome.title')}</Text>
        <Text tone="secondary" variant="body">
          {t('onboarding.welcome.body')}
        </Text>
      </View>
    </View>
  );
}

/** A3 · HOW IT WORKS · 2 of 3 — the three roles, named once and used everywhere after. */
function HowItWorks() {
  const { t } = usePreferences();
  const roles = [
    {
      color: brandBands[0],
      title: t('onboarding.role.dominant'),
      body: t('onboarding.role.dominantBody'),
    },
    {
      color: brandBands[1],
      title: t('onboarding.role.support'),
      body: t('onboarding.role.supportBody'),
    },
    {
      color: brandBands[2],
      title: t('onboarding.role.signal'),
      body: t('onboarding.role.signalBody'),
    },
  ];
  return (
    <View style={styles.body}>
      <View style={styles.copy}>
        <Text variant="headline">{t('onboarding.how.title')}</Text>
      </View>
      <View style={styles.roleList}>
        {roles.map((role) => (
          <Card key={role.title} style={styles.roleCard}>
            <View style={[styles.roleSwatch, { backgroundColor: role.color }]} />
            <View style={styles.roleCopy}>
              <Text variant="rowTitle">{role.title}</Text>
              <Text tone="secondary" variant="body">
                {role.body}
              </Text>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}

/** A4 · PERMISSION · in-context, after value shown. */
function CameraPermission() {
  const { t } = usePreferences();
  const reasons = [
    t('onboarding.permission.reason1'),
    t('onboarding.permission.reason2'),
    t('onboarding.permission.reason3'),
  ];
  return (
    <View style={styles.body}>
      <View style={styles.copy}>
        <BrandMark size={76} />
        <Text variant="headline">{t('onboarding.permission.title')}</Text>
        <Text tone="secondary" variant="body">
          {t('onboarding.permission.body')}
        </Text>
      </View>
      <Card style={styles.reasons}>
        {reasons.map((reason, index) => (
          <View key={reason} style={styles.reasonRow}>
            <Text tone="info" variant="mono">
              {String(index + 1).padStart(2, '0')}
            </Text>
            <Text style={styles.reasonText} tone="secondary" variant="body">
              {reason}
            </Text>
          </View>
        ))}
      </Card>
    </View>
  );
}

function Dots({ active }: { active: Step }) {
  const { t } = usePreferences();
  return (
    <View
      accessibilityLabel={t('onboarding.step', { current: active, total: 3 })}
      style={styles.dots}
    >
      {([1, 2, 3] as const).map((index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === active && styles.dotActive,
            index === active && { backgroundColor: brandBands[index - 1] },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg.base },
  body: { flex: 1 },
  photoSlot: {
    marginHorizontal: space.sectionGap,
    marginTop: space.cardGap,
    height: 360,
    borderRadius: 26,
    backgroundColor: ui.bg.media,
    borderWidth: 1.5,
    borderColor: 'rgba(237,234,227,.18)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bands: { height: 86, marginTop: space.sectionGap, overflow: 'hidden' },
  copy: { paddingHorizontal: space.sectionGap, paddingTop: space.lg, gap: space.sm },
  roleList: {
    paddingHorizontal: space.sectionGap,
    paddingTop: space.sectionGap,
    gap: space.cardGap,
  },
  roleCard: { flexDirection: 'row', alignItems: 'center', gap: space.cardGap },
  roleSwatch: { width: 52, height: 52, borderRadius: round.control },
  roleCopy: { flex: 1, gap: 3 },
  reasons: { marginHorizontal: space.sectionGap, marginTop: space.lg, gap: space.sm },
  reasonRow: { flexDirection: 'row', gap: 10 },
  reasonText: { flex: 1 },
  footer: {
    paddingHorizontal: space.sectionGap,
    paddingTop: space.md,
    gap: space.cardGap,
  },
  dots: { flexDirection: 'row', gap: 7, justifyContent: 'center', paddingBottom: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(237,234,227,.25)' },
  dotActive: { width: 22 },
});
