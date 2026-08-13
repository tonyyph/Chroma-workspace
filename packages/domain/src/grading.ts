import { z } from 'zod';
import type { AtmosphereMood, AtmosphereReading } from './atmosphere';

/**
 * The grade a photograph asks for, derived from the colour already measured in
 * it.
 *
 * **Parametric, not a lookup table.** Eleven numbers and two tints, which is
 * what a colourist actually reaches for. A 3D LUT would be the obvious
 * alternative and is the wrong shape here for three reasons: it cannot be
 * *derived* arithmetically from a measurement, so the product's central claim —
 * that a photograph's own colour tells you how to grade it — would have nowhere
 * to live; it cannot be nudged, so "close, but warmer" becomes "pick a different
 * one"; and it cannot be said in a sentence, so the app could never explain
 * itself. A colour matrix was the other candidate and cannot express split-toning
 * or lift at all, which are precisely the two things that make a grade read as
 * film rather than as a filter.
 *
 * **Deterministic and pure**, on the same terms `atmosphere` sets out: the same
 * reading always produces the same grade, it runs offline in microseconds, it
 * costs nothing per photograph, it is testable at its thresholds, and it cannot
 * hallucinate. No model is involved and no photograph leaves the device.
 */

/** A colour cast, as an angle and how much of it. */
export const gradeTintSchema = z.object({
  /** Degrees on the OKLCh hue circle — the same circle every other module uses. */
  hue: z.number().min(0).max(360),
  strength: z.number().min(0).max(1),
});
export type GradeTint = z.infer<typeof gradeTintSchema>;

export const gradeSchema = z.object({
  /** Stops, roughly: −1 is two stops down, +1 is two stops up. */
  exposure: z.number().min(-1).max(1),
  /** S-curve strength about mid grey. Negative flattens. */
  contrast: z.number().min(-1).max(1),
  /**
   * Raises the black point, or crushes below it.
   *
   * The filmic half of the grade. Print film cannot reach true black, and a
   * lifted, slightly tinted shadow is most of what people recognise as "film".
   */
  lift: z.number().min(-0.2).max(0.2),
  saturation: z.number().min(-1).max(1),
  /** Warm at +1, cool at −1. Acts on the red and blue channels against green. */
  temperature: z.number().min(-1).max(1),
  /** Magenta at +1, green at −1. The other white-balance axis. */
  tint: z.number().min(-1).max(1),
  shadowTint: gradeTintSchema,
  highlightTint: gradeTintSchema,
  vignette: z.number().min(0).max(1),
  grain: z.number().min(0).max(1),
});

export type Grade = z.infer<typeof gradeSchema>;

const NO_TINT: GradeTint = { hue: 0, strength: 0 };

/** The identity grade: every parameter off. Rendering it changes nothing. */
export const NEUTRAL_GRADE: Grade = {
  exposure: 0,
  contrast: 0,
  lift: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  shadowTint: NO_TINT,
  highlightTint: NO_TINT,
  vignette: 0,
  grain: 0,
};

/* ------------------------------------------------------- deriving a grade */

/**
 * Where each mood starts before the reading's own numbers modulate it.
 *
 * These are the eight editorial decisions in the feature, and they are stated as
 * data rather than buried in branches so they can be read, argued with and
 * tested. Hues are OKLCh degrees: ~30° is amber, ~90° is a yellow-green, ~230° is
 * the cool pole `atmosphere` already uses, ~300° is a violet.
 */
