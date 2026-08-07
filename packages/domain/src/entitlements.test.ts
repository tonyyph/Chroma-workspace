import { describe, expect, it } from 'vitest';

import { hasEntitlement, subscriptionTierSchemaValues, type Entitlement } from './entitlements';

const ALL: readonly Entitlement[] = [
  'watermark_free_share',
  'semantic_export_names',
  'structured_export',
  'locked_white_balance',
  'wide_gamut_export',
];

describe('entitlements', () => {
  it('gives free nothing and pro everything', () => {
    for (const entitlement of ALL) {
      expect(hasEntitlement('free', entitlement)).toBe(false);
      expect(hasEntitlement('pro', entitlement)).toBe(true);
    }
  });

  it('carries exactly two tiers', () => {
    expect(subscriptionTierSchemaValues).toEqual(['free', 'pro']);
  });

  /**
   * The guard on the actual product decision. Capping saves punishes the one
   * action the app needs repeated, so nothing here may gate capturing, saving,
   * tuning, tagging, collecting or checking contrast — those are free at any
   * volume, and an entitlement named for one of them would be the model
   * quietly changing back.
   */
  it('gates no part of the core loop', () => {
    const forbidden = /palette|collection|capture|save|tune|tag|contrast|unlimited/;
    expect(ALL.filter((entitlement) => forbidden.test(entitlement))).toEqual([]);
  });
});
