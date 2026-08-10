import { z } from 'zod';

import { contrastRatio, hexDeltaE00 } from './color';
import { colorMetrics } from './discovery';
import { roledFrom, type Color } from './palette';

/**
 * What a palette says about the moment it came from.
 *
 * This is the hinge of the whole product. A photograph gives us colour; music is
 * organised around atmosphere; this module is the claim that the first predicts
 * the second. It is deliberately **deterministic, total and pure** — every
 * schema-valid palette produces a reading, offline, in under a millisecond, with
 * no provider and no model involved.
 *
 * That is not a limitation to be replaced by an LLM later. It is the reason the
 * product works on a plane, costs nothing per capture, can be unit-tested at its
 * thresholds, and cannot hallucinate. `analysis.ts` adds an optional vision
 * provider that *adjusts* a reading with what is literally in the frame; it can
 * never originate one.
 *
 * Every dimension is normalised so the mapping in `intent.ts` can weight them
 * against each other without carrying unit conversions around.
 */

export const atmosphereMoods = [
  'serene',
  'tender',
  'luminous',
  'vivid',
  'nocturnal',
  'melancholy',
  'earthy',
  'stark',
] as const;

/**
 * Distinct from `discovery.ColorMood` (warm / cool / pastel / monochrome /
 * vibrant), which is a *filter* axis describing the colours themselves. This is
 * an *atmosphere* axis describing the moment they came from — the thing a track
 * can match. The two never share a value, so a reader is never left wondering
 * which one a string belongs to.
 */
export const atmosphereMoodSchema = z.enum(atmosphereMoods);
export type AtmosphereMood = z.infer<typeof atmosphereMoodSchema>;

export const atmosphereReadingSchema = z.object({
  /** 0–1, dark to bright. Weighted mean OKLCh lightness. */
  luminosity: z.number().min(0).max(1),
  /** −1 to 1, cool to warm. */
  warmth: z.number().min(-1).max(1),
  /** 0–1. Weighted mean chroma against the practical sRGB ceiling. */
  saturation: z.number().min(0).max(1),
  /** 0–1. The strongest contrast the palette contains. */
  contrast: z.number().min(0).max(1),
  /** 0–1. How far apart the named roles sit perceptually. */
  spread: z.number().min(0).max(1),
  /** 0–1. How tightly the scene clustered — from the extraction's own ΔE00. */
  coherence: z.number().min(0).max(1),
  mood: atmosphereMoodSchema,
});

export type AtmosphereReading = z.infer<typeof atmosphereReadingSchema>;

/**
 * OKLCh chroma runs to about 0.37 for sRGB primaries, and `discovery` already
 * treats 0.13 as "saying a colour rather than suggesting one". Normalising
 * against the ceiling rather than against 1 keeps `saturation` spread across its
 * whole range instead of bunching everything below a third.
 */
const CHROMA_CEILING = 0.37;

/**
 * ΔE00 40 is about the distance from a mid blue to a mid orange — far enough
 * apart that no palette should read as more spread than that.
 */
const SPREAD_CEILING = 40;

/**
 * The extraction reports mean ΔE00 of each sampled pixel to its cluster, and
 * `color.ts` already treats 10 as the point where a read carries no confidence.
 * Coherence is that same judgment expressed as "how much one scene was this".
 */
const COHERENCE_CEILING = 10;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Where a hue sits between the warm and cool poles.
 *
 * Same geometry `color.ts` uses internally for its temperature term — warm
 * poles at 15° and 45°, cool pole at 230° — restated here rather than imported
 * because that one is private to the extractor and takes an OKLab triple. Both
 * agree with `isWarmHue`, which is what stops a palette changing temperature
 * depending on which screen is asking.
 */
function hueWarmth(hue: number): number {
  const arc = (from: number, to: number) => {
    const distance = Math.abs(((from - to + 540) % 360) - 180);
    return distance;
  };
  const warmDistance = Math.min(arc(hue, 45), arc(hue, 15));
  const coolDistance = arc(hue, 230);
  const total = warmDistance + coolDistance;
  return total === 0 ? 0 : Math.min(1, Math.max(-1, (coolDistance - warmDistance) / total));
}

/**
 * The strongest contrast anywhere in the palette, as 0–1.
 *
 * The *maximum* rather than the mean, because contrast is a property the eye
 * notices where it is highest: one bright signal against a dark ground makes a
 * stark image even when every other pair is muted. WCAG ratios run 1:1 to 21:1.
 */
