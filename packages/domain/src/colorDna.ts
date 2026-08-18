import type { AtmosphereMood } from './atmosphere';
import type { ChromaticMemory } from './memory';
import type { StyleDna, TasteEntry } from './styleDna';

/**
 * Colour DNA, said out loud.
 *
 * `styleDna.ts` computes what someone's eye keeps choosing. This turns that into
 * sentences — and the whole difficulty is in what it refuses to say.
 *
 * **Three rules, and they are the feature.**
 *
 *   1. **Report counts, not causes.** "In 12 memories" rather than "you tend
 *      to". A photo library supports the first and cannot support the second.
 *   2. **Suppress weak signals.** `rewind.ts` already sets a floor of three,
 *      because "two memories that happen to share a mood is not a thing worth
 *      naming". The same floor applies to every explanation here.
 *   3. **Never imply psychology.** "You used deep blue most often in evening
 *      memories" is a count. "You are drawn to blue because you are calm" is a
 *      claim this app has no standing to make about anyone.
 *
 * **Structured, not prose.** Each explanation is a kind plus its numbers, for the
 * reasons `music.ts` gives for its recommendation reasons: it translates into
 * Vietnamese as a template rather than as machine-translated English, it is
 * unit-testable, and it can be written without a language model.
 *
 * **No seasons, no location.** Decision D6. A season is not a property of a date
 * — December is summer for half the world — and the app knows location only as
 * free text someone typed. Months are the honest form of the same idea.
 */

export const explanationKinds = [
  /** A colour family that keeps coming back. */
  'recurring-colour',
  /** The mood most memories share. */
  'prevailing-mood',
  /** The library leans warm or cool. */
  'warmth-lean',
  /** The library leans bright or dark. */
  'luminosity-lean',
  /** A month that holds more memories than the others. */
  'busiest-month',
  /** An artist or genre that recurs among *paired* memories. */
  'recurring-sound',
  /** How much of the library ever got a track. */
  'paired-share',
] as const;
export type ExplanationKind = (typeof explanationKinds)[number];

/**
 * One thing that is true about this library.
 *
 * `count` and `total` travel together so a screen can render "12 of 40" and a
 * reader can judge the strength themselves rather than trusting an adjective.
 */
export type Explanation = Readonly<{
  kind: ExplanationKind;
  /** The colour, mood, month or name the sentence is about. */
  subject: string | null;
  count: number;
  total: number;
}>;

/**
 * Below this a pattern is a coincidence.
 *
 * The same floor `rewind.ts` uses for smart collections, for the same reason and
 * deliberately the same number: a library should not tell someone two things are
 * a habit.
 */
export const MINIMUM_EVIDENCE = 3;

/** How far from neutral a lean has to be before it is worth mentioning. */
const WARMTH_THRESHOLD = 0.15;
const LUMINOSITY_THRESHOLD = 0.15;

const strongest = <Value extends string>(
  entries: readonly TasteEntry<Value>[],
): TasteEntry<Value> | null => entries[0] ?? null;

/**
 * Everything true and worth saying about a library.
 *
 * Pure and total. Returns an empty list rather than a weak one: a profile that
 * says nothing is better than a profile that says something it cannot support.
 */
