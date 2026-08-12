import { makeColor, paletteToMemory, type ChromaticMemory, type Palette } from '@cw/domain';
import type { KeyValueStorage } from './KeyValueStorage';
import { MEMORY_STORAGE_KEY, StoredMemoryRepository } from './StoredMemoryRepository';

// `mock`-prefixed so jest's hoisting rule allows the factory to close over it.
const mockDeletePhoto = jest.fn();
jest.mock('@/lib/photos', () => ({ deletePhoto: (uri: string | null) => mockDeletePhoto(uri) }));

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
  schemaVersion: 1,
  id: uuid(n),
  name: `Capture ${n}`,
  createdAt: '2026-08-01T00:00:00.000Z',
  capturedAt: `2026-08-0${Math.min(9, n)}T00:00:00.000Z`,
  source: 'photo',
  colors: [makeColor('#7C5CFF', 0.6, 'dominant'), makeColor('#22D3EE', 0.4, 'support')],
  tags: [],
  location: null,
  photoUri: 'file:///photos/a.jpg',
  deltaE: 2,
  confidence: 0.9,
  space: 'srgb',
  tuned: false,
  setIds: [],
  isPinned: false,
  ...overrides,
});

const memory = (n: number, overrides: Partial<Palette> = {}): ChromaticMemory =>
  paletteToMemory(palette(n, overrides));

const seed = async (storage: MapStorage, records: unknown[]) => {
  await storage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(records));
};

beforeEach(() => mockDeletePhoto.mockClear());

describe('StoredMemoryRepository', () => {
  it('returns an empty library rather than failing on a fresh install', async () => {
    const repository = new StoredMemoryRepository(new MapStorage());
    expect(await repository.list()).toEqual([]);
    expect(await repository.listInvalid()).toEqual([]);
  });

  it('round-trips a saved memory', async () => {
    const storage = new MapStorage();
    const repository = new StoredMemoryRepository(storage);
    await repository.save(memory(1));
    expect(await repository.get(uuid(1))).toEqual(memory(1));
  });

  it('replaces rather than duplicating on re-save', async () => {
    const storage = new MapStorage();
    const repository = new StoredMemoryRepository(storage);
    await repository.save(memory(1));
    await repository.save({ ...memory(1), isPinned: true });
    const all = await repository.list();
    expect(all).toHaveLength(1);
    expect(all[0]!.isPinned).toBe(true);
  });

  it('returns memories newest first', async () => {
    const storage = new MapStorage();
    const repository = new StoredMemoryRepository(storage);
    await repository.save(memory(1));
    await repository.save(memory(5));
    await repository.save(memory(3));
    expect((await repository.list()).map((m) => m.id)).toEqual([uuid(5), uuid(3), uuid(1)]);
  });

  /**
   * The behaviour this class exists for. v1 threw on the whole collection, which
   * lost the library rather than the row.
   */
  it('keeps every valid record when one is corrupt', async () => {
    const storage = new MapStorage();
    await seed(storage, [memory(1), { id: uuid(9), broken: true }, memory(2)]);

    const repository = new StoredMemoryRepository(storage);
    const all = await repository.list();

    expect(all).toHaveLength(2);
    expect(all.map((m) => m.id).sort()).toEqual([uuid(1), uuid(2)].sort());
  });

  it('reports the corrupt record rather than dropping it silently', async () => {
    const storage = new MapStorage();
    const broken = { id: uuid(9), broken: true };
    await seed(storage, [memory(1), broken]);

    const repository = new StoredMemoryRepository(storage);
    await repository.list();

    const problems = await repository.listInvalid();
    expect(problems).toHaveLength(1);
    expect(problems[0]!.id).toBe(uuid(9));
    expect(problems[0]!.raw).toEqual(broken);
    expect(problems[0]!.issues).toBeTruthy();
  });

  it('survives storage that is not valid JSON', async () => {
    const storage = new MapStorage();
    await storage.setItem(MEMORY_STORAGE_KEY, '{not json');

    const repository = new StoredMemoryRepository(storage);
    expect(await repository.list()).toEqual([]);
    // The unreadable blob is preserved rather than overwritten.
    expect(await repository.listInvalid()).toHaveLength(1);
  });

  it('survives storage that is not an array', async () => {
    const storage = new MapStorage();
    await storage.setItem(MEMORY_STORAGE_KEY, JSON.stringify({ memories: [] }));

    const repository = new StoredMemoryRepository(storage);
    expect(await repository.list()).toEqual([]);
    expect(await repository.listInvalid()).toHaveLength(1);
  });

  it('refuses to write an invalid memory', async () => {
    const repository = new StoredMemoryRepository(new MapStorage());
    const broken = { ...memory(1), palette: { ...memory(1).palette, colors: [] } };
    await expect(repository.save(broken as ChromaticMemory)).rejects.toThrow();
  });

  it('deletes the photograph along with the record', async () => {
    const storage = new MapStorage();
    const repository = new StoredMemoryRepository(storage);
    await repository.save(memory(1));
    await repository.remove(uuid(1));

    expect(mockDeletePhoto).toHaveBeenCalledWith('file:///photos/a.jpg');
    expect(await repository.list()).toEqual([]);
  });

  it('does not try to delete a colour-only memory frame', async () => {
    const storage = new MapStorage();
    const repository = new StoredMemoryRepository(storage);
    await repository.save(memory(1, { photoUri: null }));
    await repository.remove(uuid(1));

    // The sentinel uri is not a file, and passing it to the filesystem would be
    // a request to delete something that was never there.
    expect(mockDeletePhoto).not.toHaveBeenCalled();
  });

  it('removing an id it does not hold is not an error', async () => {
    const repository = new StoredMemoryRepository(new MapStorage());
    await expect(repository.remove(uuid(42))).resolves.toBeUndefined();
  });

  it('writes no audio URL to storage', async () => {
    const storage = new MapStorage();
    const repository = new StoredMemoryRepository(storage);
    await repository.save(memory(1));
    expect(storage.values.get(MEMORY_STORAGE_KEY)).not.toMatch(/\.mp3|\.m4a|previewUrl/i);
  });
});
