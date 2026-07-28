import { describe, expect, it } from 'vitest';

import { canSaveMemory, canSavePairing, hasEntitlement } from './entitlements';

describe('entitlement rules', () => {
  it('centralizes free limits', () => {
    expect(canSaveMemory('free', 9)).toBe(true);
    expect(canSaveMemory('free', 10)).toBe(false);
    expect(canSavePairing('free', 5)).toBe(false);
  });

  it('grants premium capabilities by tier', () => {
    expect(hasEntitlement('pro', 'printable_palette')).toBe(false);
    expect(hasEntitlement('premium', 'printable_palette')).toBe(true);
    expect(canSaveMemory('pro', 200)).toBe(true);
  });
});
