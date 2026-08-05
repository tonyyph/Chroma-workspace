import { brandBands, duration, round, size, space, ui } from '@chromawave/design-tokens';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCameraPermission } from 'react-native-vision-camera';
import { BrandMark } from '@/components/BrandMark';
import { analytics } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';
import { Button, Card, InlineError, SwatchStrip, Text } from '@/ui';
const welcomePhoto: number = require('../../../assets/brand/library/harbour-dusk.jpg');
const steps = [1, 2, 3, 4, 5] as const;
type Step = (typeof steps)[number];
type Destination = '/(tabs)' | '/tools/import';

/** Five-step first-launch flow: value, model, tune, share, then permission. */
export function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [completing, setCompleting] = useState(false);
  const [completionFailed, setCompletionFailed] = useState(false);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { t, completeOnboarding } = usePreferences();
  const { hasPermission, requestPermission } = useCameraPermission();

  useEffect(() => {
    analytics.track('onboarding_started', {});
  }, []);

  const finish = async (destination: Destination) => {
    setCompleting(true);
    setCompletionFailed(false);
    const completed = await completeOnboarding();
    setCompleting(false);
    if (!completed) {
      setCompletionFailed(true);
      return;
    }
    analytics.track('onboarding_completed', { stepCount: steps.length });
    router.replace(destination);
  };

  const allowCamera = async () => {
    if (!hasPermission) await requestPermission().catch(() => undefined);
    await finish('/(tabs)');
  };

  const next = () => setStep((current) => Math.min(steps.length, current + 1) as Step);
  const back = () => setStep((current) => Math.max(1, current - 1) as Step);
  const entry = reducedMotion
    ? FadeIn.duration(120).reduceMotion(ReduceMotion.System)
    : FadeInDown.duration(duration.enter).reduceMotion(ReduceMotion.System);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Animated.View entering={entry} key={step} style={styles.animatedBody}>
        {step === 1 ? <Welcome /> : null}
        {step === 2 ? <HowItWorks /> : null}
        {step === 3 ? <TuneIntroduction /> : null}
        {step === 4 ? <ShareIntroduction /> : null}
        {step === 5 ? <CameraPermission /> : null}
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        {completionFailed ? (
          <InlineError
            detail={t('onboarding.saveFailed.body')}
            title={t('onboarding.saveFailed.title')}
          />
        ) : null}
        <Dots active={step} />
        {step === steps.length ? (
          <>
            <Button
              disabled={completing}
              label={t('onboarding.allowCamera')}
              onPress={() => void allowCamera()}
              size="lg"
            />
            <Button
              disabled={completing}
              label={t('onboarding.importInstead')}
              onPress={() => void finish('/tools/import')}
              size="xs"
              variant="secondary"
            />
          </>
        ) : (
          <>
            <Button
              disabled={completing}
              label={t('onboarding.continue')}
              onPress={next}
              size="lg"
            />
            {step === 1 ? (
              <Button
                disabled={completing}
                label={t('onboarding.skip')}
                onPress={() => void finish('/(tabs)')}
                size="xs"
                variant="ghost"
              />
            ) : (
              <Button
                disabled={completing}
                label={t('onboarding.back')}
                onPress={back}
                size="xs"
                variant="ghost"
              />
            )}
          </>
        )}
      </View>
    </View>
  );
}

function Welcome() {
  const { height } = useWindowDimensions();
  const { t } = usePreferences();
  const visualHeight = Math.max(210, Math.min(330, height * 0.36));
  return (
    <View style={styles.body}>
      <View style={[styles.heroPhoto, { height: visualHeight }]}>
        <Image
          accessibilityElementsHidden
          contentFit="cover"
          source={welcomePhoto}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.photoScrim} />
        <Text style={styles.photoLabel} variant="chip">
          {t('onboarding.welcome.photoSlot')}
        </Text>
        <View style={styles.heroStrip}>
          <SwatchStrip
            colors={brandBands.map((hex, index) => ({
              hex,
              weight: [0.46, 0.32, 0.22][index] ?? 0,
            }))}
            height={14}
            radius={7}
          />
        </View>
      </View>
      <SlideCopy body={t('onboarding.welcome.body')} title={t('onboarding.welcome.title')} />
    </View>
  );
}

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
      <SlideCopy title={t('onboarding.how.title')} />
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

/** New slide 3: makes the tune controls familiar before the first capture. */
function TuneIntroduction() {
  const { t } = usePreferences();
  return (
    <View style={styles.body}>
      <SlideCopy body={t('onboarding.tune.body')} title={t('onboarding.tune.title')} />
      <Card style={styles.featureCard}>
        <SwatchStrip
          colors={brandBands.map((hex, index) => ({ hex, weight: [0.46, 0.32, 0.22][index] ?? 0 }))}
          height={64}
          radius={round.swatch}
        />
        <PreviewSlider label={t('tune.hue')} position="72%" />
        <PreviewSlider label={t('tune.saturation')} position="46%" />
        <PreviewSlider label={t('tune.luminance')} position="61%" />
      </Card>
    </View>
  );
}

