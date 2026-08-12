import {
  chromaticMemorySchema,
  isColorOnly,
  type ChromaticMemory,
  type ChromaticMemoryRepository,
  type StoredRecordProblem,
} from '@cw/domain';
// Deliberately the module, not the `@/lib` barrel: the barrel also carries
// `export.ts`, which reaches a Skia canvas. Storage has no business pulling a
// rendering module into its graph.
import { deletePhoto } from '@/lib/photos';
import type { KeyValueStorage } from './KeyValueStorage';

export const MEMORY_STORAGE_KEY = '@chromawave/memories:v2';
export const QUARANTINE_STORAGE_KEY = '@chromawave/quarantine:v1';

/**
 * Chromatic Memories on disk.
 *
 * **The one thing this does differently from its v1 predecessor.**
 * `StoredPaletteRepository.list()` calls `paletteListSchema.parse` on the whole
 * array and throws `PERSISTED_DATA_INVALID` if any element fails. That is not a
 * per-record failure — it makes the *entire library* unreadable because one row
 * is malformed, on a device, with no way back.
 *
 * This reads record by record with `safeParse`, keeps everything valid, and puts
 * what is not into a quarantine key that `You → Storage` can report. A corrupt
 * row costs the user that row. It never costs them the library.
 */
export class StoredMemoryRepository implements ChromaticMemoryRepository {
  // Storage is injected rather than defaulted so the backing store is visible
  // at the wiring site — see `dependencies.ts`.
  constructor(private readonly storage: KeyValueStorage) {}

  async list(): Promise<readonly ChromaticMemory[]> {
    return (await this.read()).memories;
  }

  async get(id: string): Promise<ChromaticMemory | null> {
    return (await this.list()).find((memory) => memory.id === id) ?? null;
  }

  async save(memory: ChromaticMemory): Promise<void> {
    // Validated on the way in as well as on the way out. A write is the cheapest
    // place to catch an invalid record, and the only place where refusing it
    // still leaves the user with something they can act on.
    const parsed = chromaticMemorySchema.parse(memory);
    const { memories } = await this.read();
    const next = [parsed, ...memories.filter((item) => item.id !== parsed.id)];
    await this.write(next);
  }

  async remove(id: string): Promise<void> {
    const { memories } = await this.read();
    const target = memories.find((memory) => memory.id === id);

    // Removal is the one choke point every delete goes through, so the frames
    // are cleaned up here rather than at each call site. Dropping only the
    // record would leave orphaned photos that no screen can reach or remove.
    if (target && !isColorOnly(target.image)) {
      deletePhoto(target.image.localUri);
      deletePhoto(target.image.thumbnailUri);
    }

    await this.write(memories.filter((memory) => memory.id !== id));
  }

  async listInvalid(): Promise<readonly StoredRecordProblem[]> {
    const raw = await this.storage.getItem(QUARANTINE_STORAGE_KEY);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as StoredRecordProblem[]) : [];
    } catch {
      // The quarantine itself being unreadable is not worth failing over — it
      // exists to report a problem, not to create one.
      return [];
    }
  }

  /**
   * Reads and partitions. The only path to stored memories.
   *
   * Quarantined records are written back on every read rather than only on
   * migration, because corruption can arrive later — an interrupted write, a
   * device running out of space — and the report should reflect the library as
   * it is now, not as it was the day it was migrated.
   */
  private async read(): Promise<{
    memories: readonly ChromaticMemory[];
    problems: readonly StoredRecordProblem[];
  }> {
    const raw = await this.storage.getItem(MEMORY_STORAGE_KEY);
    if (raw === null) return { memories: [], problems: [] };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Unparseable JSON is not a per-record problem and cannot be partitioned.
      // Reporting an empty library is wrong, but so is throwing: the caller is a
      // screen. The quarantine records the whole blob so nothing is destroyed.
      await this.quarantine([
        { index: 0, id: null, issues: 'Stored memories were not valid JSON.', raw },
      ]);
      return { memories: [], problems: [] };
    }

    if (!Array.isArray(parsed)) {
      await this.quarantine([
        { index: 0, id: null, issues: 'Stored memories were not an array.', raw: parsed },
      ]);
      return { memories: [], problems: [] };
    }

    const memories: ChromaticMemory[] = [];
    const problems: StoredRecordProblem[] = [];

    for (const [index, record] of parsed.entries()) {
      const result = chromaticMemorySchema.safeParse(record);
      if (result.success) memories.push(result.data);
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

    if (problems.length > 0) await this.quarantine(problems);

    return {
      memories: memories.sort(
        (left, right) => Date.parse(right.capturedAt) - Date.parse(left.capturedAt),
      ),
      problems,
    };
  }

  /**
   * Writes only the valid records back.
   *
   * Quarantined rows are deliberately *not* rewritten into the main key: leaving
   * them there means every subsequent read re-validates and re-reports the same
   * corruption forever. They are preserved in the quarantine key instead, which
   * is where recovery tooling would look for them.
   */
  private async write(memories: readonly ChromaticMemory[]): Promise<void> {
    await this.storage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));
  }

  private async quarantine(problems: readonly StoredRecordProblem[]): Promise<void> {
    const existing = await this.listInvalid();
    // Bounded: a pathological library must not turn the quarantine into the
    // largest thing on disk.
    const combined = [...existing, ...problems].slice(-50);
    await this.storage.setItem(QUARANTINE_STORAGE_KEY, JSON.stringify(combined));
  }
}

function readId(raw: unknown): string | null {
  if (typeof raw === 'object' && raw !== null && 'id' in raw) {
    const id = (raw as { id: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}
