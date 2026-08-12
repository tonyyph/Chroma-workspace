import { migratePalettes, type MigrationReport } from '@cw/domain';
import type { KeyValueStorage } from './KeyValueStorage';
import { MEMORY_STORAGE_KEY, QUARANTINE_STORAGE_KEY } from './StoredMemoryRepository';

/** v1's key. Read, never written, never deleted — it is the rollback. See docs/09. */
export const PALETTE_STORAGE_KEY = '@chromawave/palettes:v1';
export const MIGRATION_STATE_KEY = '@chromawave/migration:state';

export const CURRENT_DATA_VERSION = 2;

type MigrationState = {
  version: number;
  migratedAt: string;
  migrated: number;
  quarantined: number;
};

/**
 * Turns a v1 palette library into v2 memories, once, at launch.
 *
 * Sits beside `MmkvStorage.migrateFromAsyncStorage` in `dependencies.ts`, which
 * established the pattern: idempotent, safe to call on every launch, and it
 * never destroys the source it read from.
 *
 * **Ordering matters and is the whole safety argument.** The memories are
 * written *before* the state marker. If the process dies between the two, the
 * next launch re-runs the migration and overwrites the same records with
 * identical output — wasteful, and harmless. Writing the marker first would
 * leave a half-written library marked as complete, which is the one outcome
 * there is no recovery from.
 */
export async function migrateToMemories(storage: KeyValueStorage): Promise<MigrationReport> {
  const already = await readState(storage);
  if (already !== null && already.version >= CURRENT_DATA_VERSION) {
    return { outcome: 'already-current', migrated: 0, quarantined: [], abortReason: null };
  }

  // An install that already has v2 records but no state marker — a previous run
  // that died after the write. Nothing to do but record it.
  const existingMemories = await storage.getItem(MEMORY_STORAGE_KEY);
  if (existingMemories !== null) {
    await writeState(storage, { migrated: 0, quarantined: 0 });
    return { outcome: 'already-current', migrated: 0, quarantined: [], abortReason: null };
  }

  const raw = await storage.getItem(PALETTE_STORAGE_KEY);
  const storedPalettes = raw === null ? null : safeJson(raw);

  const { memories, report } = migratePalettes({ storedPalettes });

  if (memories === null) {
    // Aborted or nothing to do. Either way v1 is untouched and no v2 key is
    // written, so the app keeps reading the projection over v1.
    if (report.outcome === 'nothing-to-do') {
      await writeState(storage, { migrated: 0, quarantined: 0 });
    }
    return report;
  }

  await storage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(memories));

  if (report.quarantined.length > 0) {
    await storage.setItem(QUARANTINE_STORAGE_KEY, JSON.stringify(report.quarantined));
  }

  await writeState(storage, {
    migrated: report.migrated,
    quarantined: report.quarantined.length,
  });

  return report;
}

async function readState(storage: KeyValueStorage): Promise<MigrationState | null> {
  const raw = await storage.getItem(MIGRATION_STATE_KEY);
  if (raw === null) return null;
  const parsed = safeJson(raw);
  if (typeof parsed !== 'object' || parsed === null) return null;
  const version = (parsed as { version?: unknown }).version;
  return typeof version === 'number' ? (parsed as MigrationState) : null;
}

async function writeState(
  storage: KeyValueStorage,
  counts: { migrated: number; quarantined: number },
): Promise<void> {
  const state: MigrationState = {
    version: CURRENT_DATA_VERSION,
    migratedAt: new Date().toISOString(),
    ...counts,
  };
  await storage.setItem(MIGRATION_STATE_KEY, JSON.stringify(state));
}

/** Returns undefined rather than throwing, so a corrupt key is a branch not a crash. */
function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}
