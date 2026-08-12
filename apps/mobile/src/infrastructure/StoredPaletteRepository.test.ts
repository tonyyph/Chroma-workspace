import { DomainError, makeColor, type Palette } from '@cw/domain';
import { seedPalettes } from '@/data';
import type { KeyValueStorage } from './KeyValueStorage';
import { StoredPaletteRepository } from './StoredPaletteRepository';

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

const palette = (id: string): Palette => ({
  grade: null,
  schemaVersion: 1,
  id,
  name: 'Harbour dusk',
  createdAt: '2026-08-01T00:00:00.000Z',
  capturedAt: '2026-08-01T00:00:00.000Z',
  source: 'photo',
  colors: [makeColor('#7C5CFF', 0.6, 'dominant'), makeColor('#22D3EE', 0.4, 'support')],
  tags: [],
  location: null,
  photoUri: null,
  deltaE: 2,
  confidence: 0.9,
  space: 'srgb',
  tuned: false,
  setIds: [],
  isPinned: false,
});

describe('StoredPaletteRepository', () => {
  /**
   * The regression that matters: four example palettes used to be written on
   * first launch, so a new user's first capture arrived as the fifth card in
   * someone else's collection. The examples still exist — the library's empty
   * state offers them — but nothing writes them without being asked.
   */
  it('gives a new install an empty library rather than four palettes it did not make', async () => {
    const storage = new MapStorage();
    const repository = new StoredPaletteRepository(storage);

    expect(await repository.list()).toEqual([]);
    // Nothing was written either — a read must not create storage.
    expect(storage.values.size).toBe(0);
  });

  it('stays empty across repeated reads', async () => {
    const repository = new StoredPaletteRepository(new MapStorage());
    await repository.list();
    expect(await repository.list()).toEqual([]);
  });

  it('round-trips a saved palette', async () => {
    const repository = new StoredPaletteRepository(new MapStorage());
    const saved = palette('11111111-1111-4111-8111-111111111111');

    await repository.save(saved);

    expect(await repository.list()).toEqual([saved]);
    expect(await repository.get(saved.id)).toEqual(saved);
  });

  it('still accepts the examples when the library asks for them', async () => {
    const repository = new StoredPaletteRepository(new MapStorage());
    for (const example of seedPalettes()) await repository.save(example);

    expect(await repository.list()).toHaveLength(seedPalettes().length);
  });

  it('removes a palette without disturbing the rest', async () => {
    const repository = new StoredPaletteRepository(new MapStorage());
    const first = palette('11111111-1111-4111-8111-111111111111');
    const second = palette('22222222-2222-4222-8222-222222222222');
    await repository.save(first);
    await repository.save(second);

    await repository.remove(first.id);

    expect((await repository.list()).map((entry) => entry.id)).toEqual([second.id]);
  });

  it('surfaces corrupt storage rather than quietly returning nothing', async () => {
    const storage = new MapStorage();
    await storage.setItem('@chromawave/palettes:v1', '[{"id":"not-a-palette"}]');
    const repository = new StoredPaletteRepository(storage);

    await expect(repository.list()).rejects.toBeInstanceOf(DomainError);
  });
});
