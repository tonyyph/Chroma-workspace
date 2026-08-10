import type { PaywallTrigger } from '@chromawave/analytics';
import { space, type Skin } from '@chromawave/design-tokens';
import type { Palette } from '@chromawave/domain';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '@/components';
import { analytics } from '@/infrastructure/dependencies';
import { useEntitlements, usePreferences, useSkin } from '@/providers';
import { Button, Card, Gradient, Icon, Pressable, Text, useStyles } from '@/ui';

type Plan = 'monthly' | 'yearly';

/**
 * D1 · PAYWALL · "PRO badge variant of the mark".
 *
 * "Premium is 'the complete wave': free gets two bands of value, Pro unlocks the
 * third. No gold, no crown, no dark patterns." Price, period and Restore are all
 * above the fold, which is also the submission requirement from the build kit.
 */
export function PaywallScreen({
  trigger = 'unknown',
  palette = null,
}: {
  trigger?: PaywallTrigger;
  /** The user's most recent work, rendered as the hero. See `SubjectHero`. */
  palette?: Palette | null;
}) {
  const skin = useSkin();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<Plan>('yearly');
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(false);
  const { t } = usePreferences();
  const { restore: restoreTier } = useEntitlements();

  useEffect(() => {
    analytics.track('paywall_shown', { trigger });
  }, [trigger]);

  /**
   * Goes through the entitlement provider now rather than reporting a hardcoded
   * nothing. There is still no billing provider behind it, so it still finds
   * nothing — but the path is real, and wiring StoreKit changes one class rather
   * than this screen.
   */
  const restore = async () => {
    setRestoring(true);
    setRestoreResult(false);
    analytics.track('paywall_restore_requested', { trigger });
    try {
      await restoreTier();
    } catch {
      // Nothing to surface differently: found-nothing and could-not-look read
      // the same to someone who has not bought anything.
    }
    setRestoring(false);
    setRestoreResult(true);
  };

  const benefits = [
    { color: skin.accents[0], label: t('paywall.benefit1') },
    { color: skin.accents[1], label: t('paywall.benefit2') },
    { color: skin.accents[2], label: t('paywall.benefit3') },
  ];

  return (
    <View style={[styles.root, { backgroundColor: skin.ui.bg.base, paddingTop: insets.top }]}>
      {/* Chroma washes the head of the screen; swiss answers the same role
          flat, because a screen-wide wash is a mood. Neither is decided here. */}
      <Gradient role={skin.effects.screenWash} style={styles.wash} />
      <View style={styles.close}>
        <Pressable
          accessibilityLabel={t('paywall.close')}
          accessibilityRole="button"
          hitSlop={12}
          onPress={router.back}
        >
          <Icon color={skin.ui.text.tertiary} name="close" scale="action" />
        </Pressable>
      </View>

      <SubjectHero palette={palette} />

      <View style={styles.hero}>
        <Text style={styles.centred} variant="headline">
          {t('paywall.title')}
        </Text>
        <Text style={styles.centred} tone="secondary" variant="body">
          {t('paywall.body')}
        </Text>
      </View>

      <View style={styles.benefits}>
        {benefits.map((benefit) => (
          <Card key={benefit.label} style={styles.benefit}>
            <View style={[styles.dot, { backgroundColor: benefit.color }]} />
            <Text style={styles.benefitLabel}>{benefit.label}</Text>
          </Card>
        ))}
      </View>

      <View style={styles.plans}>
        <PlanCard
          detail={t('paywall.perMonth')}
          onPress={() => setPlan('monthly')}
          period={t('paywall.monthly')}
          price="$4.99"
          selected={plan === 'monthly'}
        />
        <PlanCard
          badge={t('paywall.save')}
          detail={t('paywall.perMonthEquivalent', { price: '$3.00' })}
          onPress={() => setPlan('yearly')}
          period={t('paywall.yearly')}
          price="$35.99"
          selected={plan === 'yearly'}
        />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Button
          label={t('paywall.cta')}
          onPress={() => {
            analytics.track('paywall_converted', { plan });
            router.back();
          }}
          size="lg"
        />
        {/* Restore, Terms and Privacy have to be reachable above the fold — an
            App Store requirement, and all three were text before. */}
        <View style={styles.legalRow}>
          <Pressable
            accessibilityLabel={t('paywall.restore')}
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => void restore()}
          >
            <Text tone="tertiary" variant="chip">
              {restoring ? t('common.working') : t('paywall.restore')}
            </Text>
          </Pressable>
          {(
            [
              ['paywall.terms', 'https://chromawave.app/terms'],
              ['paywall.privacy', 'https://chromawave.app/privacy'],
            ] as const
          ).map(([key, url]) => (
            <Pressable
              accessibilityLabel={t(key)}
              accessibilityRole="button"
              hitSlop={10}
              key={key}
              onPress={() => void Linking.openURL(url).catch(() => undefined)}
            >
              <Text tone="tertiary" variant="chip">
                {t(key)}
              </Text>
            </Pressable>
          ))}
        </View>

        {restoreResult ? (
          <Text style={styles.smallPrint} tone="tertiary" variant="monoSmall">
            {t('paywall.restoreNone')}
          </Text>
        ) : null}
        <Text style={styles.smallPrint} tone="tertiary" variant="monoSmall">
          {plan === 'yearly'
            ? t('paywall.smallPrintYearly', { price: '$35.99' })
            : t('paywall.smallPrintMonthly', { price: '$4.99' })}
        </Text>
      </View>
    </View>
  );
}

