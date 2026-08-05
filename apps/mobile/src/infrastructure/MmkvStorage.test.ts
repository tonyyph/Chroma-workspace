import AsyncStorage from '@react-native-async-storage/async-storage';
import { LEGACY_KEYS, MmkvStorage } from './MmkvStorage';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

const legacyStore = (AsyncStorage as unknown as { __store: Map<string, string> }).__store;

beforeEach(() => {
  legacyStore.clear();
  jest.clearAllMocks();
});

describe('MmkvStorage', () => {
  it('round-trips a value', async () => {
    const storage = new MmkvStorage('round-trip');
    await storage.setItem('k', 'v');
    expect(await storage.getItem('k')).toBe('v');
    expect(storage.readSync('k')).toBe('v');

    await storage.removeItem('k');
    expect(await storage.getItem('k')).toBeNull();
  });

  it('returns null rather than undefined for a missing key', async () => {
    // The repositories branch on `=== null`, so undefined would read as a hit.
    const storage = new MmkvStorage('missing');
    expect(await storage.getItem('nope')).toBeNull();
  });
});

describe('migrateFromAsyncStorage', () => {
  it('copies legacy data so an upgrading user keeps their library', async () => {
    legacyStore.set('@chromawave/palettes:v1', '[{"id":"a"}]');
    legacyStore.set('@chromawave/preferences:v1', '{"language":"vi"}');

    const storage = new MmkvStorage('migrate-happy');
    expect(await storage.migrateFromAsyncStorage(LEGACY_KEYS)).toBe(2);
    expect(await storage.getItem('@chromawave/palettes:v1')).toBe('[{"id":"a"}]');
    expect(await storage.getItem('@chromawave/preferences:v1')).toBe('{"language":"vi"}');
  });

  it('leaves the legacy copy intact, so a failed run can be retried', async () => {
    legacyStore.set('@chromawave/palettes:v1', '[]');
    const storage = new MmkvStorage('migrate-nondestructive');
    await storage.migrateFromAsyncStorage(LEGACY_KEYS);
    expect(await AsyncStorage.getItem('@chromawave/palettes:v1')).toBe('[]');
  });

  it('runs once — a second call is a no-op even if legacy data reappears', async () => {
    legacyStore.set('@chromawave/palettes:v1', '["first"]');
    const storage = new MmkvStorage('migrate-once');
    expect(await storage.migrateFromAsyncStorage(LEGACY_KEYS)).toBe(2 - 1);

    legacyStore.set('@chromawave/preferences:v1', '{"language":"en"}');
    expect(await storage.migrateFromAsyncStorage(LEGACY_KEYS)).toBe(0);
    expect(await storage.getItem('@chromawave/preferences:v1')).toBeNull();
  });

  it('never overwrites a value MMKV already holds', async () => {
    const storage = new MmkvStorage('migrate-no-clobber');
    await storage.setItem('@chromawave/palettes:v1', '["newer"]');
    legacyStore.set('@chromawave/palettes:v1', '["older"]');

    await storage.migrateFromAsyncStorage(LEGACY_KEYS);
    expect(await storage.getItem('@chromawave/palettes:v1')).toBe('["newer"]');
  });

  it('keeps going when one key cannot be read', async () => {
    const failing = AsyncStorage.getItem as jest.Mock;
    failing.mockImplementationOnce(async () => {
      throw new Error('disk');
    });
    legacyStore.set('@chromawave/preferences:v1', '{"language":"vi"}');

    const storage = new MmkvStorage('migrate-partial');
    await storage.migrateFromAsyncStorage(LEGACY_KEYS);
    expect(await storage.getItem('@chromawave/preferences:v1')).toBe('{"language":"vi"}');
  });
});
