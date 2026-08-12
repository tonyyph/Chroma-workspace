import type { AtmosphereMood } from './atmosphere';
import type { ChromaticMemory } from './memory';
import { readStyleDna, type StyleDna } from './styleDna';

/**
 * The library, looked at as a whole rather than one memory at a time.
 *
 * Two things live here: collections the app forms without being asked, and the
 * looking-back a year of captures earns. Both are pure functions over records
 * already held — nothing is uploaded, nothing is inferred about a person, and
 * every grouping is recomputed rather than stored, so deleting a memory removes
 * it from every collection at once.
 *
 * **There are no seasons here, and that is deliberate.** A season is not a
 * property of a date: December is summer for half the world. The app knows a
 * `location` only as free text a person typed, never as a coordinate, so it
 * cannot know a hemisphere and would have to guess. Months are the honest form
 * of the same idea — "your Augusts" says something true everywhere.
 *
 * Grouping by person is absent for the same kind of reason: there is no face
 * data, and adding some is a different project with its own privacy cost.
 */

export const collectionKinds = ['month', 'mood', 'colour', 'artist', 'genre'] as const;
export type CollectionKind = (typeof collectionKinds)[number];

export type SmartCollection = Readonly<{
  kind: CollectionKind;
  /** Stable and machine-readable: `2026-08`, `nocturnal`, `#7C5CFF`, an artist name. */
  key: string;
  memoryIds: readonly string[];
  /** The colour to draw it as — the dominant colour of its most recent member. */
  coverHex: string;
}>;

/**
 * Below this a collection is a coincidence rather than a pattern.
 *
 * Two memories that happen to share a mood is not a thing worth naming, and a
 * library full of one-item collections is a worse library view than no
 * collections at all.
 */
const MINIMUM_MEMBERS = 3;

/** Newest first, which is the order every list in the app already reads in. */
const byRecency = (memories: readonly ChromaticMemory[]): readonly ChromaticMemory[] =>
  [...memories].sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt));

function collect(
  memories: readonly ChromaticMemory[],
  kind: CollectionKind,
  keysOf: (memory: ChromaticMemory) => readonly string[],
): readonly SmartCollection[] {
  const groups = new Map<string, ChromaticMemory[]>();
  for (const memory of byRecency(memories)) {
    for (const key of keysOf(memory)) {
      const group = groups.get(key);
      if (group) group.push(memory);
      else groups.set(key, [memory]);
    }
  }

  return [...groups.entries()]
    .filter(([, group]) => group.length >= MINIMUM_MEMBERS)
    .map(([key, group]) => ({
      kind,
      key,
      memoryIds: group.map((memory) => memory.id),
      // The newest member's dominant colour: a collection should look like what
      // it is becoming, not like what it was when it started.
      coverHex: group[0]!.facets.dominantHex,
    }))
    .sort((a, b) => b.memoryIds.length - a.memoryIds.length || a.key.localeCompare(b.key));
}

/**
 * Every collection the library forms on its own.
 *
 * A memory belongs to as many as it qualifies for — these are views, not
 * folders, and a nocturnal photograph taken in August with a track by one artist
 * is genuinely all three of those things.
 */
export function smartCollections(memories: readonly ChromaticMemory[]): readonly SmartCollection[] {
  return [
    ...collect(memories, 'month', (memory) => [memory.facets.monthKey]),
    ...collect(memories, 'mood', (memory) => [memory.facets.mood]),
    ...collect(memories, 'colour', (memory) => [memory.facets.dominantHex]),
    ...collect(memories, 'artist', (memory) => {
      const track = memory.musicPairing.selectedTrack;
      return memory.musicPairing.status === 'paired' && track ? [track.artist] : [];
    }),
    ...collect(memories, 'genre', (memory) => {
      const track = memory.musicPairing.selectedTrack;
      return memory.musicPairing.status === 'paired' && track
        ? track.genres.map((genre) => genre.toLowerCase())
        : [];
    }),
  ];
}

/* ------------------------------------------------------------------ rewind */

