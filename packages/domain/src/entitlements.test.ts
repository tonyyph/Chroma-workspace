import { describe, expect, it } from 'vitest';

import { canSavePalette, canSaveCollection, hasEntitlement } from './entitlements';

describe('entitlement rules', () => {
  it('centralizes free limits', () => {
    expect(canSavePalette('free', 9)).toBe(true);
    expect(canSavePalette('free', 10)).toBe(false);
    expect(canSaveCollection('free', 5)).toBe(false);
  });

  it('grants premium capabilities by tier', () => {
    expect(hasEntitlement('pro', 'printable_palette')).toBe(false);
    expect(hasEntitlement('premium', 'printable_palette')).toBe(true);
    expect(canSavePalette('pro', 200)).toBe(true);
  });
});
