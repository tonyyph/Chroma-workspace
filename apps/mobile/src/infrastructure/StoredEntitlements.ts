import {
  subscriptionTierSchemaValues,
  type EntitlementProvider,
  type SubscriptionTier,
} from '@chromawave/domain';
import type { KeyValueStorage } from './KeyValueStorage';

export const ENTITLEMENT_STORAGE_KEY = '@chromawave/entitlement:v1';

/**
 * The tier, read from local storage.
 *
 * There is no billing provider in this build, so there is nothing to ask and
 * `restore` truthfully finds nothing. What this *does* do is put the whole app
 * behind the real interface: every gate now reads a tier instead of a hardcoded
 * `false`, so wiring StoreKit later replaces this one class and touches no
 * screen.
 *
 * An unrecognised stored value falls back to `free` rather than throwing. A
 * corrupt receipt should lock features, never brick the app — and this is the
 * one repository where refusing to load would strand a paying user.
 */
export class StoredEntitlements implements EntitlementProvider {
  constructor(private readonly storage: KeyValueStorage) {}

  async getTier(): Promise<SubscriptionTier> {
    const raw = await this.storage.getItem(ENTITLEMENT_STORAGE_KEY);
    return subscriptionTierSchemaValues.find((tier) => tier === raw) ?? 'free';
  }

  /**
   * Nothing to query, so nothing is found. The button must be reachable and
   * must answer — that is the App Store requirement, and it is also just honest
   * about a build with no purchases to restore.
   */
  async restore(): Promise<SubscriptionTier> {
    return this.getTier();
  }

  /** Not part of the interface: only a real purchase flow may grant a tier. */
  async grant(tier: SubscriptionTier): Promise<void> {
    await this.storage.setItem(ENTITLEMENT_STORAGE_KEY, tier);
  }
}
