import type { ResolvedGrade } from '@cw/domain';

/**
 * The grade, as one SkSL pass on the GPU.
 *
 * **This is a transcription, not a second opinion.** `gradePixels.ts` in the
 * domain holds the canonical arithmetic; every step below is numbered to match
 * its numbered steps, and `gradeShader.test.ts` runs this shader through
 * CanvasKit and asserts it agrees with the reference pixel for pixel. If the two
 * ever diverge, the reference is right and this is wrong.
 *
 * Tints arrive already resolved to RGB. Turning a hue into a colour is an Oklab
 * matrix multiply — cheap once per grade in JavaScript, wasteful once per pixel
 * here, and a place where the two implementations could quietly disagree in the
 * last decimal. See `resolveGrade`.
 */
export const GRADE_SHADER = `
uniform shader image;

uniform float exposure;
uniform float contrast;
uniform float lift;
uniform float saturation;
uniform float temperature;
uniform float tintAmount;
uniform vec3  shadowTintColor;
uniform float shadowTintStrength;
uniform vec3  highlightTintColor;
uniform float highlightTintStrength;
uniform float vignette;
uniform float grain;
uniform vec2  resolution;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

// sRGB transfer functions, matching the domain's byte-for-byte.
float toLinear1(float v) {
  return v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4);
}
float toDisplay1(float v) {
  float c = clamp(v, 0.0, 1.0);
  return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
}
vec3 toLinear3(vec3 v) {
  return vec3(toLinear1(v.r), toLinear1(v.g), toLinear1(v.b));
}
vec3 toDisplay3(vec3 v) {
  return vec3(toDisplay1(v.r), toDisplay1(v.g), toDisplay1(v.b));
}

/**
 * Deterministic value noise for grain.
 *
 * Positional and unseeded on purpose: the same photograph graded twice has the
 * same grain, so a memory does not shimmer when it is re-rendered. The reference
 * implementation does not carry grain at all — it is texture, not colour — so
 * this is the one place the two sides are allowed to differ, and the tests grade
 * with grain at zero.
 */
float noise(vec2 position) {
  return fract(sin(dot(position, vec2(12.9898, 78.233))) * 43758.5453);
}

half4 main(vec2 coord) {
  half4 source = image.eval(coord);
  vec3 color = vec3(source.rgb);

  // 1 · exposure, in linear light. ±1 is ±2 stops.
  color = toDisplay3(toLinear3(color) * pow(2.0, exposure * 2.0));

  // 2 · lift. One formula either way; the clamp below does the crushing.
  color = vec3(lift) + color * (1.0 - lift);

  // 3 · contrast, toward an S-curve or toward flat mid grey.
  if (contrast > 0.0) {
    vec3 clamped = clamp(color, 0.0, 1.0);
    vec3 curved = clamped * clamped * (3.0 - 2.0 * clamped);
    color = color + (curved - color) * contrast;
  } else if (contrast < 0.0) {
    color = color + (vec3(0.5) - color) * (-contrast * 0.5);
  }

  // 4 · white balance, as channel gains.
  color.r *= 1.0 + temperature * 0.15;
  color.b *= 1.0 - temperature * 0.15;
  color.g *= 1.0 - tintAmount * 0.12;

  // 5 · saturation, about this pixel's own luma.
  if (saturation != 0.0) {
    float level = dot(color, LUMA);
    color = vec3(level) + (color - vec3(level)) * (1.0 + saturation);
  }

  // 6 · split tone, against squared masks so it stays out of the mid tones.
  float level = clamp(dot(clamp(color, 0.0, 1.0), LUMA), 0.0, 1.0);
  float shadowMask = (1.0 - level) * (1.0 - level) * shadowTintStrength;
  float highlightMask = level * level * highlightTintStrength;
  color += (shadowTintColor - vec3(0.5)) * shadowMask
         + (highlightTintColor - vec3(0.5)) * highlightMask;

  color = clamp(color, 0.0, 1.0);

  // 7 · vignette. Positional, so it lives outside the colour transform — see
  // \`vignetteFactor\`, which this matches.
  if (vignette > 0.0 && resolution.x > 0.0 && resolution.y > 0.0) {
    vec2 offset = (coord - resolution * 0.5) / (resolution * 0.5);
    float distance = min(1.0, length(offset) / 1.4142135623730951);
    color *= 1.0 - vignette * 0.6 * distance * distance;
  }

  // 8 · grain, last, so it sits on the finished image the way film does.
  if (grain > 0.0) {
    float speck = noise(coord) - 0.5;
    color += vec3(speck * grain * 0.12);
  }

  return half4(half3(clamp(color, 0.0, 1.0)), source.a);
}
`;

/**
 * The uniform values, in the order the shader declares them.
 *
 * SkSL uniforms are handed over as one flat array, so a field inserted in the
 * wrong place silently grades the photograph with somebody else's number — which
 * is exactly the failure this function exists to make testable. The order here is
 * asserted against `GRADE_SHADER`'s declarations in the tests.
 */
export function gradeUniforms(
  grade: ResolvedGrade,
  width: number,
  height: number,
): Record<string, number | readonly number[]> {
  return {
    exposure: grade.exposure,
    contrast: grade.contrast,
    lift: grade.lift,
    saturation: grade.saturation,
    temperature: grade.temperature,
    tintAmount: grade.tint,
    shadowTintColor: [grade.shadowTintColor.r, grade.shadowTintColor.g, grade.shadowTintColor.b],
    shadowTintStrength: grade.shadowTintStrength,
    highlightTintColor: [
      grade.highlightTintColor.r,
      grade.highlightTintColor.g,
      grade.highlightTintColor.b,
    ],
    highlightTintStrength: grade.highlightTintStrength,
    vignette: grade.vignette,
    grain: grade.grain,
    resolution: [width, height],
  };
}

/** The uniform names the shader declares, in declaration order. */
export const GRADE_UNIFORM_ORDER = [
  'exposure',
  'contrast',
  'lift',
  'saturation',
  'temperature',
  'tintAmount',
  'shadowTintColor',
  'shadowTintStrength',
  'highlightTintColor',
  'highlightTintStrength',
  'vignette',
  'grain',
  'resolution',
] as const;