const MOOD_BASE: Record<AtmosphereMood, Grade> = {
  /** Still water and long light: barely there, cool in the shadow. */
  serene: {
    ...NEUTRAL_GRADE,
    contrast: -0.12,
    lift: 0.05,
    saturation: -0.08,
    shadowTint: { hue: 230, strength: 0.18 },
    highlightTint: { hue: 60, strength: 0.08 },
    grain: 0.12,
  },
  /** Skin, cloth, afternoon rooms: warm and soft, never punchy. */
  tender: {
    ...NEUTRAL_GRADE,
    exposure: 0.08,
    contrast: -0.15,
    lift: 0.07,
    temperature: 0.22,
    saturation: -0.05,
    shadowTint: { hue: 20, strength: 0.16 },
    highlightTint: { hue: 40, strength: 0.14 },
    grain: 0.16,
  },
  /** Light is the subject: hold the highlights, let them go warm. */
  luminous: {
    ...NEUTRAL_GRADE,
    exposure: 0.12,
    contrast: 0.1,
    temperature: 0.15,
    highlightTint: { hue: 45, strength: 0.2 },
    shadowTint: { hue: 250, strength: 0.1 },
    vignette: 0.1,
    grain: 0.08,
  },
  /** Saturated and lit: push it, but pull saturation back so it does not clip. */
  vivid: {
    ...NEUTRAL_GRADE,
    contrast: 0.28,
    saturation: 0.12,
    lift: -0.03,
    highlightTint: { hue: 30, strength: 0.08 },
    vignette: 0.18,
    grain: 0.06,
  },
  /** After dark: crushed, cool, and quiet in the colour. */
  nocturnal: {
    ...NEUTRAL_GRADE,
    exposure: -0.1,
    contrast: 0.22,
    lift: 0.06,
    temperature: -0.28,
    saturation: -0.18,
    shadowTint: { hue: 245, strength: 0.3 },
    highlightTint: { hue: 210, strength: 0.12 },
    vignette: 0.3,
    grain: 0.24,
  },
  /** Weather and distance: flat, desaturated, a violet in the shadow. */
  melancholy: {
    ...NEUTRAL_GRADE,
    exposure: -0.06,
    contrast: -0.2,
    lift: 0.1,
    saturation: -0.28,
    temperature: -0.12,
    shadowTint: { hue: 285, strength: 0.22 },
    highlightTint: { hue: 220, strength: 0.1 },
    vignette: 0.16,
    grain: 0.22,
  },
  /** Clay, wood, dry grass: warm, dense, slightly green in the light. */
  earthy: {
    ...NEUTRAL_GRADE,
    contrast: 0.08,
    lift: 0.03,
    temperature: 0.26,
    tint: -0.1,
    saturation: -0.06,
    shadowTint: { hue: 35, strength: 0.2 },
    highlightTint: { hue: 90, strength: 0.1 },
    grain: 0.18,
  },
  /** Concrete and paper: contrast carries it, colour stays out of the way. */
  stark: {
    ...NEUTRAL_GRADE,
    contrast: 0.34,
    lift: -0.04,
    saturation: -0.4,
    vignette: 0.12,
    grain: 0.1,
  },
};

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * Three decimal places, so a grade round-trips through storage unchanged.
 *
 * Negative zero is normalised away: `-0.08 * 0` is `-0`, which serialises as
 * `-0`, reads as `-0` in a diff, and is a distinct value to `toEqual` — none of
 * which is anything a grade means.
 */
const round = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000;
  return rounded === 0 ? 0 : rounded;
};

/**
 * The grade this reading asks for.
 *
 * The mood chooses the starting point; the reading's own measurements move it.
 * Each modulation answers a question the base grade cannot: a dark scene should
 * not be darkened further, a scene that already carries its own contrast does not
 * need more, and a photograph that is already saturated does not want pushing.
 *
 * Total: every schema-valid reading yields a schema-valid grade, and the result
 * is clamped to the schema's own bounds rather than trusting the arithmetic.
 */
export function gradeForAtmosphere(reading: AtmosphereReading): Grade {
  const base = MOOD_BASE[reading.mood];

  // A dark frame gets exposure back and a bright one gives some up — half a
  // stop at the extremes, which is a correction rather than a restatement.
  const exposure = base.exposure + (0.5 - reading.luminosity) * 0.3;

  // Contrast the scene already has is contrast the grade does not have to add.
  const contrast = base.contrast + (0.5 - reading.contrast) * 0.25;

  // Saturation moves against what is there: pull back a loud scene, lift a
  // muted one, so the grade reads as a look rather than as a level.
  const saturation = base.saturation + (0.45 - reading.saturation) * 0.35;

  // `warmth` runs −1 (cool) to 1 (warm). The grade leans *with* the scene
  // rather than correcting it — a warm room graded cool stops being that room.
  const temperature = base.temperature + reading.warmth * 0.18;

  // A scene that did not cluster tightly is noisy to begin with, and grain on
  // top of noise is mud.
  const grain = base.grain * (0.6 + reading.coherence * 0.4);

  // Spread is how far the named roles sit apart; a wide palette carries the
  // frame on its own and wants less help from a vignette.
  const vignette = base.vignette * (1 - reading.spread * 0.35);

  return gradeSchema.parse({
    exposure: round(clamp(exposure, -1, 1)),
    contrast: round(clamp(contrast, -1, 1)),
    lift: round(clamp(base.lift, -0.2, 0.2)),
    saturation: round(clamp(saturation, -1, 1)),
    temperature: round(clamp(temperature, -1, 1)),
    tint: round(clamp(base.tint, -1, 1)),
    shadowTint: base.shadowTint,
    highlightTint: base.highlightTint,
    vignette: round(clamp(vignette, 0, 1)),
    grain: round(clamp(grain, 0, 1)),
  });
}

