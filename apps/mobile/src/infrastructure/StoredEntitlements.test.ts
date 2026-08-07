import type { KeyValueStorage } from './KeyValueStorage';
import { ENTITLEMENT_STORAGE_KEY, StoredEntitlements } from './StoredEntitlements';

class MapStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.values.delete(key);
  }
}

describe('StoredEntitlements', () => {
  it('treats an untouched install as free', async () => {
    expect(await new StoredEntitlements(new MapStorage()).getTier()).toBe('free');
  });

  it('round-trips a granted tier', async () => {
    const entitlements = new StoredEntitlements(new MapStorage());
    await entitlements.grant('pro');
    expect(await entitlements.getTier()).toBe('pro');
  });

  /**
   * The one place refusing to load would be worse than loading wrong: a corrupt
   * receipt should lock features, never brick the launch.
   */
  it('falls back to free on an unrecognised stored value rather than throwing', async () => {
    const storage = new MapStorage();
    await storage.setItem(ENTITLEMENT_STORAGE_KEY, 'platinum');
    await expect(new StoredEntitlements(storage).getTier()).resolves.toBe('free');
  });

  it('restores whatever is on this device, which for a free install is nothing', async () => {
    expect(await new StoredEntitlements(new MapStorage()).restore()).toBe('free');
  });
});
