import { NEUTRAL_GRADE, type Grade } from './grading';

/**
 * The look library.
 *
 * Separate from `grading.ts` on purpose: that module defines what a grade *is*
 * and how one is derived from a photograph, and thirty sets of numbers sitting
 * on top of it would bury the argument. This module is the catalogue.
 *
 * Every look is the same `Grade` an automatic read produces. That is the whole
 * design: choosing a look and letting the photograph choose for itself yield the
 * same kind of object, so the picker, the dial, the storage and the renderer
 * never learn the difference.
 *
 * Names say what a look does rather than which film it nods at — partly because
 * a stock name is a trademark, and partly because "warm skin, lifted shadows" is
 * more use to someone choosing than a word they may never have shot.
 */

export const lookCollectionIds = [
  'negative',
  'slide',
  'monochrome',
  'after-dark',
  'early-digital',
] as const;
export type LookCollectionId = (typeof lookCollectionIds)[number];

export type Look = Readonly<{
  id: string;
  /** What it does, in the app's own words. Never a film's name. */
  name: string;
  collection: LookCollectionId;
  /**
   * One look per collection is free.
   *
   * A wall of locked chips tells someone the app is not for them. One working
   * look per collection tells them what the collection *is*, which is the thing
   * worth paying to unlock.
   */
  free: boolean;
  grade: Grade;
}>;