/* -------------------------------------------------------------- film stocks */

export const filmStockIds = [
  'portra',
  'ektachrome',
  'tri-x',
  'cinestill',
  'polaroid',
  'velvia',
] as const;
export type FilmStockId = (typeof filmStockIds)[number];

export type FilmStock = Readonly<{
  id: FilmStockId;
  /** Not a brand name: what the look does, in the app's own words. */
  name: string;
  grade: Grade;
}>;

/**
 * Six looks, as grades rather than as lookup tables.
 *
 * They are named for what they do, not for the film they nod to — partly because
 * a stock name is a trademark, and partly because "warm skin, lifted shadows" is
 * more use to someone choosing than a word they may never have shot.
 *
 * Being the same type as a derived grade is the point: choosing a stock and
 * letting the photograph choose for itself produce the same kind of object, so
 * the controls, the storage and the renderer never learn the difference.
 */
export const FILM_STOCKS: readonly FilmStock[] = [
  {
    id: 'portra',
    name: 'Warm skin',
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 0.06,
      contrast: -0.18,
      lift: 0.08,
      saturation: -0.12,
      temperature: 0.2,
      shadowTint: { hue: 30, strength: 0.14 },
      highlightTint: { hue: 45, strength: 0.12 },
      grain: 0.18,
    },
  },
  {
    id: 'ektachrome',
    name: 'Clean slide',
    grade: {
      ...NEUTRAL_GRADE,
      contrast: 0.22,
      saturation: 0.08,
      temperature: -0.08,
      lift: -0.02,
      shadowTint: { hue: 225, strength: 0.16 },
      grain: 0.08,
    },
  },
  {
    id: 'tri-x',
    name: 'Black and grain',
    grade: {
      ...NEUTRAL_GRADE,
      contrast: 0.3,
      saturation: -1,
      lift: 0.06,
      vignette: 0.2,
      grain: 0.4,
    },
  },
  {
    id: 'cinestill',
    name: 'Tungsten night',
    grade: {
      ...NEUTRAL_GRADE,
      exposure: -0.08,
      contrast: 0.16,
      lift: 0.1,
      temperature: -0.24,
      saturation: 0.06,
      shadowTint: { hue: 250, strength: 0.28 },
      highlightTint: { hue: 15, strength: 0.22 },
      vignette: 0.24,
      grain: 0.26,
    },
  },
  {
    id: 'polaroid',
    name: 'Instant',
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 0.1,
      contrast: -0.24,
      lift: 0.14,
      saturation: -0.2,
      temperature: 0.1,
      tint: 0.08,
      shadowTint: { hue: 190, strength: 0.2 },
      highlightTint: { hue: 55, strength: 0.18 },
      vignette: 0.18,
      grain: 0.2,
    },
  },
  {
    id: 'velvia',
    name: 'Saturated landscape',
    grade: {
      ...NEUTRAL_GRADE,
      contrast: 0.32,
      saturation: 0.28,
      lift: -0.05,
      temperature: 0.06,
      shadowTint: { hue: 240, strength: 0.12 },
      vignette: 0.22,
      grain: 0.05,
    },
  },
];

export const filmStock = (id: FilmStockId): FilmStock | null =>
  FILM_STOCKS.find((stock) => stock.id === id) ?? null;

/**
 * Whether two grades are the same look.
 *
 * By value, not by identity: a stored grade is a different object that happens
 * to hold the same numbers, and a picker that compared references would show
 * nothing selected after a reload.
 */
export function gradesEqual(a: Grade, b: Grade): boolean {
  return (
    a.exposure === b.exposure &&
    a.contrast === b.contrast &&
    a.lift === b.lift &&
    a.saturation === b.saturation &&
    a.temperature === b.temperature &&
    a.tint === b.tint &&
    a.vignette === b.vignette &&
    a.grain === b.grain &&
    a.shadowTint.hue === b.shadowTint.hue &&
    a.shadowTint.strength === b.shadowTint.strength &&
    a.highlightTint.hue === b.highlightTint.hue &&
    a.highlightTint.strength === b.highlightTint.strength
  );
}

