import { oklabToRgb, oklchToOklab } from './color';
import type { Grade, GradeTint } from './grading';

/**
 * What a grade does to a pixel — the canonical definition.
 *
 * The GPU shader that runs this on a real photograph is a transcription of the
 * arithmetic below, not a second opinion about it. `gradeShader.test.ts` asserts
 * the two agree at sample points, which is the only reason a look that is
 * ultimately judged by eye can be tested at all.
 *
 * **Tints are resolved before either implementation runs.** A grade names its
 * split-tone colours as hues on the OKLCh circle, and turning a hue into RGB is
 * an Oklab matrix multiply — cheap once per grade, wasteful once per pixel, and
 * a place where a shader and a reference could quietly disagree in the last
 * decimal. `resolveGrade` does it in one place and hands both sides the same
 * three numbers.
 */

/** Channel values 0–1, not 0–255: this is working space, not storage. */
export type LinearRgb = Readonly<{ r: number; g: number; b: number }>;

/** A grade with its hues turned into colours, ready for either renderer. */
export type ResolvedGrade = Readonly<{
  exposure: number;
  contrast: number;
  lift: number;
  saturation: number;
  temperature: number;
  tint: number;
  shadowTintColor: LinearRgb;
  shadowTintStrength: number;
  highlightTintColor: LinearRgb;
  highlightTintStrength: number;
  vignette: number;
  grain: number;
}>;

/**
 * The lightness and chroma a split-tone colour is sampled at.
 *
 * Mid lightness because the tint is *added* against a mask and its own lightness
 * would otherwise fight the exposure; modest chroma because a split tone at full
 * chroma stops being a tone and becomes a colour wash.
 */
const TINT_LIGHTNESS = 0.62;
const TINT_CHROMA = 0.11;

const tintColor = ({ hue }: GradeTint): LinearRgb => {
  const rgb = oklabToRgb(oklchToOklab({ lightness: TINT_LIGHTNESS, chroma: TINT_CHROMA, hue }));
  return { r: rgb.red / 255, g: rgb.green / 255, b: rgb.blue / 255 };
};

export function resolveGrade(grade: Grade): ResolvedGrade {
  return {
    exposure: grade.exposure,
    contrast: grade.contrast,
    lift: grade.lift,
    saturation: grade.saturation,
    temperature: grade.temperature,
    tint: grade.tint,
    shadowTintColor: tintColor(grade.shadowTint),
    shadowTintStrength: grade.shadowTint.strength,
    highlightTintColor: tintColor(grade.highlightTint),
    highlightTintStrength: grade.highlightTint.strength,
    vignette: grade.vignette,
    grain: grade.grain,
  };
}

