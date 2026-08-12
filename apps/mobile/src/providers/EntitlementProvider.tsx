import { hasEntitlement, type Entitlement, type SubscriptionTier } from '@cw/domain';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { entitlements } from '@/infrastructure/dependencies';

/**
 * Who the user is to the paywall.
 *
 * Before this, three screens each wrote `isPro={false}` as a literal — so the
 * app had no concept of a paying user at all, and the six paywall triggers led
 * to a screen that could not have changed anything even if it had taken money.
 *
 * The tier is read once and held. It only changes on a purchase or a restore,
 * both of which are explicit user actions that can refresh it, so there is
 * nothing to poll and no reason for a gate to be async at the call site.
 */
type EntitlementState = {
  tier: SubscriptionTier;
  /** False until storage has answered, so no gate flashes unlocked-then-locked. */
  ready: boolean;
  has: (entitlement: Entitlement) => boolean;
  /** Re-reads the tier. Returns it, so a caller can report what it found. */
  restore: () => Promise<SubscriptionTier>;
};

const EntitlementContext = createContext<EntitlementState | null>(null);

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void entitlements
      .getTier()
      .then((next) => {
        if (!cancelled) setTier(next);
      })
      // `StoredEntitlements` already falls back to free rather than throwing;
      // this is the belt to that braces, because a gate that throws on launch
      // takes the whole app down with it.
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const restore = useCallback(async () => {
    const next = await entitlements.restore();
    setTier(next);
    return next;
  }, []);

  const value = useMemo<EntitlementState>(
    () => ({
      tier,
      ready,
      // Locked until storage answers: showing a feature unlocked and then
      // taking it away a frame later is worse than a beat of it being locked.
      has: (entitlement) => (ready ? hasEntitlement(tier, entitlement) : false),
      restore,
    }),
    [tier, ready, restore],
  );

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export function useEntitlements(): EntitlementState {
  const context = useContext(EntitlementContext);
  if (!context) {
    throw new Error('useEntitlements must be used inside an EntitlementProvider.');
  }
  return context;
}

/** The common case: one gate, one boolean. */
export function useEntitlement(entitlement: Entitlement): boolean {
  return useEntitlements().has(entitlement);
}
