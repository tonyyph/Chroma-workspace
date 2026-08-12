import { makeColor, type Palette } from '@cw/domain';
import type { KeyValueStorage } from './KeyValueStorage';
import {
  CURRENT_DATA_VERSION,
  MIGRATION_STATE_KEY,
  PALETTE_STORAGE_KEY,
  migrateToMemories,
} from './migrateMemories';
import { MEMORY_STORAGE_KEY, QUARANTINE_STORAGE_KEY } from './StoredMemoryRepository';

jest.mock('@/lib/photos', () => ({ deletePhoto: jest.fn() }));

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

const uuid = (n: number) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;

const palette = (n: number, overrides: Partial<Palette> = {}): Palette => ({
  thumbnailUri: null,
  grade: null,
  schemaVersion: 1,
  id: uuid(n),
  name: `Capture ${n}`,
  createdAt: '2026-08-01T00:00:00.000Z',
  capturedAt: '2026-08-01T00:00:00.000Z',
  source: 'photo',
  colors: [makeColor('#7C5CFF', 0.6, 'dominant'), makeColor('#22D3EE', 0.4, 'support')],
  tags: ['a'],
  location: 'Oslo',
  photoUri: 'file:///photos/a.jpg',
  deltaE: 2,
  confidence: 0.9,
  space: 'srgb',
  tuned: false,
  setIds: [],
  isPinned: false,
  ...overrides,
});

const withV1 = async (storage: MapStorage, palettes: unknown[]) => {
  await storage.setItem(PALETTE_STORAGE_KEY, JSON.stringify(palettes));
};

const readMemories = (storage: MapStorage): unknown[] =>
  JSON.parse(storage.values.get(MEMORY_STORAGE_KEY) ?? '[]');

describe('migrateToMemories', () => {
  it('does nothing on a fresh install and records that it ran', async () => {
    const storage = new MapStorage();
    const report = await migrateToMemories(storage);

    expect(report.outcome).toBe('nothing-to-do');
    expect(storage.values.has(MEMORY_STORAGE_KEY)).toBe(false);
    expect(storage.values.has(MIGRATION_STATE_KEY)).toBe(true);
  });

  it('widens a v1 library into memories', async () => {
    const storage = new MapStorage();
    await withV1(storage, [palette(1), palette(2), palette(3)]);

    const report = await migrateToMemories(storage);

    expect(report.outcome).toBe('migrated');
    expect(report.migrated).toBe(3);
    expect(readMemories(storage)).toHaveLength(3);
  });

  it('never deletes the v1 key — it is the rollback', async () => {
    const storage = new MapStorage();
    const original = [palette(1)];
    await withV1(storage, original);

    await migrateToMemories(storage);

    expect(JSON.parse(storage.values.get(PALETTE_STORAGE_KEY)!)).toEqual(original);
  });

  it('is idempotent across launches', async () => {
    const storage = new MapStorage();
    await withV1(storage, [palette(1), palette(2)]);

    await migrateToMemories(storage);
    const first = storage.values.get(MEMORY_STORAGE_KEY);

    const second = await migrateToMemories(storage);

    expect(second.outcome).toBe('already-current');
    expect(storage.values.get(MEMORY_STORAGE_KEY)).toBe(first);
  });

  it('recovers from a run that died after writing memories but before the marker', async () => {
    const storage = new MapStorage();
    await withV1(storage, [palette(1)]);
    await migrateToMemories(storage);

    // Simulate the crash window: records present, state marker missing.
    const written = storage.values.get(MEMORY_STORAGE_KEY)!;
    storage.values.delete(MIGRATION_STATE_KEY);

    const report = await migrateToMemories(storage);

    expect(report.outcome).toBe('already-current');
    // The existing records are left exactly as they were, not rewritten blindly.
    expect(storage.values.get(MEMORY_STORAGE_KEY)).toBe(written);
  });

  it('quarantines a corrupt record and migrates the rest', async () => {
    const storage = new MapStorage();
    await withV1(storage, [palette(1), { id: uuid(9), nonsense: true }, palette(2)]);

    const report = await migrateToMemories(storage);

    expect(report.migrated).toBe(2);
    expect(report.quarantined).toHaveLength(1);
    expect(storage.values.has(QUARANTINE_STORAGE_KEY)).toBe(true);
    expect(readMemories(storage)).toHaveLength(2);
  });

  it('writes nothing and leaves v1 intact when the stored value is unusable', async () => {
    const storage = new MapStorage();
    await storage.setItem(PALETTE_STORAGE_KEY, JSON.stringify({ not: 'an array' }));

    const report = await migrateToMemories(storage);

    expect(report.outcome).toBe('aborted');
    expect(storage.values.has(MEMORY_STORAGE_KEY)).toBe(false);
    // No marker either, so a fixed build can try again.
    expect(storage.values.has(MIGRATION_STATE_KEY)).toBe(false);
  });

  it('treats unparseable v1 storage as nothing to migrate rather than crashing launch', async () => {
    const storage = new MapStorage();
    await storage.setItem(PALETTE_STORAGE_KEY, '{not json');

    const report = await migrateToMemories(storage);

    expect(report.outcome).toBe('nothing-to-do');
    expect(storage.values.has(MEMORY_STORAGE_KEY)).toBe(false);
  });

  it('records the data version it reached', async () => {
    const storage = new MapStorage();
    await withV1(storage, [palette(1)]);
    await migrateToMemories(storage);

    const state = JSON.parse(storage.values.get(MIGRATION_STATE_KEY)!);
    expect(state.version).toBe(CURRENT_DATA_VERSION);
    expect(state.migrated).toBe(1);
  });

  it('carries a palette with no photograph across as a colour-only memory', async () => {
    const storage = new MapStorage();
    await withV1(storage, [palette(1, { photoUri: null })]);

    await migrateToMemories(storage);

    const [memory] = readMemories(storage) as { image: { source: string } }[];
    expect(memory!.image.source).toBe('legacy');
  });
});