/**
 * What was captured on this day in earlier years.
 *
 * Compared on the *device's current* calendar day, because that is the only
 * calendar available: `capturedAt` is an instant and the offset it was taken at
 * was never stored. The consequence is real and worth stating rather than
 * hiding — a photograph taken near midnight can fall on the neighbouring date
 * for someone who has since travelled. Storing the original offset is what would
 * fix it, and that is a change to the capture record, not to this function.
 */
export function onThisDay(
  memories: readonly ChromaticMemory[],
  now: Date = new Date(),
): readonly ChromaticMemory[] {
  const month = now.getMonth();
  const day = now.getDate();
  const thisYear = now.getFullYear();

  return byRecency(
    memories.filter((memory) => {
      const captured = new Date(memory.capturedAt);
      if (Number.isNaN(captured.getTime())) return false;
      // Earlier years only: today's own captures are not a memory yet.
      return (
        captured.getMonth() === month &&
        captured.getDate() === day &&
        captured.getFullYear() < thisYear
      );
    }),
  );
}

export type RecapPeriod = 'month' | 'year';

export type Recap = Readonly<{
  period: RecapPeriod;
  /** `2026-08` for a month, `2026` for a year. */
  key: string;
  memoryIds: readonly string[];
  /** The mood that ran through it, or null when nothing repeated. */
  leadMood: AtmosphereMood | null;
  /** The colours of the period, most-used first. */
  signature: readonly string[];
  /** Share of its memories that ended up with a track. */
  pairedShare: number;
  /** The taste those memories express, read the same way as the whole library's. */
  style: StyleDna;
}>;

/** Below this, a period has not accumulated enough to be worth looking back at. */
const MINIMUM_RECAP_MEMBERS = 4;

const keyFor = (memory: ChromaticMemory, period: RecapPeriod): string =>
  period === 'year' ? memory.facets.monthKey.slice(0, 4) : memory.facets.monthKey;

/**
 * The recap for one period, or null when there is not enough in it.
 *
 * Returning null rather than an empty recap is the point: a screen that renders
 * "0 memories, no mood, no colours" for a quiet month has said something
 * discouraging about a person's year for no reason.
 */
export function recapFor(
  memories: readonly ChromaticMemory[],
  period: RecapPeriod,
  key: string,
  now: Date = new Date(),
): Recap | null {
  const members = byRecency(memories.filter((memory) => keyFor(memory, period) === key));
  if (members.length < MINIMUM_RECAP_MEMBERS) return null;

  const style = readStyleDna(members, now);
  const paired = members.filter(
    (memory) => memory.musicPairing.status === 'paired' && memory.musicPairing.selectedTrack,
  ).length;

  return {
    period,
    key,
    memoryIds: members.map((memory) => memory.id),
    leadMood: style.moods[0]?.value ?? null,
    signature: style.signature,
    pairedShare: Math.round((paired / members.length) * 1000) / 1000,
    style,
  };
}

/** The period key a date falls in, so a caller can ask for "this month". */
export const periodKey = (period: RecapPeriod, now: Date = new Date()): string => {
  const year = String(now.getFullYear());
  if (period === 'year') return year;
  return `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Every recap the library can offer, newest first.
 *
 * Months and years both, because they answer different questions: a month is
 * "what was I doing lately", a year is "what kind of year was that".
 */
export function availableRecaps(
  memories: readonly ChromaticMemory[],
  now: Date = new Date(),
): readonly Recap[] {
  const monthKeys = [...new Set(memories.map((memory) => keyFor(memory, 'month')))];
  const yearKeys = [...new Set(memories.map((memory) => keyFor(memory, 'year')))];

  const recaps = [
    ...monthKeys.map((key) => recapFor(memories, 'month', key, now)),
    ...yearKeys.map((key) => recapFor(memories, 'year', key, now)),
  ].filter((recap): recap is Recap => recap !== null);

  // Years before months within the same key prefix, so a year's recap is not
  // buried under its own twelve months.
  return recaps.sort((a, b) => b.key.localeCompare(a.key) || (a.period === 'year' ? -1 : 1));
}