export function explain(
  dna: StyleDna,
  memories: readonly ChromaticMemory[],
): readonly Explanation[] {
  const out: Explanation[] = [];
  const total = dna.memoryCount;
  if (total < MINIMUM_EVIDENCE) return out;

  const colour = dna.signature[0];
  if (colour !== undefined) {
    const count = memories.filter((memory) => memory.facets.dominantHex === colour).length;
    if (count >= MINIMUM_EVIDENCE) {
      out.push({ kind: 'recurring-colour', subject: colour, count, total });
    }
  }

  const mood = strongest(dna.moods);
  if (mood !== null && mood.count >= MINIMUM_EVIDENCE) {
    out.push({ kind: 'prevailing-mood', subject: mood.value, count: mood.count, total });
  }

  if (dna.warmth !== null && Math.abs(dna.warmth) >= WARMTH_THRESHOLD) {
    const warm = dna.warmth > 0;
    const count = memories.filter((memory) =>
      warm ? memory.facets.warmth > 0 : memory.facets.warmth < 0,
    ).length;
    if (count >= MINIMUM_EVIDENCE) {
      out.push({ kind: 'warmth-lean', subject: warm ? 'warm' : 'cool', count, total });
    }
  }

  if (dna.luminosity !== null) {
    const bright = dna.luminosity > 0.5 + LUMINOSITY_THRESHOLD;
    const dark = dna.luminosity < 0.5 - LUMINOSITY_THRESHOLD;
    if (bright || dark) {
      const count = memories.filter((memory) =>
        bright ? memory.facets.luminosity > 0.5 : memory.facets.luminosity < 0.5,
      ).length;
      if (count >= MINIMUM_EVIDENCE) {
        out.push({ kind: 'luminosity-lean', subject: bright ? 'bright' : 'dark', count, total });
      }
    }
  }

  const month = busiestMonth(memories);
  if (month !== null && month.count >= MINIMUM_EVIDENCE) {
    out.push({ kind: 'busiest-month', subject: month.key, count: month.count, total });
  }

  // Sound is reported against *paired* memories, never against the library: "in
  // 60% of your memories" is wrong when only half of them ever got a track.
  const paired = memories.filter(
    (memory) => memory.musicPairing.status === 'paired' && memory.musicPairing.selectedTrack,
  ).length;

  const artist = strongest(dna.artists);
  if (artist !== null && artist.count >= MINIMUM_EVIDENCE) {
    out.push({
      kind: 'recurring-sound',
      subject: artist.value,
      count: artist.count,
      total: paired,
    });
  }

  if (paired >= MINIMUM_EVIDENCE) {
    out.push({ kind: 'paired-share', subject: null, count: paired, total });
  }

  return out;
}

/** The month with the most memories in it, or null when nothing repeats. */
export function busiestMonth(
  memories: readonly ChromaticMemory[],
): { key: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const memory of memories) {
    counts.set(memory.facets.monthKey, (counts.get(memory.facets.monthKey) ?? 0) + 1);
  }

  let best: { key: string; count: number } | null = null;
  for (const [key, count] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    // Sorted by key first, so a tie resolves to the earliest month and the
    // result does not depend on Map iteration order.
    if (best === null || count > best.count) best = { key, count };
  }
  return best;
}

/**
 * The colour that appears least often but more than once.
 *
 * The brief asks for a "rarest colour", and two refusals make it honest:
 *
 *   - **A colour seen exactly once is not rare, it is incidental.** So a colour
 *     needs at least two sightings before it will be named at all.
 *   - **"Rarest" needs something to be rarer *than*.** With only one qualifying
 *     colour this returned that colour — which, in a library where it is also
 *     the most common, called the dominant colour the rarest one. Two qualifying
 *     colours are required before the word means anything.
 */
export function rarestColour(memories: readonly ChromaticMemory[]): string | null {
  const counts = new Map<string, number>();
  for (const memory of memories) {
    const hex = memory.facets.dominantHex;
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  // Sorted by hex first, so a tie resolves the same way every time rather than
  // depending on Map iteration order.
  const qualifying = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (qualifying.length < 2) return null;

  let best: { hex: string; count: number } | null = null;
  for (const [hex, count] of qualifying) {
    if (best === null || count < best.count) best = { hex, count };
  }
  return best?.hex ?? null;
}

/**
 * The mood a period expresses most, when one does.
 *
 * Returns null on a tie rather than picking one: "your strongest mood was
 * serene, or possibly vivid" is not a finding.
 */
export function strongestMood(dna: StyleDna): AtmosphereMood | null {
  const first = dna.moods[0];
  const second = dna.moods[1];
  if (first === undefined || first.count < MINIMUM_EVIDENCE) return null;
  if (second !== undefined && second.count === first.count) return null;
  return first.value;
}
