import { DomainError, memorySchema, type Memory } from '@chromawave/domain';

import { AsyncStorageMemoryRepository, type KeyValueStorage } from './AsyncStorageMemoryRepository';

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

const makeMemory = (id: string, capturedAt: string): Memory =>
  memorySchema.parse({
    schemaVersion: 1,
    id,
    createdAt: capturedAt,
    capturedAt,
    visibility: 'private',
    note: null,
    isFavorite: false,
    asset: {
      id: 'd17883bd-23ad-476c-bb09-ff347fe960b0',
      kind: 'original',
      localUri: `file:///${id}.jpg`,
      mediaType: 'image/jpeg',
      width: 800,
      height: 600,
    },
    palette: {
      colors: [
        { hex: '#FFAA00', weight: 0.7, lightness: 0.75, chroma: 0.18, hue: 70 },
        { hex: '#112244', weight: 0.3, lightness: 0.25, chroma: 0.08, hue: 250 },
      ],
      mood: 'warm',
      metrics: { brightness: 60, saturation: 0.5, temperature: 0.5, contrast: 50 },
    },
    musicPairing: null,
    syncStatus: 'local',
  });

describe('AsyncStorageMemoryRepository', () => {
  it('round-trips and orders newest Memories first', async () => {
    const repository = new AsyncStorageMemoryRepository(new MemoryStorage());
    const older = makeMemory('a6a1d672-3870-4427-a259-252c005b7d8a', '2026-07-26T10:00:00.000Z');
    const newer = makeMemory('f1bd046f-78f4-42a2-83d7-4dc697dcc649', '2026-07-27T10:00:00.000Z');

    await repository.save(older);
    await repository.save(newer);

    expect((await repository.list()).map((memory) => memory.id)).toEqual([newer.id, older.id]);
    expect(await repository.getById(older.id)).toEqual(older);
  });

  it('surfaces invalid persisted data without overwriting it', async () => {
    const storage = new MemoryStorage();
    await storage.setItem('@chromawave/memories:v1', '{"not":"a list"}');
    const repository = new AsyncStorageMemoryRepository(storage);

    await expect(repository.list()).rejects.toMatchObject<Partial<DomainError>>({
      code: 'PERSISTED_DATA_INVALID',
    });
  });

  it('updates favorite state without changing the rest of the aggregate', async () => {
    const repository = new AsyncStorageMemoryRepository(new MemoryStorage());
    const memory = makeMemory('a6a1d672-3870-4427-a259-252c005b7d8a', '2026-07-26T10:00:00.000Z');
    await repository.save(memory);

    const updated = await repository.setFavorite(memory.id, true);

    expect(updated).toEqual({ ...memory, isFavorite: true });
    expect(await repository.getById(memory.id)).toEqual(updated);
  });
});
