import { z } from 'zod';

import type { Color } from '../palette';
import type { Band } from './bands';

/**
 * A palette in motion.
 *
 * **The constraint everything here obeys: proportions are never animated.**
 * `LivingBands` in the existing Living Memory screen already states why — "a band
 * that changed width would change what the palette claims about the photograph".
 * The widths are the product's central claim, measured from real pixels. Motion
 * may modulate *opacity* and may *move* bands along the strip, because neither
 * alters how much of the photograph each colour was. Nothing here scales a band.
 *
 * **Deterministic by construction.** Every style is a pure function of
 * `(colors, config, phase)`. The same document at the same phase always produces
 * the same bands, on every device, which is what makes an export reproducible —
 * the brief's requirement that animation must not render differently every time.
 * There is no randomness in this module and no reading of a clock.
 */

export const livingPaletteStyles = ['breathe', 'flow'] as const;
export const livingPaletteStyleSchema = z.enum(livingPaletteStyles);
export type LivingPaletteStyle = z.infer<typeof livingPaletteStyleSchema>;

/**
 * The four intensities the brief names, as presets over the two styles.
 *
 * Two styles rather than the nine the brief lists, and that is deliberate: two
 * that are complete, honest about proportions and reproducible are worth more
 * than nine that each half-work. Rings, particles, light leaks and topographic
 * motion need a renderer this palette strip does not have, and they arrive with
 * one rather than as a style enum nothing draws.
 */
export const livingPalettePresets = ['calm', 'flow', 'pulse', 'rush'] as const;
export const livingPalettePresetSchema = z.enum(livingPalettePresets);
export type LivingPalettePreset = z.infer<typeof livingPalettePresetSchema>;

/**
 * The slowest and fastest a palette may cycle.
 *
 * The floor is the important one. Below roughly half a second, a colour field
 * cycling at full intensity is a flashing light — a seizure risk, not a design
 * choice. The schema refuses it rather than trusting a caller to be sensible.
 */
export const MIN_PERIOD_MS = 600;
export const MAX_PERIOD_MS = 12_000;

export const livingPaletteConfigSchema = z.object({
  preset: livingPalettePresetSchema,
  style: livingPaletteStyleSchema,
  /** 0 is imperceptible, 1 is as far as the style goes. Never beyond. */
  intensity: z.number().min(0).max(1),
  /** One full cycle, in milliseconds. Bounded so nothing strobes. */
  periodMs: z.number().int().min(MIN_PERIOD_MS).max(MAX_PERIOD_MS),
  /** Reverses the palette's order without changing any weight. */
  reversed: z.boolean(),
});

export type LivingPaletteConfig = z.infer<typeof livingPaletteConfigSchema>;

/** The four presets, as data so they can be argued with rather than found in code. */
const PRESETS: Readonly<Record<LivingPalettePreset, Omit<LivingPaletteConfig, 'preset'>>> = {
  calm: { style: 'breathe', intensity: 0.3, periodMs: 5200, reversed: false },
  flow: { style: 'flow', intensity: 0.45, periodMs: 4200, reversed: false },
  pulse: { style: 'breathe', intensity: 0.75, periodMs: 1800, reversed: false },
  rush: { style: 'flow', intensity: 0.9, periodMs: 900, reversed: false },
};

export const livingPaletteConfig = (preset: LivingPalettePreset): LivingPaletteConfig => ({
  preset,
  ...PRESETS[preset],
});

/**
 * The phase a still frame is taken at.
 *
 * Zero, and it matters that it is a *defined* value rather than "wherever the
 * animation happened to be". Reduced motion, the editor's static preview and the
 * exporter all use it, so what someone sees when motion is off is exactly what
 * they get in the file.
 */
export const STILL_PHASE = 0;

/**
 * The phase to actually render at.
 *
 * Reduced motion pins it rather than removing the palette: at `STILL_PHASE`
 * every band is at full opacity and unshifted, so the composition is **complete
 * and static**, which is what the brief requires — not the same composition with
 * something missing.
 */
export const effectivePhase = (phase: number, reduceMotion: boolean): number =>
  reduceMotion ? STILL_PHASE : wrap01(phase);

/** Milliseconds since the start, as a phase. Pure; the caller owns the clock. */
export const phaseAt = (elapsedMs: number, config: LivingPaletteConfig): number =>
  wrap01(elapsedMs / config.periodMs);