export const LOOKS: readonly Look[] = [
  {
    id: 'portra',
    name: 'Warm skin',
    collection: 'negative',
    free: true,
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
    id: 'polaroid',
    name: 'Instant',
    collection: 'negative',
    free: false,
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
    id: 'faded-print',
    name: 'Faded print',
    collection: 'negative',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      contrast: -0.22,
      lift: 0.12,
      saturation: -0.3,
      temperature: -0.05,
      shadowTint: { hue: 300, strength: 0.18 },
      grain: 0.14,
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden hour',
    collection: 'negative',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 0.12,
      contrast: 0.05,
      lift: 0.05,
      saturation: 0.05,
      temperature: 0.3,
      shadowTint: { hue: 35, strength: 0.2 },
      highlightTint: { hue: 60, strength: 0.22 },
      vignette: 0.1,
      grain: 0.2,
    },
  },
  {
    id: 'overcast',
    name: 'Overcast',
    collection: 'negative',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: -0.04,
      contrast: -0.14,
      lift: 0.06,
      saturation: -0.22,
      temperature: -0.2,
      shadowTint: { hue: 220, strength: 0.2 },
      grain: 0.16,
    },
  },
  {
    id: 'pushed',
    name: 'Pushed two stops',
    collection: 'negative',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 0.05,
      contrast: 0.26,
      lift: 0.05,
      saturation: -0.18,
      temperature: 0.08,
      shadowTint: { hue: 25, strength: 0.16 },
      vignette: 0.24,
      grain: 0.4,
    },
  },
  {
    id: 'ektachrome',
    name: 'Clean slide',
    collection: 'slide',
    free: true,
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
    id: 'velvia',
    name: 'Saturated landscape',
    collection: 'slide',
    free: false,
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
  {
    id: 'deep-chrome',
    name: 'Deep chrome',
    collection: 'slide',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      contrast: 0.3,
      saturation: 0.3,
      lift: -0.06,
      temperature: -0.14,
      shadowTint: { hue: 230, strength: 0.24 },
      vignette: 0.26,
    },
  },
  {
    id: 'sunlit-chrome',
    name: 'Sunlit chrome',
    collection: 'slide',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 0.1,
      contrast: 0.24,
      saturation: 0.22,
      temperature: 0.22,
      lift: -0.04,
      highlightTint: { hue: 55, strength: 0.2 },
      vignette: 0.2,
    },
  },
  {
    id: 'cross-process',
    name: 'Cross process',
    collection: 'slide',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      contrast: 0.28,
      saturation: 0.18,
      temperature: -0.1,
      tint: 0.2,
      lift: 0.1,
      shadowTint: { hue: 175, strength: 0.35 },
      highlightTint: { hue: 330, strength: 0.3 },
      vignette: 0.12,
      grain: 0.1,
    },
  },
  {
    id: 'muted-chrome',
    name: 'Muted chrome',
    collection: 'slide',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      contrast: 0.2,
      saturation: -0.2,
      temperature: 0.05,
      lift: 0.04,
      shadowTint: { hue: 120, strength: 0.18 },
      vignette: 0.1,
      grain: 0.06,
    },
  },
  {
    id: 'tri-x',
    name: 'Black and grain',
    collection: 'monochrome',
    free: true,
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
    id: 'soft-mono',
    name: 'Soft mono',
    collection: 'monochrome',
    free: false,
    grade: { ...NEUTRAL_GRADE, contrast: -0.2, saturation: -1, lift: 0.1, grain: 0.08 },
  },
  {
    id: 'hard-mono',
    name: 'Hard mono',
    collection: 'monochrome',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      contrast: 0.4,
      saturation: -1,
      lift: -0.06,
      vignette: 0.12,
      grain: 0.06,
    },
  },
  {
    /**
     * Warmth from the split tone, not from the white balance.
     *
     * Saturation runs after white balance and throws it away, so `temperature`
     * on a monochrome look is a sentence `describeGrade` reads out and the
     * renderer never honours. The split tone runs last, so it survives.
     */
    id: 'toned-warm',
    name: 'Warm tone',
    collection: 'monochrome',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      contrast: 0.1,
      saturation: -1,
      lift: 0.08,
      shadowTint: { hue: 30, strength: 0.34 },
      highlightTint: { hue: 55, strength: 0.24 },
      grain: 0.22,
    },
  },
  {
    id: 'toned-cool',
    name: 'Cool tone',
    collection: 'monochrome',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      contrast: 0.26,
      saturation: -1,
      lift: 0.04,
      shadowTint: { hue: 240, strength: 0.3 },
      vignette: 0.22,
      grain: 0.16,
    },
  },
  {
    id: 'newsprint',
    name: 'Newsprint',
    collection: 'monochrome',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 0.14,
      contrast: 0.18,
      saturation: -1,
      lift: 0.12,
      grain: 0.5,
    },
  },
  {
    id: 'cinestill',
    name: 'Tungsten night',
    collection: 'after-dark',
    free: true,
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
    id: 'neon',
    name: 'Neon',
    collection: 'after-dark',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: -0.06,
      contrast: 0.24,
      lift: 0.08,
      saturation: 0.24,
      temperature: -0.16,
      shadowTint: { hue: 290, strength: 0.3 },
      highlightTint: { hue: 180, strength: 0.24 },
      vignette: 0.28,
      grain: 0.12,
    },
  },
  {
    id: 'sodium',
    name: 'Street light',
    collection: 'after-dark',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: -0.1,
      contrast: 0.2,
      lift: 0.1,
      saturation: -0.1,
      temperature: 0.28,
      shadowTint: { hue: 35, strength: 0.28 },
      highlightTint: { hue: 50, strength: 0.26 },
      vignette: 0.26,
      grain: 0.3,
    },
  },
  {
    id: 'blue-hour',
    name: 'Blue hour',
    collection: 'after-dark',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: -0.05,
      contrast: -0.14,
      lift: 0.1,
      saturation: -0.12,
      temperature: -0.3,
      shadowTint: { hue: 235, strength: 0.3 },
      highlightTint: { hue: 280, strength: 0.18 },
      vignette: 0.14,
      grain: 0.18,
    },
  },
  {
    id: 'available-dark',
    name: 'Available darkness',
    collection: 'after-dark',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: -0.12,
      contrast: 0.3,
      lift: -0.04,
      saturation: -0.34,
      temperature: -0.08,
      shadowTint: { hue: 245, strength: 0.2 },
      vignette: 0.3,
      grain: 0.45,
    },
  },
  {
    id: 'interior',
    name: 'Interior lamp',
    collection: 'after-dark',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 0.06,
      contrast: -0.16,
      lift: 0.12,
      saturation: -0.08,
      temperature: 0.24,
      shadowTint: { hue: 10, strength: 0.2 },
      highlightTint: { hue: 40, strength: 0.2 },
      vignette: 0.1,
      grain: 0.14,
    },
  },

  /**
   * Early digital dates a photograph rather than warming it.
   *
   * The other four collections are film, and film is what people reach for when
   * they want a picture to look *better*. This one is for wanting it to look
   * like it was taken at a particular time — green casts, blown flash, crushed
   * shadows, the artefacts of a sensor that was not very good yet.
   */
  {
    id: 'camcorder',
    name: 'Camcorder',
    collection: 'early-digital',
    free: true,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 0.1,
      contrast: -0.16,
      saturation: -0.14,
      temperature: -0.06,
      tint: -0.24,
      shadowTint: { hue: 110, strength: 0.26 },
      highlightTint: { hue: 95, strength: 0.2 },
      vignette: 0.16,
      grain: 0.1,
    },
  },
  {
    id: 'tape',
    name: 'Tape',
    collection: 'early-digital',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 0.04,
      contrast: -0.18,
      lift: 0.14,
      saturation: 0.12,
      temperature: 0.06,
      tint: 0.22,
      shadowTint: { hue: 325, strength: 0.28 },
      highlightTint: { hue: 185, strength: 0.2 },
      vignette: 0.2,
      grain: 0.34,
    },
  },
  {
    id: 'direct-flash',
    name: 'Direct flash',
    collection: 'early-digital',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 0.16,
      contrast: 0.28,
      lift: -0.05,
      saturation: -0.18,
      temperature: -0.14,
      shadowTint: { hue: 170, strength: 0.18 },
      vignette: 0.24,
      grain: 0.08,
    },
  },
  {
    id: 'low-res',
    name: 'Low resolution',
    collection: 'early-digital',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: -0.06,
      contrast: 0.22,
      lift: -0.04,
      saturation: -0.26,
      temperature: 0.1,
      shadowTint: { hue: 295, strength: 0.2 },
      highlightTint: { hue: 65, strength: 0.18 },
      grain: 0.38,
    },
  },
  {
    id: 'screen-glow',
    name: 'Screen glow',
    collection: 'early-digital',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      exposure: 0.08,
      contrast: -0.2,
      lift: 0.16,
      saturation: 0.14,
      temperature: -0.22,
      shadowTint: { hue: 215, strength: 0.24 },
      grain: 0.2,
    },
  },
  {
    id: 'early-web',
    name: 'Early web',
    collection: 'early-digital',
    free: false,
    grade: {
      ...NEUTRAL_GRADE,
      contrast: 0.34,
      saturation: 0.34,
      temperature: 0.14,
      highlightTint: { hue: 45, strength: 0.2 },
      vignette: 0.22,
    },
  },
];

export const looksIn = (collection: LookCollectionId): readonly Look[] =>
  LOOKS.filter((entry) => entry.collection === collection);

export const look = (id: string): Look | null => LOOKS.find((entry) => entry.id === id) ?? null;
