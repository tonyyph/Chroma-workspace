import { createStoryProject, storyProjectSchema, toRecipe, type RemixRecipe } from '@cw/domain';
import type { KeyValueStorage } from '../KeyValueStorage';
import { RECIPE_STORAGE_KEY, StoredRecipeRepository } from './StoredRecipeRepository';

class MapStorage implements KeyValueStorage {
  readonly map = new Map<string, string>();
  getItem(key: string) {
    return Promise.resolve(this.map.get(key) ?? null);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
    return Promise.resolve();
  }
  removeItem(key: string) {
    this.map.delete(key);
    return Promise.resolve();
  }
}

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-08-18T09:00:00.000Z';

const recipe = (id: string): RemixRecipe =>
  toRecipe(
    storyProjectSchema.parse(
      createStoryProject({ id: ID, format: 'portrait', slideCount: 2, now: NOW }),
    ),
    { recipeId: id, now: NOW },
  );

describe('StoredRecipeRepository', () => {
  it('reads back what it wrote', async () => {
    const repository = new StoredRecipeRepository(new MapStorage());
    await repository.save(recipe('r1'));

    const { recipes } = await repository.list();
    expect(recipes.map((entry) => entry.id)).toEqual(['r1']);
  });

  it('returns nothing for an empty shelf', async () => {
    expect((await new StoredRecipeRepository(new MapStorage()).list()).recipes).toEqual([]);
  });

  it('replaces rather than duplicating a recipe saved twice', async () => {
    const repository = new StoredRecipeRepository(new MapStorage());
    await repository.save(recipe('r1'));
    await repository.save({ ...recipe('r1'), title: 'Renamed' });

    const { recipes } = await repository.list();
    expect(recipes).toHaveLength(1);
    expect(recipes[0]?.title).toBe('Renamed');
  });

  it('puts the newest first', async () => {
    const repository = new StoredRecipeRepository(new MapStorage());
    await repository.save(recipe('old'));
    await repository.save(recipe('new'));

    expect((await repository.list()).recipes.map((entry) => entry.id)).toEqual(['new', 'old']);
  });

  it('removes one', async () => {
    const repository = new StoredRecipeRepository(new MapStorage());
    await repository.save(recipe('r1'));
    await repository.save(recipe('r2'));
    await repository.remove('r1');

    expect((await repository.list()).recipes.map((entry) => entry.id)).toEqual(['r2']);
  });

  it('refuses to write an invalid recipe', async () => {
    const repository = new StoredRecipeRepository(new MapStorage());
    const broken = { ...recipe('r1'), version: 99 } as unknown as RemixRecipe;

    // A recipe is the thing that would travel first if a backend arrives, so an
    // invalid one must never be written at all.
    await expect(repository.save(broken)).rejects.toThrow();
  });

  it('keeps the readable recipes when one record is corrupt', async () => {
    const storage = new MapStorage();
    const repository = new StoredRecipeRepository(storage);
    await repository.save(recipe('good'));

    storage.map.set(
      RECIPE_STORAGE_KEY,
      JSON.stringify([{ nonsense: true }, ...(await repository.list()).recipes]),
    );

    const { recipes, problems } = await repository.list();
    expect(recipes.map((entry) => entry.id)).toEqual(['good']);
    expect(problems).toHaveLength(1);
  });

  it('survives a shelf that is not valid JSON', async () => {
    const storage = new MapStorage();
    storage.map.set(RECIPE_STORAGE_KEY, '{ not json');

    const { recipes, problems } = await new StoredRecipeRepository(storage).list();
    expect(recipes).toEqual([]);
    expect(problems).toHaveLength(1);
  });

  it('never writes a uri to disk, because a recipe cannot hold one', async () => {
    const storage = new MapStorage();
    await new StoredRecipeRepository(storage).save(recipe('r1'));

    expect(storage.map.get(RECIPE_STORAGE_KEY)).not.toContain('file:');
  });
});