function peakContrast(colors: readonly Color[]): number {
  let peak = 1;
  for (let i = 0; i < colors.length; i += 1) {
    for (let j = i + 1; j < colors.length; j += 1) {
      const ratio = contrastRatio(colors[i]!.hex, colors[j]!.hex);
      if (ratio > peak) peak = ratio;
    }
  }
  return clamp01((peak - 1) / 20);
}

/**
 * How far the named roles sit from each other, perceptually.
 *
 * Roles rather than every colour: `dominant`, `support` and `signal` are the
 * palette's structure, and the `extra` swatches are usually near-neighbours of
 * one of them. Measuring all pairs would let a five-colour read look more spread
 * than a three-colour one purely by having more colours.
 */
function roleSpread(colors: readonly Color[]): number {
  const roled = roledFrom(colors);
  if (roled.length < 2) return 0;

  let total = 0;
  let pairs = 0;
  for (let i = 0; i < roled.length; i += 1) {
    for (let j = i + 1; j < roled.length; j += 1) {
      total += hexDeltaE00(roled[i]!.hex, roled[j]!.hex);
      pairs += 1;
    }
  }
  return clamp01(total / pairs / SPREAD_CEILING);
}

/**
 * The mood table.
 *
 * Explicitly a table, not a model: eight words with stated thresholds that a
 * person can read, argue with, and change in one line. **Order matters** — the
 * first matching row wins, so the specific cases come before the general ones
 * and `stark` is the fallback rather than a competitor. The ordering is asserted
 * by tests, because a reshuffle would silently re-label every existing memory.
 */
export const moodTable = [
  { mood: 'nocturnal', when: (a: Scalars) => a.luminosity < 0.22 },
  {
    mood: 'melancholy',
    when: (a: Scalars) => a.luminosity < 0.45 && a.saturation < 0.3 && a.warmth < 0,
  },
  { mood: 'serene', when: (a: Scalars) => a.saturation < 0.35 && a.contrast < 0.45 },
  {
    mood: 'tender',
    when: (a: Scalars) => a.warmth > 0.25 && a.saturation < 0.5 && a.luminosity > 0.55,
  },
  {
    mood: 'earthy',
    when: (a: Scalars) =>
      a.warmth > 0.15 &&
      a.saturation >= 0.25 &&
      a.saturation <= 0.6 &&
      a.luminosity >= 0.3 &&
      a.luminosity <= 0.65,
  },
  { mood: 'luminous', when: (a: Scalars) => a.luminosity > 0.7 && a.contrast < 0.55 },
  { mood: 'vivid', when: (a: Scalars) => a.saturation > 0.6 },
  { mood: 'stark', when: () => true },
] as const satisfies readonly { mood: AtmosphereMood; when: (a: Scalars) => boolean }[];

type Scalars = Omit<AtmosphereReading, 'mood'>;

export function moodFor(scalars: Scalars): AtmosphereMood {
  // The last row is unconditional, so this always resolves; the fallback is
  // written out anyway so the function is total by inspection as well as by
  // construction.
  return moodTable.find((row) => row.when(scalars))?.mood ?? 'stark';
}

/**
 * Reads the atmosphere out of an extracted palette.
 *
 * `deltaE` is the extraction's own stability figure — the one B2 renders as
 * "ΔE 2.4 · STABLE". A palette reconstructed without it (a merged set, say)
 * passes 0, which reads as perfectly coherent, and is the right default for a
 * colour system that was computed rather than measured.
 */
export function readAtmosphere(colors: readonly Color[], deltaE = 0): AtmosphereReading {
  const metrics = colorMetrics(colors);
  if (metrics.colorCount === 0) {
    return {
      luminosity: 0,
      warmth: 0,
      saturation: 0,
      contrast: 0,
      spread: 0,
      coherence: 1,
      mood: 'stark',
    };
  }

  const totalWeight = colors.reduce((sum, color) => sum + color.weight, 0);
  const share = (color: Color) =>
    totalWeight > 0 ? color.weight / totalWeight : 1 / colors.length;

  // Weighted by area, so a warm sky occupying 60% of the frame outweighs a cool
  // accent occupying 4%. This is what the true area weights are *for*.
  const warmth = colors.reduce((sum, color) => sum + hueWarmth(color.oklch.hue) * share(color), 0);

  const scalars: Scalars = {
    luminosity: round3(clamp01(metrics.meanLightness)),
    warmth: round3(Math.min(1, Math.max(-1, warmth))),
    saturation: round3(clamp01(metrics.meanChroma / CHROMA_CEILING)),
    contrast: round3(peakContrast(colors)),
    spread: round3(roleSpread(colors)),
    coherence: round3(clamp01(1 - deltaE / COHERENCE_CEILING)),
  };

  return { ...scalars, mood: moodFor(scalars) };
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;