/* ------------------------------------------------------------- the transform */

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Rec. 709 luma. The weights the eye uses, not the mean of three channels. */
const luma = ({ r, g, b }: LinearRgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** A real S-curve rather than a slope: it steepens the middle without clipping. */
const smoothstep = (value: number) => value * value * (3 - 2 * value);

/**
 * Applies a resolved grade to one pixel, in this order:
 *
 *  1. **Exposure**, in linear light — the only step that belongs there, because
 *     it is the one that models more or less light reaching the sensor. Doing it
 *     on gamma-encoded values is the same mistake `useImageSampler` documents for
 *     averaging.
 *  2. **Lift**, which moves the black point. One formula covers both directions:
 *     positive maps the range onto `[lift, 1]`, negative pushes the bottom below
 *     zero where the clamp crushes it.
 *  3. **Contrast**, as a blend toward an S-curve, or toward flat mid grey.
 *  4. **White balance**, as channel gains.
 *  5. **Saturation**, about the pixel's own luma.
 *  6. **Split tone**, added against masks taken from luma, so a tint lands in the
 *     shadows or the highlights and not across the whole frame.
 *
 * Everything after step 1 works on display-referred values, which is where
 * contrast and saturation controls are defined and what makes them behave the way
 * someone dragging a slider expects.
 */
export function applyGradeToPixel(pixel: LinearRgb, grade: ResolvedGrade): LinearRgb {
  // 1 · exposure, in linear light. ±1 is ±2 stops.
  const stops = grade.exposure * 2;
  const gain = 2 ** stops;
  let r = toDisplay(toLinear(pixel.r) * gain);
  let g = toDisplay(toLinear(pixel.g) * gain);
  let b = toDisplay(toLinear(pixel.b) * gain);

  // 2 · lift
  if (grade.lift !== 0) {
    r = grade.lift + r * (1 - grade.lift);
    g = grade.lift + g * (1 - grade.lift);
    b = grade.lift + b * (1 - grade.lift);
  }

  // 3 · contrast
  if (grade.contrast > 0) {
    r = r + (smoothstep(clamp01(r)) - r) * grade.contrast;
    g = g + (smoothstep(clamp01(g)) - g) * grade.contrast;
    b = b + (smoothstep(clamp01(b)) - b) * grade.contrast;
  } else if (grade.contrast < 0) {
    const flatten = -grade.contrast * 0.5;
    r = r + (0.5 - r) * flatten;
    g = g + (0.5 - g) * flatten;
    b = b + (0.5 - b) * flatten;
  }

  // 4 · white balance
  r *= 1 + grade.temperature * 0.15;
  b *= 1 - grade.temperature * 0.15;
  g *= 1 - grade.tint * 0.12;

  // 5 · saturation, about this pixel's own luma
  if (grade.saturation !== 0) {
    const level = luma({ r, g, b });
    const amount = 1 + grade.saturation;
    r = level + (r - level) * amount;
    g = level + (g - level) * amount;
    b = level + (b - level) * amount;
  }

  // 6 · split tone. Squared masks so the tint stays out of the mid tones, which
  // is what separates a split tone from a colour cast over everything.
  const level = clamp01(luma({ r: clamp01(r), g: clamp01(g), b: clamp01(b) }));
  const shadowMask = (1 - level) * (1 - level) * grade.shadowTintStrength;
  const highlightMask = level * level * grade.highlightTintStrength;

  r +=
    (grade.shadowTintColor.r - 0.5) * shadowMask +
    (grade.highlightTintColor.r - 0.5) * highlightMask;
  g +=
    (grade.shadowTintColor.g - 0.5) * shadowMask +
    (grade.highlightTintColor.g - 0.5) * highlightMask;
  b +=
    (grade.shadowTintColor.b - 0.5) * shadowMask +
    (grade.highlightTintColor.b - 0.5) * highlightMask;

  return { r: clamp01(r), g: clamp01(g), b: clamp01(b) };
}

/**
 * How much a vignette darkens at one point of the frame.
 *
 * Positional, so it is not part of the per-pixel colour transform above and is
 * tested on its own terms: 1 at the centre, falling toward the corners, and
 * never reaching zero — a vignette that blacks out a corner is a hole, not a
 * grade.
 */
export function vignetteFactor(
  x: number,
  y: number,
  width: number,
  height: number,
  amount: number,
): number {
  if (amount <= 0 || width <= 0 || height <= 0) return 1;
  // Distance from centre, normalised so a corner is 1.
  const dx = (x - width / 2) / (width / 2);
  const dy = (y - height / 2) / (height / 2);
  const distance = Math.min(1, Math.sqrt(dx * dx + dy * dy) / Math.SQRT2);
  // Squared falloff keeps the centre clean and puts the whole effect at the edge.
  return 1 - amount * 0.6 * distance * distance;
}

/* --------------------------------------------------------- whole-image path */

const toLinear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

const toDisplay = (value: number) => {
  const clamped = clamp01(value);
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
};

/**
 * Grades a whole RGBA buffer on the CPU.
 *
 * Not the path a photograph takes — that is the shader — but the path a *test*
 * takes, and the path anything without a GPU surface can fall back to. Alpha is
 * carried through untouched: a grade changes colour, never coverage.
 */
export function applyGradeToRgba(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  grade: ResolvedGrade,
): Uint8Array {
  const out = new Uint8Array(rgba.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const graded = applyGradeToPixel(
        {
          r: (rgba[offset] ?? 0) / 255,
          g: (rgba[offset + 1] ?? 0) / 255,
          b: (rgba[offset + 2] ?? 0) / 255,
        },
        grade,
      );
      const shade = vignetteFactor(x, y, width, height, grade.vignette);
      out[offset] = Math.round(clamp01(graded.r * shade) * 255);
      out[offset + 1] = Math.round(clamp01(graded.g * shade) * 255);
      out[offset + 2] = Math.round(clamp01(graded.b * shade) * 255);
      out[offset + 3] = rgba[offset + 3] ?? 255;
    }
  }
  return out;
}