/* ------------------------------------------------------------------ scaling */

/**
 * The same look, turned down.
 *
 * Linear interpolation towards `NEUTRAL_GRADE`, which is what "50% of this look"
 * means when the identity grade is all zeros: every parameter simply gets
 * smaller. That makes a look library into a continuum, and it is the control
 * every photo app has because it is the one people reach for after "which one" —
 * "yes, but less".
 *
 * **A tint's hue does not interpolate; its strength does.** A hue is a position
 * on a circle, and dragging one towards zero takes the wrong way round — a blue
 * shadow would travel through green and amber on its way to nothing. The hue is
 * already the right hue at any strength.
 *
 * The result is a `Grade` like any other. Nothing stores the amount: the screen
 * uses this to produce a grade, and what gets saved is that grade. An intensity
 * kept alongside would mean a migration, and every reader — the shader, the
 * bake, `describeGrade` — would have to learn to multiply before looking.
 */
export function scaleGrade(grade: Grade, amount: number): Grade {
  const factor = clamp(amount, 0, 1);
  const scale = (value: number) => round(value * factor);
  /**
   * A tint keeps its hue at every strength it actually has — and a tint with no
   * strength is not a tint, so it collapses to the neutral one.
   *
   * That last part is not pedantry. `gradesEqual` compares hues, so a grade
   * scaled to nothing while still carrying a hue would fail to match
   * `NEUTRAL_GRADE`, and the "Original" chip would sit unlit next to a
   * photograph that is visibly original.
   */
  const fade = (tint: GradeTint): GradeTint => {
    const strength = round(tint.strength * factor);
    return strength === 0 ? NO_TINT : { hue: tint.hue, strength };
  };

  return {
    exposure: scale(grade.exposure),
    contrast: scale(grade.contrast),
    lift: scale(grade.lift),
    saturation: scale(grade.saturation),
    temperature: scale(grade.temperature),
    tint: scale(grade.tint),
    shadowTint: fade(grade.shadowTint),
    highlightTint: fade(grade.highlightTint),
    vignette: scale(grade.vignette),
    grain: scale(grade.grain),
  };
}

/* --------------------------------------------------------------- describing */

/**
 * A grade as a sentence.
 *
 * Two jobs, and they turn out to be the same job: it is what a screen reader
 * announces, and it is the product keeping its promise that a derived look can
 * be explained rather than merely applied. Only the terms that carry weight are
 * named — a grade that says everything says nothing.
 */
export function describeGrade(grade: Grade): readonly string[] {
  const terms: string[] = [];

  if (grade.exposure >= 0.08) terms.push('brighter');
  else if (grade.exposure <= -0.08) terms.push('darker');

  if (grade.contrast >= 0.15) terms.push('harder contrast');
  else if (grade.contrast <= -0.12) terms.push('softer contrast');

  if (grade.temperature >= 0.12) terms.push('warmer');
  else if (grade.temperature <= -0.12) terms.push('cooler');

  if (grade.saturation >= 0.1) terms.push('richer colour');
  else if (grade.saturation <= -0.15) terms.push('muted colour');

  if (grade.lift >= 0.04) terms.push('lifted blacks');
  else if (grade.lift <= -0.03) terms.push('crushed blacks');

  if (grade.shadowTint.strength >= 0.15) terms.push(`${hueName(grade.shadowTint.hue)} shadows`);
  if (grade.highlightTint.strength >= 0.15)
    terms.push(`${hueName(grade.highlightTint.hue)} highlights`);

  if (grade.grain >= 0.18) terms.push('grain');
  if (grade.vignette >= 0.2) terms.push('vignette');

  // A grade can legitimately be almost nothing — a neutral scene needs no help,
  // and saying so is better than inventing a term for it.
  return terms.length ? terms : ['untouched'];
}

/** Coarse hue names, at the resolution a sentence about a photograph needs. */
function hueName(hue: number): string {
  const wrapped = ((hue % 360) + 360) % 360;
  if (wrapped < 20 || wrapped >= 345) return 'red';
  if (wrapped < 50) return 'amber';
  if (wrapped < 80) return 'gold';
  if (wrapped < 160) return 'green';
  if (wrapped < 200) return 'teal';
  if (wrapped < 265) return 'blue';
  if (wrapped < 315) return 'violet';
  return 'magenta';
}
