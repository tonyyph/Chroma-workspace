import {
  addAsset,
  addElement,
  createStoryProject,
  setTitle,
  storyElementSchema,
  type StoryAsset,
  type StoryElement,
  type StoryProject,
} from '@cw/domain';
import type { KeyValueStorage } from '../KeyValueStorage';
import {
  STORY_INDEX_KEY,
  STORY_QUARANTINE_KEY,
  StoredStoryRepository,
  storyKey,
} from './StoredStoryRepository';

// The asset manager reaches the file system; storage tests have no business
// there. Deletion is asserted through the spy rather than through a real folder.
// The `mock` prefix is required: jest hoists the factory above this file's
// declarations, and only names matching /^mock/i may be referenced from inside it.
const mockDeleteStoryAssets = jest.fn();
jest.mock('./StoryAssetManager', () => ({
  deleteStoryAssets: (id: string) => mockDeleteStoryAssets(id),
}));

class MapStorage implements KeyValueStorage {
  readonly map = new Map<string, string>();

  getItem(key: string): Promise<string | null> {
    return Promise.resolve(this.map.get(key) ?? null);
  }

  setItem(key: string, value: string): Promise<void> {
    this.map.set(key, value);
    return Promise.resolve();
  }

  removeItem(key: string): Promise<void> {
    this.map.delete(key);
    return Promise.resolve();
  }
}

const ID = (n: number): string => `${n}1111111-1111-4111-8111-111111111111`;
const NOW = '2026-08-17T09:00:00.000Z';

const asset: StoryAsset = {
  id: 'a',
  uri: 'file:///story-assets/a.jpg',
  width: 3000,
  height: 4000,
  previewUri: null,
  createdAt: NOW,
};

const photo: StoryElement = storyElementSchema.parse({
  kind: 'photo',
  id: 'p',
  frame: { x: 0, y: 0, width: 400, height: 400 },
  rotation: 0,
  opacity: 1,
  locked: false,
  hidden: false,
  assetId: 'a',
  sourceWidth: 3000,
  sourceHeight: 4000,
  crop: { x: 0, y: 0, width: 1, height: 1 },
});

const project = (n: number, updatedAt = NOW): StoryProject => {
  const created = createStoryProject({ id: ID(n), format: 'portrait', slideCount: 3, now: NOW });
  return { ...addElement(addAsset(created, asset, NOW), photo, NOW), updatedAt };
};

describe('StoredStoryRepository', () => {
  beforeEach(() => {
    mockDeleteStoryAssets.mockClear();
  });

  it('reads back what it wrote', async () => {
    const storage = new MapStorage();
    const repository = new StoredStoryRepository(storage);

    await repository.save(project(1));

    expect(await repository.get(ID(1))).toEqual(project(1));
    expect((await repository.list()).map((entry) => entry.id)).toEqual([ID(1)]);
  });

  it('returns nothing for an empty store rather than failing', async () => {
    const repository = new StoredStoryRepository(new MapStorage());
    expect(await repository.list()).toEqual([]);
    expect(await repository.get(ID(1))).toBeNull();
    expect(await repository.listInvalid()).toEqual([]);
  });

  it('gives each project its own key, so autosave does not rewrite the library', async () => {
    const storage = new MapStorage();
    const repository = new StoredStoryRepository(storage);

    await repository.save(project(1));
    await repository.save(project(2));

    expect(storage.map.has(storyKey(ID(1)))).toBe(true);
    expect(storage.map.has(storyKey(ID(2)))).toBe(true);
    // The index carries ids only — no titles, no timestamps to go stale.
    expect(JSON.parse(storage.map.get(STORY_INDEX_KEY) ?? '[]')).toEqual([ID(2), ID(1)]);
  });

  it('does not duplicate an index entry when a project is saved repeatedly', async () => {
    const storage = new MapStorage();
    const repository = new StoredStoryRepository(storage);

    await repository.save(project(1));
    await repository.save(setTitle(project(1), 'Blue Hour', NOW));
    await repository.save(setTitle(project(1), 'Blue Hour, later', NOW));

    expect(JSON.parse(storage.map.get(STORY_INDEX_KEY) ?? '[]')).toEqual([ID(1)]);
    expect((await repository.get(ID(1)))?.title).toBe('Blue Hour, later');
  });

  it('lists most recently updated first, because a drafts list is a resume list', async () => {
    const repository = new StoredStoryRepository(new MapStorage());

    await repository.save(project(1, '2026-08-01T00:00:00.000Z'));
    await repository.save(project(2, '2026-08-17T00:00:00.000Z'));
    await repository.save(project(3, '2026-08-09T00:00:00.000Z'));

    expect((await repository.list()).map((entry) => entry.id)).toEqual([ID(2), ID(3), ID(1)]);
  });

  it('refuses to write an invalid document', async () => {
    const repository = new StoredStoryRepository(new MapStorage());
    const broken = { ...project(1), canvas: { width: 1, height: 1 } };

    await expect(repository.save(broken)).rejects.toThrow();
  });

  it('removes the project, its key and its files', async () => {
    const storage = new MapStorage();
    const repository = new StoredStoryRepository(storage);

    await repository.save(project(1));
    await repository.save(project(2));
    await repository.remove(ID(1));

    expect(storage.map.has(storyKey(ID(1)))).toBe(false);
    expect(JSON.parse(storage.map.get(STORY_INDEX_KEY) ?? '[]')).toEqual([ID(2)]);
    expect(mockDeleteStoryAssets).toHaveBeenCalledWith(ID(1));
  });
});

