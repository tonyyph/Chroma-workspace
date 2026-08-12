/**
 * What paying for Chroma Wave buys.
 *
 * **The line is drawn at systems work, not at quantity.** The previous model
 * capped a free library at 10 palettes and 5 sets, which taxes the exact action
 * the product needs someone to repeat: a colour app whose answer to "I used this
 * a lot" is "stop" has mistaken its core loop for a cost centre. Capture, save,
 * tune, tag, collect and check contrast are unlimited and always will be.
 *
 * Pro is the work someone does when a palette has to leave the app and survive
 * contact with a real project — export fidelity, measurement they can trust
 * across a session, and a share card without our name on it.
 *
 * The entitlements this replaced (`spotify_playlist_export`, `ai_pairing`,
 * `premium_animated_export`, `printable_palette`, `custom_mood_tags`) named
 * features of the v1 product — a music-and-memory app this one is no longer
 * related to. None of them had an implementation, a screen, or a trigger.
 */

export const subscriptionTierSchemaValues = ['free', 'pro'] as const;
export type SubscriptionTier = (typeof subscriptionTierSchemaValues)[number];

export type Entitlement =
  /** Share cards and exported images without the wordmark. */
  | 'watermark_free_share'
  /** `--surface` / `--on-surface` in place of `--dominant` / `--support`. */
  | 'semantic_export_names'
  /** The JSON and Swift targets; CSS and Tailwind are free. */
  | 'structured_export'
  /** Holding white balance across a session so a walk's readings compare. */
  | 'locked_white_balance'
  /** Display P3 values alongside sRGB in exports. */
  | 'wide_gamut_export'
  /**
   * The film stocks and per-parameter control over a grade.
   *
   * The *automatic* grade is free and always will be. It is the product's
   * central claim — that a photograph's own colour tells you how to grade it —
   * and charging for the claim is the same mistake as capping the library.
   * What Pro buys is the part that is systems work: taking the derived grade
   * apart and putting it back differently.
   */
  | 'advanced_grading';

const tierEntitlements: Record<SubscriptionTier, ReadonlySet<Entitlement>> = {
  free: new Set(),
  pro: new Set([
    'watermark_free_share',
    'semantic_export_names',
    'structured_export',
    'locked_white_balance',
    'wide_gamut_export',
    'advanced_grading',
  ]),
};

export const hasEntitlement = (tier: SubscriptionTier, entitlement: Entitlement): boolean =>
  tierEntitlements[tier].has(entitlement);

/**
 * Reads the tier, and restores one that was bought on another device.
 *
 * Deliberately async on both sides: whatever eventually implements this talks to
 * StoreKit or a receipt server, and a synchronous interface here would have to
 * be torn out to make room for it.
 */
export interface EntitlementProvider {
  getTier(): Promise<SubscriptionTier>;
  restore(): Promise<SubscriptionTier>;
}
