import {
  storyProjectSchema,
  type StoryProject,
  type StoryProjectRepository,
  type StoryRecordProblem,
} from '@cw/domain';
import type { KeyValueStorage } from '../KeyValueStorage';
import { deleteStoryAssets } from './StoryAssetManager';

export const STORY_INDEX_KEY = '@chromawave/stories:v1';
export const STORY_QUARANTINE_KEY = '@chromawave/story-quarantine:v1';
export const storyKey = (id: string): string => `@chromawave/story:v1:${id}`;

/** Bounded, so a pathological library cannot make the quarantine the largest thing on disk. */
const MAX_QUARANTINE = 50;

/**
 * Story projects on disk — one key per project, not one key per library.
 *
 * **Why the layout differs from `StoredMemoryRepository`.** Memories are small
 * and are written when a user finishes something. A story project is a much
 * larger document that is written *during* editing, by an autosave that fires
 * every few seconds. Keeping the library in one key would mean every autosave
 * serialises every project the user has ever made — work proportional to their
 * whole library for a change to one element of one story, on the interaction
 * path, forever.
 *
 * Per-project keys also isolate corruption at the JSON level rather than only at
 * the schema level. `StoredMemoryRepository` can partition a malformed *record*
 * out of a valid array, but an array that is not valid JSON at all takes the
 * library with it. Here, an unparseable key costs exactly the one project it
 * held.
 *
 * The index is ids only, deliberately. An index carrying titles and timestamps
 * would be denormalised data with two writers, and the copy that goes stale is
 * always the one the list screen reads.
 */
export class StoredStoryRepository implements StoryProjectRepository {
  constructor(private readonly storage: KeyValueStorage) {}

  async list(): Promise<readonly StoryProject[]> {
    const ids = await this.readIndex();
    const projects: StoryProject[] = [];
    const problems: StoryRecordProblem[] = [];

    for (const [index, id] of ids.entries()) {
      const result = await this.readOne(id, index, true);
      if (result.project !== null) projects.push(result.project);
      else if (result.problem !== null) problems.push(result.problem);
    }

    if (problems.length > 0) await this.quarantine(problems);

    // Most recently touched first: a drafts list is a resume list, and the story
    // someone is working on is the one they just closed.
    return projects.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
  }

  async get(id: string): Promise<StoryProject | null> {
    // `indexed: false` — the id came from a caller, not from the index, so a
    // missing key is an ordinary miss rather than evidence of a broken write.
    // Quarantining it would fill the storage report with every id anything ever
    // asked for and did not find.
    const { project, problem } = await this.readOne(id, 0, false);
    if (problem !== null) await this.quarantine([problem]);
    return project;
  }

  /**
   * Writes one project, then makes sure the index knows about it.
   *
   * **Order matters, and this is the safe one.** Writing the project first means
   * an interruption between the two writes leaves an orphaned key — invisible,
   * recoverable, costing only storage. The other order leaves the index pointing
   * at a key that does not exist, which every subsequent `list()` reports as a
   * corrupt project the user never made.
   */
  async save(project: StoryProject): Promise<void> {
    // Validated on the way in as well as out. A write is the cheapest place to
    // catch an invalid document and the only place where refusing it still
    // leaves the user with something they can act on.
    const parsed = storyProjectSchema.parse(project);
    await this.storage.setItem(storyKey(parsed.id), JSON.stringify(parsed));

    const ids = await this.readIndex();
    if (!ids.includes(parsed.id)) {
      await this.storage.setItem(STORY_INDEX_KEY, JSON.stringify([parsed.id, ...ids]));
    }
  }

  /**
   * Removes a project, its key, and every file it owned.
   *
   * The index is updated *first* here — the mirror of `save`, and safe for the
   * mirrored reason. An interruption after the index write leaves an orphaned
   * key rather than an index entry pointing at nothing.
   */
  async remove(id: string): Promise<void> {
    const ids = await this.readIndex();
    await this.storage.setItem(
      STORY_INDEX_KEY,
      JSON.stringify(ids.filter((entry) => entry !== id)),
    );
    await this.storage.removeItem(storyKey(id));
    deleteStoryAssets(id);
  }

  async listInvalid(): Promise<readonly StoryRecordProblem[]> {
    const raw = await this.storage.getItem(STORY_QUARANTINE_KEY);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as StoryRecordProblem[]) : [];
    } catch {
      // The quarantine being unreadable is not worth failing over — it exists to
      // report a problem, not to create one.
      return [];
    }
  }

  /**
   * Reads one key.
   *
   * `indexed` says where the id came from, and it changes what a missing key
   * *means*. From the index, absence is an inconsistency worth reporting — a
   * write was interrupted between the record and the index, and silence would
   * make that unfindable. From a caller, absence just means no such project.
   */
  private async readOne(
    id: string,
    index: number,
    indexed: boolean,
  ): Promise<{ project: StoryProject | null; problem: StoryRecordProblem | null }> {
    const raw = await this.storage.getItem(storyKey(id));
    if (raw === null) {
      if (!indexed) return { project: null, problem: null };
      return {
        project: null,
        problem: { index, id, issues: 'Indexed project has no stored record.', raw: null },
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {
        project: null,
        problem: { index, id, issues: 'Stored project was not valid JSON.', raw },
      };
    }

    const result = storyProjectSchema.safeParse(parsed);
    if (result.success) return { project: result.data, problem: null };

    return {
      project: null,
      problem: {
        index,
        id,
        issues: result.error.issues
          .slice(0, 5)
          .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
          .join('; '),
        raw: parsed,
      },
    };
  }

  private async readIndex(): Promise<readonly string[]> {
    const raw = await this.storage.getItem(STORY_INDEX_KEY);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === 'string')
        : [];
    } catch {
      return [];
    }
  }

  /**
   * Records a problem without destroying what caused it.
   *
   * The offending key is deliberately **not** deleted. A quarantined project is
   * the user's work in a shape this build cannot read, and the difference
   * between "we are not showing this" and "we deleted this" is the whole reason
   * the quarantine exists rather than a `catch` that returns an empty list.
   */
  private async quarantine(problems: readonly StoryRecordProblem[]): Promise<void> {
    const existing = await this.listInvalid();
    const byId = new Map<string, StoryRecordProblem>();
    for (const problem of [...existing, ...problems]) {
      byId.set(problem.id ?? `index:${problem.index}`, problem);
    }
    const combined = [...byId.values()].slice(-MAX_QUARANTINE);
    await this.storage.setItem(STORY_QUARANTINE_KEY, JSON.stringify(combined));
  }
}