describe('one bad record never costs the library', () => {
  it('keeps the readable projects when one key holds invalid JSON', async () => {
    const storage = new MapStorage();
    const repository = new StoredStoryRepository(storage);

    await repository.save(project(1));
    await repository.save(project(2));
    storage.map.set(storyKey(ID(1)), '{ not json');

    const listed = await repository.list();
    expect(listed.map((entry) => entry.id)).toEqual([ID(2)]);

    const problems = await repository.listInvalid();
    expect(problems).toHaveLength(1);
    expect(problems[0]?.issues).toContain('not valid JSON');
  });

  it('keeps the readable projects when one record fails validation', async () => {
    const storage = new MapStorage();
    const repository = new StoredStoryRepository(storage);

    await repository.save(project(1));
    await repository.save(project(2));
    storage.map.set(
      storyKey(ID(2)),
      JSON.stringify({ ...project(2), canvas: { width: 5, height: 5 } }),
    );

    expect((await repository.list()).map((entry) => entry.id)).toEqual([ID(1)]);
    expect(await repository.listInvalid()).toHaveLength(1);
  });

  it('reports an index entry whose record was never written', async () => {
    const storage = new MapStorage();
    const repository = new StoredStoryRepository(storage);

    await repository.save(project(1));
    storage.map.delete(storyKey(ID(1)));

    expect(await repository.list()).toEqual([]);
    expect((await repository.listInvalid())[0]?.issues).toContain('no stored record');
  });

  it('never deletes the key that failed, so the work can still be recovered', async () => {
    const storage = new MapStorage();
    const repository = new StoredStoryRepository(storage);

    await repository.save(project(1));
    storage.map.set(storyKey(ID(1)), '{ not json');
    await repository.list();

    expect(storage.map.get(storyKey(ID(1)))).toBe('{ not json');
  });

  it('does not let the quarantine grow without bound on repeated reads', async () => {
    const storage = new MapStorage();
    const repository = new StoredStoryRepository(storage);

    await repository.save(project(1));
    storage.map.set(storyKey(ID(1)), '{ not json');

    for (let attempt = 0; attempt < 10; attempt += 1) await repository.list();

    // One broken project is one problem however many times it is read.
    expect(await repository.listInvalid()).toHaveLength(1);
  });

  it('survives a quarantine key that is itself unreadable', async () => {
    const storage = new MapStorage();
    const repository = new StoredStoryRepository(storage);
    storage.map.set(STORY_QUARANTINE_KEY, 'not json either');

    expect(await repository.listInvalid()).toEqual([]);
  });

  it('survives an index that is not an array', async () => {
    const storage = new MapStorage();
    const repository = new StoredStoryRepository(storage);
    storage.map.set(STORY_INDEX_KEY, '{"nope":true}');

    expect(await repository.list()).toEqual([]);
  });
});