/**
 * The bands a renderer should draw. **The one entry point.**
 *
 * Handles the three cases together so no caller has to remember the rule:
 *
 *   - no animation configured, or reduced motion → the **static** bands, at full
 *     strength. "Still" means the palette as it is, not the animation frozen at
 *     an arbitrary moment — a staggered breathe evaluated at phase zero leaves
 *     later bands part-way dimmed, which is a diminished composition rather than
 *     a static one, and the brief is explicit that reduced motion must not
 *     remove content.
 *   - otherwise → the animation at the given phase.
 *
 * The exporter uses this with `reduceMotion: true` unless a phase was chosen
 * deliberately, so an exported still is always the honest palette.
 */
export function bandsToDraw(
  staticBands: readonly Band[],
  span: number,
  config: LivingPaletteConfig | null,
  phase: number,
  reduceMotion: boolean,
): readonly Band[] {
  if (config === null || reduceMotion) return staticBands;
  return animateBands(staticBands, span, config, phase);
}

/**
 * The bands to draw at a phase.
 *
 * Takes the *static* bands — already laid end to end by `paletteBands`, already
 * carrying true proportions — and animates them. It never recomputes a width
 * from a weight, which is the mechanical guarantee that motion cannot alter the
 * proportions claim.
 */
export function animateBands(
  bands: readonly Band[],
  span: number,
  config: LivingPaletteConfig,
  phase: number,
): readonly Band[] {
  if (bands.length === 0 || span <= 0) return bands;
  const p = wrap01(phase);

  switch (config.style) {
    case 'breathe':
      return breathe(bands, config, p);
    case 'flow':
      return flow(bands, span, config, p);
  }
}

/**
 * Opacity, staggered along the strip.
 *
 * Each band breathes a little behind the one before it, so the strip reads as a
 * wave passing along it rather than as the whole thing blinking together.
 * Amplitude is bounded so a band never disappears: at full intensity the dimmest
 * a colour gets is 40%, because a palette with a missing colour is a different
 * palette.
 */
function breathe(
  bands: readonly Band[],
  config: LivingPaletteConfig,
  phase: number,
): readonly Band[] {
  const amplitude = 0.6 * config.intensity;

  return bands.map((band, index) => {
    const stagger = bands.length === 0 ? 0 : (index / bands.length) * 0.35;
    // Cosine so phase 0 is the peak: the still frame is the palette at full
    // strength, not mid-fade.
    const wave = Math.cos(2 * Math.PI * wrap01(phase + stagger));
    const opacity = 1 - amplitude * (1 - (wave + 1) / 2);
    return { ...band, opacity };
  });
}

/**
 * The strip slides along its own axis and wraps.
 *
 * Every band keeps its width and its colour; only where it sits changes. A band
 * crossing the far edge is emitted as two pieces so the strip stays continuous —
 * without that there is a gap at the seam for part of every cycle, which is
 * exactly the "visible reset jump" the brief forbids.
 */
function flow(
  bands: readonly Band[],
  span: number,
  config: LivingPaletteConfig,
  phase: number,
): readonly Band[] {
  const shift = phase * span * config.intensity;
  const out: Band[] = [];

  for (const band of bands) {
    const start = wrapTo(band.offset + shift, span);
    const end = start + band.length;

    if (end <= span) {
      out.push({ ...band, offset: start });
      continue;
    }

    // Split at the seam: the head runs to the end, the tail restarts at zero.
    out.push({ ...band, offset: start, length: span - start });
    out.push({ ...band, offset: 0, length: end - span });
  }

  return out;
}

const wrap01 = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  const wrapped = value % 1;
  return wrapped < 0 ? wrapped + 1 : wrapped;
};

const wrapTo = (value: number, span: number): number => {
  const wrapped = value % span;
  return wrapped < 0 ? wrapped + span : wrapped;
};

/**
 * A palette's colours in the order the config asks for.
 *
 * Reversal is an ordering choice, not an animation: it is applied once, before
 * bands are laid out, so every weight travels with its own colour.
 */
export const orderedColors = (
  colors: readonly Color[],
  config: LivingPaletteConfig,
): readonly Color[] => (config.reversed ? [...colors].reverse() : colors);
