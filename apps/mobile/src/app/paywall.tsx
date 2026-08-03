import type { PaywallTrigger } from '@chromawave/analytics';
import { useLocalSearchParams } from 'expo-router';

import { PaywallScreen } from '@/features/paywall/PaywallScreen';

const TRIGGERS: readonly PaywallTrigger[] = [
  'merge-set',
  'watermark',
  'json-export',
  'semantic-names',
  'palette-limit',
  'auto-wb',
];

export default function PaywallRoute() {
  const { trigger } = useLocalSearchParams<{ trigger?: string }>();
  // Params are strings from anywhere, so the value is validated rather than cast.
  const resolved = TRIGGERS.find((entry) => entry === trigger) ?? 'unknown';
  return <PaywallScreen trigger={resolved} />;
}
