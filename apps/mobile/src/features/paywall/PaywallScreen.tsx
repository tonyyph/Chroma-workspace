import type { PaywallTrigger } from '@chromawave/analytics';
import { brandBands, round, space, ui } from '@chromawave/design-tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { analytics } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';
import { Button, Card, Text } from '@/ui';

type Plan = 'monthly' | 'yearly';

/**
 * D1 · PAYWALL · "PRO badge variant of the mark".
 *
 * "Premium is 'the complete wave': free gets two bands of value, Pro unlocks the
 * third. No gold, no crown, no dark patterns." Price, period and Restore are all
 * above the fold, which is also the submission requirement from the build kit.
 */
export function PaywallScreen({ trigger = 'unknown' }: { trigger?: PaywallTrigger }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [plan, setPlan] = useState<Plan>('yearly');
  const { t } = usePreferences();

  useEffect(() => {
    analytics.track('paywall_shown', { trigger });
  }, [trigger]);

  const benefits = [
    { color: brandBands[0], label: t('paywall.benefit1') },
    { color: brandBands[1], label: t('paywall.benefit2') },
    { color: brandBands[2], label: t('paywall.benefit3') },
  ];

  return (
    <LinearGradient
      colors={['#241C4A', ui.bg.base]}
      end={{ x: 0.5, y: 0.62 }}
      start={{ x: 0.5, y: 0 }}
      style={[styles.root, { paddingTop: insets.top }]}
    >
      <View style={styles.close}>
        <Pressable
          accessibilityLabel={t('paywall.close')}
          accessibilityRole="button"
          hitSlop={12}
          onPress={router.back}
        >
          <Text tone="tertiary" variant="mono">
            ✕
          </Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <BrandMark size={104} />
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
        <View style={styles.legalRow}>
          {(['paywall.restore', 'paywall.terms', 'paywall.privacy'] as const).map((key) => (
            <Text key={key} tone="tertiary" variant="chip">
              {t(key)}
            </Text>
          ))}
        </View>
        <Text style={styles.smallPrint} tone="tertiary" variant="monoSmall">
          {plan === 'yearly'
            ? t('paywall.smallPrintYearly', { price: '$35.99' })
            : t('paywall.smallPrintMonthly', { price: '$4.99' })}
        </Text>
      </View>
    </LinearGradient>
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  close: { alignItems: 'flex-end', paddingHorizontal: space.gutter, paddingTop: space.sm },
  hero: {
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.sectionGap,
    paddingTop: space.xs,
  },
  centred: { textAlign: 'center' },
  benefits: { paddingHorizontal: space.gutter, paddingTop: space.sectionGap, gap: 9 },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.cardGap,
    paddingVertical: 12,
    borderRadius: round.control,
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
    borderRadius: round.card,
    borderWidth: 1,
    borderColor: ui.border.hairlineStrong,
    backgroundColor: ui.fill.card,
    paddingHorizontal: space.cardGap,
    paddingVertical: space.md,
    gap: 6,
  },
  planSelected: {
    borderWidth: 1.5,
    borderColor: ui.action.primary,
    backgroundColor: 'rgba(124,92,255,.18)',
  },
  badge: {
    position: 'absolute',
    right: space.sm,
    top: -10,
    backgroundColor: ui.action.primary,
    borderRadius: 8,
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
