import { z } from 'zod';

import {
  STORY_SCHEMA_VERSION,
  storyProjectSchema,
  type StoryProject,
  type StoryRecordProblem,
} from './project';

/**
 * Reading stored projects without letting one bad record cost the rest.
 *
 * This is the lesson `migrateMemories` was written to fix, applied before it can
 * be learned twice: v1 of the palette repository parsed the whole stored array
 * in a single call and threw on any invalid record, so one corrupt palette made
 * the entire library unreadable on a device with no undo. Projects are larger
 * documents with more invariants and more ways to be half-written, so the same
 * rule is the starting position rather than the repair:
 *
 *   1. **Never parse the collection as a unit.** Per record, keep what is valid
 *      and quarantine what is not.
 *   2. **Never delete what was read.** A quarantined record is reported with its
 *      raw contents so it can be inspected or recovered, not dropped.
 *
 * There is only one schema version today, so there is nothing to upgrade yet.
 * `migrateRecord` exists anyway, and dispatches on the stored version, because
 * the shape of the second version's arrival should be a new case in a switch
 * rather than a new architecture under time pressure.
 */

export type StoryReadResult = {
  projects: readonly StoryProject[];
  problems: readonly StoryRecordProblem[];
};

/**
 * Brings one stored record up to the current schema version.
 *
 * Forward-only and idempotent: a record already at the current version is
 * returned untouched, so running this twice is the same as running it once.
 * Returns `null` for a version this build does not know how to read — which
 * happens when a newer build wrote the record and the user then downgraded.
 * That record is quarantined, not rewritten, because guessing at a shape from
 * the future is how data gets destroyed.
 */
export function migrateRecord(raw: unknown): unknown | null {
  const version = readVersion(raw);
  if (version === null) return null;
  if (version === STORY_SCHEMA_VERSION) return raw;

  // Version 1 is the first, so there is nothing older to upgrade *from* yet.
  // When version 2 arrives this becomes `if (version === 1) return v1ToV2(raw)`,
  // and anything newer than this build stays unreadable by definition.
  return null;
}

/**
 * Parses a stored collection. Total: it never throws, whatever is on disk.
 *
 * A non-array is not an error to surface at every read — it is what an empty or
 * never-written key looks like once, and the honest response is "no projects"
 * rather than an alert the user can do nothing about.
 */
export function readStoredProjects(stored: unknown): StoryReadResult {
  if (stored === null || stored === undefined) return { projects: [], problems: [] };
  if (!Array.isArray(stored)) {
    return {
      projects: [],
      problems: [{ index: 0, id: null, issues: 'Stored projects were not an array.', raw: stored }],
    };
  }

  const projects: StoryProject[] = [];
  const problems: StoryRecordProblem[] = [];

  for (const [index, raw] of stored.entries()) {
    const migrated = migrateRecord(raw);
    if (migrated === null) {
      problems.push({
        index,
        id: readId(raw),
        issues: `Unsupported schema version ${String(readVersion(raw))}.`,
        raw,
      });
      continue;
    }

    const parsed = storyProjectSchema.safeParse(migrated);
    if (!parsed.success) {
      problems.push({ index, id: readId(raw), issues: summarise(parsed.error), raw });
      continue;
    }
    projects.push(parsed.data);
  }

  return { projects, problems };
}

function readVersion(raw: unknown): number | null {
  if (typeof raw !== 'object' || raw === null || !('schemaVersion' in raw)) return null;
  const version = (raw as { schemaVersion: unknown }).schemaVersion;
  return typeof version === 'number' && Number.isInteger(version) ? version : null;
}

function readId(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null || !('id' in raw)) return null;
  const id = (raw as { id: unknown }).id;
  return typeof id === 'string' ? id : null;
}

/** Compact enough to store beside a quarantined record without bloating it. */
function summarise(error: z.ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
}
