export const subscriptionTierSchemaValues = ['free', 'pro', 'premium'] as const;
export type SubscriptionTier = (typeof subscriptionTierSchemaValues)[number];

export type Entitlement =
  | 'advanced_filters'
  | 'ai_pairing'
  | 'custom_mood_tags'
  | 'high_quality_export'
  | 'premium_animated_export'
  | 'printable_palette'
  | 'spotify_playlist_export'
  | 'unlimited_palettes'
  | 'unlimited_pairings';

const tierEntitlements: Record<SubscriptionTier, ReadonlySet<Entitlement>> = {
  free: new Set(),
  pro: new Set([
    'advanced_filters',
    'ai_pairing',
    'custom_mood_tags',
    'high_quality_export',
    'unlimited_palettes',
    'unlimited_pairings',
  ]),
  premium: new Set([
    'advanced_filters',
    'ai_pairing',
    'custom_mood_tags',
    'high_quality_export',
    'premium_animated_export',
    'printable_palette',
    'spotify_playlist_export',
    'unlimited_palettes',
    'unlimited_pairings',
  ]),
};

export const hasEntitlement = (tier: SubscriptionTier, entitlement: Entitlement): boolean =>
  tierEntitlements[tier].has(entitlement);

export const canSavePalette = (tier: SubscriptionTier, currentCount: number): boolean =>
  hasEntitlement(tier, 'unlimited_palettes') || currentCount < 10;

export const canSaveCollection = (tier: SubscriptionTier, currentCount: number): boolean =>
  hasEntitlement(tier, 'unlimited_pairings') || currentCount < 5;

export interface EntitlementProvider {
  getTier(): Promise<SubscriptionTier>;
  restore(): Promise<SubscriptionTier>;
}
