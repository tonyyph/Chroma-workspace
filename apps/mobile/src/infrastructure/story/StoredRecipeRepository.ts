import { remixRecipeSchema, type RemixRecipe, type StoryRecordProblem } from '@cw/domain';
import type { KeyValueStorage } from '../KeyValueStorage';

export const RECIPE_STORAGE_KEY = '@chromawave/story-recipes:v1';

/** Bounded: a local recipe shelf is a convenience, not an archive. */
const MAX_RECIPES = 60;

/**
 * Remix recipes on disk — locally, and only locally.
 *
 * **There is no publish here, and that is decision D5.** The app has no backend,
 * no accounts and no identity (audit §9), so a recipe goes into a store on this
 * device and comes back out on this device. `06-remix-privacy-model.md` records
 * the API a server would have to offer; nothing in this file reaches one, and
 * nothing here should be extended to until that server exists and someone has
 * consented per item.
 *
 * One key for the whole shelf rather than one per recipe, unlike
 * `StoredStoryRepository`: a recipe is small, there is no autosave writing them
 * during editing, and the reason for the per-project layout there does not apply.
 */
export class StoredRecipeRepository {
  constructor(private readonly storage: KeyValueStorage) {}

  async list(): Promise<{
    recipes: readonly RemixRecipe[];
    problems: readonly StoryRecordProblem[];
  }> {
    const raw = await this.storage.getItem(RECIPE_STORAGE_KEY);
    if (raw === null) return { recipes: [], problems: [] };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        recipes: [],
        problems: [{ index: 0, id: null, issues: 'Stored recipes were not valid JSON.', raw }],
      };
    }

    if (!Array.isArray(parsed)) return { recipes: [], problems: [] };

    const recipes: RemixRecipe[] = [];
    const problems: StoryRecordProblem[] = [];

    // Per record, keeping what validates — the same rule the memory and story
    // repositories follow, and for the same reason.
    for (const [index, record] of parsed.entries()) {
      const result = remixRecipeSchema.safeParse(record);
      if (result.success) recipes.push(result.data);
      else {
        problems.push({
          index,
          id: readId(record),
          issues: result.error.issues
            .slice(0, 5)
            .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
            .join('; '),
          raw: record,
        });
      }
    }

    return { recipes, problems };
  }

  async save(recipe: RemixRecipe): Promise<void> {
    // Validated on the way in as well as out: a recipe is the thing that would
    // travel first if a backend ever arrives, so an invalid one must never be
    // written in the first place.
    const parsed = remixRecipeSchema.parse(recipe);
    const { recipes } = await this.list();
    const next = [parsed, ...recipes.filter((entry) => entry.id !== parsed.id)].slice(
      0,
      MAX_RECIPES,
    );
    await this.storage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(next));
  }

  async remove(id: string): Promise<void> {
    const { recipes } = await this.list();
    await this.storage.setItem(
      RECIPE_STORAGE_KEY,
      JSON.stringify(recipes.filter((entry) => entry.id !== id)),
    );
  }
}

function readId(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null || !('id' in raw)) return null;
  const id = (raw as { id: unknown }).id;
  return typeof id === 'string' ? id : null;
}