/** New slide 4: shows that a saved palette stays tied to its photograph. */
function ShareIntroduction() {
  const { t } = usePreferences();
  return (
    <View style={styles.body}>
      <SlideCopy body={t('onboarding.share.body')} title={t('onboarding.share.title')} />
      <Card padded={false} style={styles.sharePreview}>
        <View style={styles.sharePhoto}>
          <Image
            accessibilityElementsHidden
            contentFit="cover"
            source={welcomePhoto}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <SwatchStrip
          colors={brandBands.map((hex, index) => ({ hex, weight: [0.46, 0.32, 0.22][index] ?? 0 }))}
          height={18}
        />
        <View style={styles.shareCopy}>
          <Text variant="section">{t('onboarding.share.previewName')}</Text>
          <Text tone="tertiary" variant="mono">
            {t('onboarding.share.previewMeta')}
          </Text>
        </View>
      </Card>
    </View>
  );
}

function CameraPermission() {
  const { t } = usePreferences();
  const reasons = [
    t('onboarding.permission.reason1'),
    t('onboarding.permission.reason2'),
    t('onboarding.permission.reason3'),
  ];
  return (
    <View style={styles.body}>
      <View style={styles.permissionCopy}>
        <BrandMark size={72} />
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

function SlideCopy({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.copy}>
      <Text variant="headline">{title}</Text>
      {body ? (
        <Text tone="secondary" variant="body">
          {body}
        </Text>
      ) : null}
    </View>
  );
}

function PreviewSlider({ label, position }: { label: string; position: `${number}%` }) {
  return (
    <View style={styles.previewControl}>
      <Text tone="tertiary" variant="eyebrow">
        {label}
      </Text>
      <View style={styles.previewTrack}>
        <View style={[styles.previewFill, { width: position }]} />
        <View style={[styles.previewKnob, { left: position }]} />
      </View>
    </View>
  );
}

function Dots({ active }: { active: Step }) {
  const { t } = usePreferences();
  return (
    <View
      accessibilityLabel={t('onboarding.step', { current: active, total: steps.length })}
      style={styles.dots}
    >
      {steps.map((index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === active && styles.dotActive,
            index === active && { backgroundColor: brandBands[(index - 1) % brandBands.length] },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg.base },
  animatedBody: { flex: 1, minHeight: 0 },
  body: { flex: 1, minHeight: 0 },
  heroPhoto: {
    marginHorizontal: space.sectionGap,
    marginTop: space.cardGap,
    borderRadius: round.media,
    backgroundColor: ui.bg.media,
    overflow: 'hidden',
  },
  photoScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,7,14,.18)' },
  photoLabel: {
    position: 'absolute',
    top: space.md,
    left: space.md,
    color: ui.text.primary,
  },
  heroStrip: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.md,
  },
  copy: { paddingHorizontal: space.sectionGap, paddingTop: space.lg, gap: space.sm },
  roleList: {
    paddingHorizontal: space.sectionGap,
    paddingTop: space.sectionGap,
    gap: space.cardGap,
  },
  roleCard: { flexDirection: 'row', alignItems: 'center', gap: space.cardGap },
  roleSwatch: { width: 52, height: 52, borderRadius: round.control },
  roleCopy: { flex: 1, gap: 3 },
  featureCard: {
    marginHorizontal: space.sectionGap,
    marginTop: space.lg,
    gap: space.sm,
  },
  previewControl: { gap: space.xs },
  previewTrack: {
    height: size.sliderTrack,
    borderRadius: round.full,
    backgroundColor: ui.fill.track,
  },
  previewFill: {
    height: size.sliderTrack,
    borderRadius: round.full,
    backgroundColor: ui.action.primary,
  },
  previewKnob: {
    position: 'absolute',
    top: -(size.sliderThumb - size.sliderTrack) / 2,
    width: size.sliderThumb,
    height: size.sliderThumb,
    marginLeft: -size.sliderThumb / 2,
    borderRadius: round.full,
    backgroundColor: ui.text.primary,
  },
  sharePreview: {
    marginHorizontal: space.sectionGap,
    marginTop: space.lg,
    overflow: 'hidden',
  },
  sharePhoto: { height: 190, backgroundColor: ui.bg.media },
  shareCopy: { padding: space.md, gap: space.xs },
  permissionCopy: { paddingHorizontal: space.sectionGap, paddingTop: space.lg, gap: space.sm },
  reasons: { marginHorizontal: space.sectionGap, marginTop: space.lg, gap: space.sm },
  reasonRow: { flexDirection: 'row', gap: space.sm },
  reasonText: { flex: 1 },
  footer: {
    paddingHorizontal: space.sectionGap,
    paddingTop: space.sm,
    gap: space.cardGap,
  },
  dots: { flexDirection: 'row', gap: 7, justifyContent: 'center', paddingBottom: 2 },
  dot: { width: 5, height: 5, borderRadius: round.full, backgroundColor: ui.text.quaternary },
  dotActive: { width: 22 },
});
