import type { AtmosphereMood } from './atmosphere';
import { moodsOf, stylesOf, type ColorMood, type VisualStyle } from './discovery';
import type { ChromaticMemory } from './memory';

/**
 * What this person's eye keeps choosing.
 *
 * **Derived, never stored** — the same rule `feedback.accumulatePreference`
 * follows, and for the same three reasons: there is exactly one source of truth,
 * deleting a memory genuinely removes its influence, and changing how taste is
 * read takes effect immediately rather than only for memories captured
 * afterwards. A persisted profile would be a second truth that slowly stops
 * matching the library it claims to describe.
 *
 * **Recency-weighted.** Someone's taste is allowed to change, and a profile that
 * still leads with what they photographed two years ago is a profile of a person
 * who no longer exists. The half-life matches the music feedback's: ninety days.
 */

/** Half-life of a memory's influence on the profile, in days. */
const HALF_LIFE_DAYS = 90;

export type TasteEntry<Value extends string> = Readonly<{
  value: Value;
  /** Recency-weighted count, not a raw tally. */
  weight: number;
  /** How many memories carry it at all, for honest copy: "in 12 memories". */
  count: number;
}>;

export type StyleDna = Readonly<{
  /** How many memories the profile was read from. Zero means no profile. */
  memoryCount: number;
  /** The colours that keep coming back, most-used first. */
  signature: readonly string[];
  moods: readonly TasteEntry<AtmosphereMood>[];
  colorMoods: readonly TasteEntry<ColorMood>[];
  styles: readonly TasteEntry<VisualStyle>[];
  genres: readonly TasteEntry<string>[];
  artists: readonly TasteEntry<string>[];
  /** Recency-weighted means, −1..1 and 0..1. Null when there is nothing to average. */
  warmth: number | null;
  luminosity: number | null;
  /** Share of memories that ended up with a track, 0–1. */
  pairedShare: number;
}>;

export const EMPTY_STYLE_DNA: StyleDna = {
  memoryCount: 0,
  signature: [],
  moods: [],
  colorMoods: [],
  styles: [],
  genres: [],
  artists: [],
  warmth: null,
  luminosity: null,
  pairedShare: 0,
};

const recencyOf = (isoDate: string, now: Date): number => {
  const ageDays = (now.getTime() - Date.parse(isoDate)) / 86_400_000;
  // A future timestamp is a clock that went backwards, not a memory from the
  // future; it is treated as current rather than as unboundedly important.
  if (!Number.isFinite(ageDays)) return 1;
  return 0.5 ** (Math.max(0, ageDays) / HALF_LIFE_DAYS);
};

/** Rolls per-value weights and counts into a ranked list. */
function rank<Value extends string>(
  tallies: ReadonlyMap<Value, { weight: number; count: number }>,
): readonly TasteEntry<Value>[] {
  return [...tallies.entries()]
    .map(([value, { weight, count }]) => ({
      value,
      weight: Math.round(weight * 1000) / 1000,
      count,
    }))
    .sort((a, b) => b.weight - a.weight || a.value.localeCompare(b.value));
}

function bump<Value extends string>(
  tallies: Map<Value, { weight: number; count: number }>,
  value: Value,
  weight: number,
): void {
  const current = tallies.get(value) ?? { weight: 0, count: 0 };
  tallies.set(value, { weight: current.weight + weight, count: current.count + 1 });
}

/**
 * Reads a profile off the library.
 *
 * Total: an empty library yields `EMPTY_STYLE_DNA` rather than a profile full of
 * zeroes that reads as "this person likes nothing".
 */
export function readStyleDna(
  memories: readonly ChromaticMemory[],
  now: Date = new Date(),
): StyleDna {
  if (memories.length === 0) return EMPTY_STYLE_DNA;

  const moods = new Map<AtmosphereMood, { weight: number; count: number }>();
  const colorMoodTallies = new Map<ColorMood, { weight: number; count: number }>();
  const styleTallies = new Map<VisualStyle, { weight: number; count: number }>();
  const genres = new Map<string, { weight: number; count: number }>();
  const artists = new Map<string, { weight: number; count: number }>();
  const hexes = new Map<string, number>();

  let warmthTotal = 0;
  let luminosityTotal = 0;
  let recencyTotal = 0;
  let paired = 0;

  for (const memory of memories) {
    const recency = recencyOf(memory.capturedAt, now);
    recencyTotal += recency;

    bump(moods, memory.atmosphere.mood, recency);
    for (const mood of moodsOf(memory.palette.colors)) bump(colorMoodTallies, mood, recency);
    for (const style of stylesOf(memory.palette.colors)) bump(styleTallies, style, recency);

    warmthTotal += memory.atmosphere.warmth * recency;
    luminosityTotal += memory.atmosphere.luminosity * recency;

    // The dominant colour is the one the photograph was actually made of, so it
    // is the one that says something about a habit. Weighting every swatch would
    // let a single busy palette outvote five consistent ones.
    const dominant =
      memory.palette.colors.find((color) => color.role === 'dominant') ?? memory.palette.colors[0];
    if (dominant) hexes.set(dominant.hex, (hexes.get(dominant.hex) ?? 0) + recency);

    const track = memory.musicPairing.selectedTrack;
    if (memory.musicPairing.status === 'paired' && track) {
      paired += 1;
      bump(artists, track.artist, recency);
      for (const genre of track.genres) bump(genres, genre.toLowerCase(), recency);
    }
  }

  const signature = [...hexes.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(([hex]) => hex);

  return {
    memoryCount: memories.length,
    signature,
    moods: rank(moods),
    colorMoods: rank(colorMoodTallies),
    styles: rank(styleTallies),
    genres: rank(genres),
    artists: rank(artists),
    // Guarded: every memory being older than about sixty half-lives drives the
    // recency total to zero, and dividing by it would report NaN warmth.
    warmth: recencyTotal > 0 ? Math.round((warmthTotal / recencyTotal) * 1000) / 1000 : null,
    luminosity:
      recencyTotal > 0 ? Math.round((luminosityTotal / recencyTotal) * 1000) / 1000 : null,
    pairedShare: Math.round((paired / memories.length) * 1000) / 1000,
  };
}

/**
 * The profile's genre lean, in the shape `ranking` already consumes.
 *
 * **Deliberately weaker than explicit feedback.** Turning a track down is a
 * statement; photographing warm rooms is a habit, and a habit should not shout
 * over a statement. The scale here puts the whole library's lean at roughly the
 * strength of a single recent "kept" signal, which is enough to break a tie and
 * not enough to decide one.
 */
const STYLE_LEAN = 0.35;

export function styleGenreWeights(dna: StyleDna): ReadonlyMap<string, number> {
  const strongest = dna.genres[0]?.weight ?? 0;
  if (strongest <= 0) return new Map();

  return new Map(
    dna.genres.map((entry) => [
      entry.value,
      Math.round((entry.weight / strongest) * STYLE_LEAN * 1000) / 1000,
    ]),
  );
}
