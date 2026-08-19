import type { PaywallTrigger } from '@cw/analytics';
import { useLocalSearchParams } from 'expo-router';
import { PaywallScreen } from '@/features/paywall/PaywallScreen';
import { usePalettes } from '@/hooks';

const TRIGGERS: readonly PaywallTrigger[] = [
  'watermark',
  'effects',
  'json-export',
  'semantic-names',
  'auto-wb',
  'pro-tools',
];

export default function PaywallRoute() {
  const { trigger } = useLocalSearchParams<{ trigger?: string }>();
  const { palettes } = usePalettes();
  // Params are strings from anywhere, so the value is validated rather than cast.
  const resolved = TRIGGERS.find((entry) => entry === trigger) ?? 'unknown';
  // The most recent palette is the one they were just looking at when they hit
  // the gate, which is what makes the hero *their* work rather than a sample.
  return <PaywallScreen palette={palettes[0] ?? null} trigger={resolved} />;
}
