import type { AtmosphereMood } from '../atmosphere';
import type { ChromaticMemory } from '../memory';
import { hexDeltaE00 } from '../color';
import { MAX_SLIDES } from './formats';

/**
 * Sequencing and pacing a story from the memories it is made of.
 *
 * **What paces this, and what does not.** Not a beat: no provider available to
 * this app reports tempo, and nothing here decodes audio
 * (`04-music-analysis-adr.md`, decision D1). What paces it is the colour the
 * photographs are actually made of — `facets.energy`, `warmth`, `luminosity` and
 * the atmosphere's `mood`, all of which are already computed, already stored,
 * offline and exact.
 *
 * `livingMemory.ts` established this move and stated it well: "the pacing comes
 * from the atmosphere the colour already produced: a serene memory breathes, a
 * vivid one cuts." This is that idea applied to a sequence of memories rather
 * than to one.
 *
 * **Deterministic and total.** The same memories at the same intensity always
 * produce the same sequence — no clock, no randomness — which is what lets a
 * composition be regenerated, compared and exported reproducibly.
 */

/**
 * How hard the sequence drives.
 *
 * The same four names Living Palette uses, deliberately: one intensity
 * vocabulary across the platform means "Pulse" describes the same energy
 * wherever someone meets it, rather than four words per feature.
 */
export const paceIntensities = ['calm', 'flow', 'pulse', 'rush'] as const;
export type PaceIntensity = (typeof paceIntensities)[number];

/** How the memories are put in order. */
export const sequenceOrders = [
  /** As they happened. The honest default: a story is usually a chronology. */
  'chronological',
  /** Quietest to most energetic, so the sequence builds. */
  'building',
  /** Nearest neighbour by colour, so each slide flows into the next. */
  'colour-flow',
] as const;
export type SequenceOrder = (typeof sequenceOrders)[number];

export type PacedSlide = Readonly<{
  memoryId: string;
  /** How long this slide holds, in milliseconds. */
  holdMs: number;
  /** 0–1. Drives how much emphasis a template gives it. */
  emphasis: number;
}>;

export type PacedSequence = Readonly<{
  slides: readonly PacedSlide[];
  totalMs: number;
  order: SequenceOrder;
  intensity: PaceIntensity;
}>;

/**
 * The base hold, per intensity, in milliseconds.
 *
 * Editorial decisions stated as data so they can be argued with rather than
 * found in an expression. The floor matters: below roughly a second a slide is
 * a flash rather than a picture, whatever the intensity asks for.
 */
const BASE_HOLD_MS: Readonly<Record<PaceIntensity, number>> = {
  calm: 4200,
  flow: 3000,
  pulse: 2000,
  rush: 1300,
};

/** No slide shorter than this; below it a cut reads as a glitch. */
export const MINIMUM_HOLD_MS = 900;

/**
 * How far energy may pull a hold from its base, as a fraction.
 *
 * Bounded so a very energetic memory shortens its slide noticeably without the
 * sequence becoming arrhythmic — the difference between pacing and stuttering.
 */
const ENERGY_SWING = 0.45;

/**
 * The hold for one memory.
 *
 * High energy shortens, low energy lengthens. `facets.energy` is colour-derived
 * and the module comment says so; nothing here implies it was measured from a
 * waveform.
 */
export function holdFor(energy: number, intensity: PaceIntensity): number {
  const base = BASE_HOLD_MS[intensity];
  const clamped = Math.min(1, Math.max(0, energy));
  // energy 0 → base × (1 + swing); energy 1 → base × (1 − swing).
  const scaled = base * (1 + ENERGY_SWING * (1 - 2 * clamped));
  return Math.max(MINIMUM_HOLD_MS, Math.round(scaled));
}

/**
 * How much a memory asks to be emphasised.
 *
 * Contrast and saturation carry more weight than brightness: a picture that is
 * merely bright is not necessarily the one a sequence should land on, but one
 * with strong internal contrast usually is.
 */
export function emphasisFor(memory: ChromaticMemory): number {
  const { contrast, saturation, luminosity } = memory.atmosphere;
  const raw = contrast * 0.5 + saturation * 0.35 + luminosity * 0.15;
  return Math.min(1, Math.max(0, raw));
}

/** Moods that read as quiet, used to keep a building order honest. */
const QUIET_MOODS: ReadonlySet<AtmosphereMood> = new Set([
  'serene',
  'tender',
  'melancholy',
  'nocturnal',
]);

export const isQuiet = (mood: AtmosphereMood): boolean => QUIET_MOODS.has(mood);

/**
 * Puts memories in order.
 *
 * Every order is a total function over the input and returns exactly the same
 * memories — a sequence that dropped one would be a sequence that lost someone's
 * photograph.
 */
export function orderMemories(
  memories: readonly ChromaticMemory[],
  order: SequenceOrder,
): readonly ChromaticMemory[] {
  switch (order) {
    case 'chronological':
      return [...memories].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));

    case 'building':
      return [...memories].sort((a, b) => {
        const byEnergy = a.facets.energy - b.facets.energy;
        // Ties broken by time, so the order is stable and reproducible rather
        // than depending on the input array's incidental order.
        return byEnergy !== 0 ? byEnergy : Date.parse(a.capturedAt) - Date.parse(b.capturedAt);
      });

    case 'colour-flow':
      return colourFlow(memories);
  }
}

/**
 * Nearest-neighbour by perceptual colour distance.
 *
 * Greedy rather than optimal: the optimal ordering is a travelling-salesman
 * problem, and for twenty slides the difference is invisible while the cost is
 * not. Starts from the earliest memory so the result is deterministic rather
 * than depending on which one happened to be first in the array.
 */
function colourFlow(memories: readonly ChromaticMemory[]): readonly ChromaticMemory[] {
  if (memories.length <= 2) return [...memories];

  const remaining = [...memories].sort(
    (a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt),
  );
  const first = remaining.shift();
  if (first === undefined) return [];

  const ordered: ChromaticMemory[] = [first];

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1];
    if (current === undefined) break;

    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const [index, candidate] of remaining.entries()) {
      const distance = hexDeltaE00(current.facets.dominantHex, candidate.facets.dominantHex);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    const [next] = remaining.splice(bestIndex, 1);
    if (next === undefined) break;
    ordered.push(next);
  }

  return ordered;
}

/**
 * The whole composition: order, holds and emphasis.
 *
 * Caps at `MAX_SLIDES` because a story cannot hold more, and truncates rather
 * than failing — someone who selected thirty memories gets a story of the first
 * twenty in the chosen order, which is a result they can edit, not an error they
 * have to resolve before seeing anything.
 */
export function paceStory(input: {
  memories: readonly ChromaticMemory[];
  intensity: PaceIntensity;
  order: SequenceOrder;
}): PacedSequence {
  const ordered = orderMemories(input.memories, input.order).slice(0, MAX_SLIDES);

  const slides = ordered.map((memory): PacedSlide => ({
    memoryId: memory.id,
    holdMs: holdFor(memory.facets.energy, input.intensity),
    emphasis: emphasisFor(memory),
  }));

  return {
    slides,
    totalMs: slides.reduce((sum, slide) => sum + slide.holdMs, 0),
    order: input.order,
    intensity: input.intensity,
  };
}
