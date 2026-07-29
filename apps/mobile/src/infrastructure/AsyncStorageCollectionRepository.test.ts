import { collectionSchema } from '@chromawave/domain';

import { AsyncStorageCollectionRepository } from './AsyncStorageCollectionRepository';

describe('AsyncStorageCollectionRepository', () => {
  it('round-trips and replaces a Collection', async () => {
    let value: string | null = null;
    const storage = {
      getItem: jest.fn(async () => value),
      setItem: jest.fn(async (_key: string, nextValue: string) => {
        value = nextValue;
      }),
    };
    const repository = new AsyncStorageCollectionRepository(storage);
    const now = '2026-07-28T08:00:00.000Z';
    const collection = collectionSchema.parse({
      schemaVersion: 1,
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Quiet light',
      createdAt: now,
      updatedAt: now,
      memoryIds: [],
    });

    await repository.save(collection);
    await repository.save({ ...collection, name: 'Quiet light II' });

    expect(await repository.list()).toEqual([{ ...collection, name: 'Quiet light II' }]);
  });

  it('rejects malformed persisted data', async () => {
    const repository = new AsyncStorageCollectionRepository({
      getItem: jest.fn(async () => '{"bad":true}'),
      setItem: jest.fn(),
    });

    await expect(repository.list()).rejects.toMatchObject({ code: 'PERSISTED_DATA_INVALID' });
  });
});