/**
 * The subject of the sale, which is the user's own most recent palette.
 *
 * A paywall that leads with the app's logo is asking someone to buy a brand.
 * Leading with the thing they just made — at its real proportions, masked into
 * the ground so it reads as a surface rather than a card — asks them to buy
 * more of what they are already doing. It falls back to the mark only when
 * there is genuinely nothing of theirs to show yet.
 */
function SubjectHero({ palette }: { palette: Palette | null }) {
  const skin = useSkin();
  const styles = useStyles(makeStyles);
  if (!palette) {
    return (
      <View style={styles.markHero}>
        <BrandMark size={104} />
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={palette.colors.map((color) => color.hex).join(', ')}
      style={styles.subject}
    >
      <View style={styles.subjectBands}>
        {palette.colors.map((color) => (
          <View key={color.hex} style={{ flex: color.weight, backgroundColor: color.hex }} />
        ))}
      </View>
      {/* Fades into the ground rather than stopping at an edge, so the palette
          reads as something the screen is made of. */}
      <Gradient role={skin.effects.fadeToGround} />
    </View>
  );
}

function PlanCard({
  period,
  price,
  detail,
  selected,
  badge,
  onPress,
}: {
  period: string;
  price: string;
  detail: string;
  selected: boolean;
  badge?: string;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable
      accessibilityLabel={`${period} ${price} ${detail}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.plan, selected && styles.planSelected]}
    >
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText} variant="chip">
            {badge}
          </Text>
        </View>
      ) : null}
      <Text tone={selected ? 'link' : 'secondary'} variant="chip">
        {period}
      </Text>
      <Text variant="section">{price}</Text>
      <Text tone="tertiary" variant="monoSmall">
        {detail}
      </Text>
    </Pressable>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    root: { flex: 1 },
    /** Only the head of the screen: the wash is a treatment, not a ground. */
    wash: { position: 'absolute', left: 0, right: 0, top: 0, height: '62%' },
    close: { alignItems: 'flex-end', paddingHorizontal: space.gutter, paddingTop: space.sm },
    hero: {
      alignItems: 'center',
      gap: space.md,
      paddingHorizontal: space.sectionGap,
      paddingTop: space.xs,
    },
    markHero: { alignItems: 'center', paddingTop: space.xs, paddingBottom: space.md },
    subject: { height: 168, marginBottom: -space.sm },
    subjectBands: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
    centred: { textAlign: 'center' },
    benefits: { paddingHorizontal: space.gutter, paddingTop: space.sectionGap, gap: 9 },
    benefit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.sm,
      paddingHorizontal: space.cardGap,
      paddingVertical: 12,
      borderRadius: skin.round.control,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    benefitLabel: { flex: 1, fontSize: 14 },
    plans: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: space.gutter,
      paddingTop: space.md + 2,
    },
    plan: {
      flex: 1,
      borderRadius: skin.round.card,
      borderWidth: 1,
      borderColor: skin.ui.border.hairlineStrong,
      backgroundColor: skin.ui.fill.card,
      paddingHorizontal: space.cardGap,
      paddingVertical: space.md,
      gap: 6,
    },
    planSelected: {
      borderWidth: 1.5,
      borderColor: skin.ui.action.primary,
      backgroundColor: skin.tint.pro.backgroundColor,
    },
    badge: {
      position: 'absolute',
      right: space.sm,
      top: -10,
      backgroundColor: skin.ui.action.primary,
      borderRadius: skin.round.chip,
      paddingHorizontal: space.xs,
      paddingVertical: 5,
    },
    badgeText: { color: '#FFFFFF', fontSize: 8.5 },
    footer: {
      marginTop: 'auto',
      paddingHorizontal: space.gutter,
      paddingTop: space.md,
      gap: space.sm,
    },
    legalRow: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
    smallPrint: { textAlign: 'center', lineHeight: 16 },
  });
