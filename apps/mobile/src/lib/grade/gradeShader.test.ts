/**
 * @jest-environment node
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import {
  applyGradeToRgba,
  gradeForAtmosphere,
  NEUTRAL_GRADE,
  resolveGrade,
  type AtmosphereMood,
  type Grade,
} from '@cw/domain';
import { GRADE_SHADER, GRADE_UNIFORM_ORDER, gradeUniforms } from './gradeShader';

/**
 * The shader and the reference must agree.
 *
 * This runs the real SkSL — the same source the app ships — through CanvasKit,
 * which is Skia, and compares the result to `applyGradeToRgba` pixel by pixel.
 * Without it the grade would be verifiable only by looking at it on a phone,
 * which is not verification.
 *
 * Grain is zero throughout: it is deliberately positional noise that the
 * reference does not model, and it is the one part of the pass the two sides are
 * not required to match.
 */

const require = createRequire(__filename);

let CanvasKit: any;

beforeAll(async () => {
  // Expo's winter runtime installs a TextDecoder that does not implement
  // utf-16le, and CanvasKit's wasm loader asks for exactly that. Node's own
  // works; this only affects this file's environment.

  globalThis.TextDecoder = require('node:util').TextDecoder;

  const initPath = require.resolve('canvaskit-wasm');
  const init = require(initPath) as (options: {
    locateFile: (file: string) => string;
  }) => Promise<unknown>;
  CanvasKit = await init({ locateFile: (file: string) => join(dirname(initPath), file) });
}, 60_000);

const SIZE = 16;

/** A gradient with colour in it, so every branch of the transform is exercised. */
function sourcePixels(): Uint8Array {
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const offset = (y * SIZE + x) * 4;
      pixels[offset] = Math.round((x / (SIZE - 1)) * 255);
      pixels[offset + 1] = Math.round((y / (SIZE - 1)) * 255);
      pixels[offset + 2] = Math.round(((x + y) / (2 * SIZE - 2)) * 255);
      pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

/** Runs the shipped SkSL over the buffer and returns what Skia produced. */
function renderWithShader(pixels: Uint8Array, grade: Grade): Uint8Array {
  const effect = CanvasKit.RuntimeEffect.Make(GRADE_SHADER);
  if (!effect) throw new Error('The grade shader did not compile.');

  const surface = CanvasKit.MakeSurface(SIZE, SIZE);
  if (!surface) throw new Error('CanvasKit could not make a surface.');

  const image = CanvasKit.MakeImage(
    {
      width: SIZE,
      height: SIZE,
      alphaType: CanvasKit.AlphaType.Unpremul,
      colorType: CanvasKit.ColorType.RGBA_8888,
      colorSpace: CanvasKit.ColorSpace.SRGB,
    },
    pixels,
    SIZE * 4,
  );
  if (!image) throw new Error('CanvasKit could not make an image.');

  const imageShader = image.makeShaderOptions(
    CanvasKit.TileMode.Clamp,
    CanvasKit.TileMode.Clamp,
    CanvasKit.FilterMode.Nearest,
    CanvasKit.MipmapMode.None,
  );

  const resolved = resolveGrade(grade);
  const named = gradeUniforms(resolved, SIZE, SIZE);
  // Flattened in declaration order, which is the contract this asserts.
  const flat: number[] = [];
  for (const name of GRADE_UNIFORM_ORDER) {
    const value = named[name];
    if (Array.isArray(value)) flat.push(...value);
    else flat.push(value as number);
  }

  const shader = effect.makeShaderWithChildren(flat, [imageShader]);
  const paint = new CanvasKit.Paint();
  paint.setShader(shader);

  const canvas = surface.getCanvas();
  canvas.clear(CanvasKit.TRANSPARENT);
  canvas.drawRect(CanvasKit.XYWHRect(0, 0, SIZE, SIZE), paint);

  const out = surface.getCanvas().readPixels(0, 0, {
    width: SIZE,
    height: SIZE,
    alphaType: CanvasKit.AlphaType.Unpremul,
    colorType: CanvasKit.ColorType.RGBA_8888,
    colorSpace: CanvasKit.ColorSpace.SRGB,
  });

  paint.delete();
  shader.delete();
  imageShader.delete();
  image.delete();
  surface.delete();
  effect.delete();

  return new Uint8Array(out as ArrayLike<number>);
}

/** Largest per-channel difference, in 8-bit steps. */
function worstDifference(a: Uint8Array, b: Uint8Array): number {
  let worst = 0;
  for (let index = 0; index < a.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs((a[index + channel] ?? 0) - (b[index + channel] ?? 0));
      if (delta > worst) worst = delta;
    }
  }
  return worst;
}

const ungrained = (grade: Grade): Grade => ({ ...grade, grain: 0 });

const MOODS: readonly AtmosphereMood[] = [
  'serene',
  'tender',
  'luminous',
  'vivid',
  'nocturnal',
  'melancholy',
  'earthy',
  'stark',
];

it('compiles', () => {
  const effect = CanvasKit.RuntimeEffect.Make(GRADE_SHADER);
  expect(effect).toBeTruthy();
  effect?.delete();
});

it('declares its uniforms in the order gradeUniforms packs them', () => {
  // A field in the wrong place grades the photograph with somebody else's
  // number, and nothing about the result looks like an error.
  const declared = [...GRADE_SHADER.matchAll(/uniform\s+(?:float|vec2|vec3)\s+(\w+)\s*;/g)].map(
    (match) => match[1],
  );
  expect(declared).toEqual([...GRADE_UNIFORM_ORDER]);
});

it('leaves the image alone under the neutral grade', () => {
  const source = sourcePixels();
  const rendered = renderWithShader(source, NEUTRAL_GRADE);
  expect(worstDifference(rendered, source)).toBeLessThanOrEqual(2);
});

it('agrees with the reference on every derived grade', () => {
  const source = sourcePixels();

  // Collected rather than asserted in the loop, so a failure names every look
  // that diverged instead of only the first.
  const divergence = Object.fromEntries(
    MOODS.map((mood) => {
      const grade = ungrained(
        gradeForAtmosphere({
          luminosity: 0.5,
          warmth: 0,
          saturation: 0.45,
          contrast: 0.5,
          spread: 0.4,
          coherence: 0.8,
          mood,
        }),
      );
      const rendered = renderWithShader(source, grade);
      const reference = applyGradeToRgba(source, SIZE, SIZE, resolveGrade(grade));
      // Two 8-bit steps: the GPU works in half precision and the reference in
      // doubles, so exact equality would be asserting something untrue.
      return [mood, worstDifference(rendered, reference) <= 2];
    }),
  );

  expect(divergence).toEqual(Object.fromEntries(MOODS.map((mood) => [mood, true])));
});

it('agrees with the reference at the extremes of every parameter', () => {
  const source = sourcePixels();
  const extremes: Grade[] = [
    { ...NEUTRAL_GRADE, exposure: 1 },
    { ...NEUTRAL_GRADE, exposure: -1 },
    { ...NEUTRAL_GRADE, contrast: 1 },
    { ...NEUTRAL_GRADE, contrast: -1 },
    { ...NEUTRAL_GRADE, lift: 0.2 },
    { ...NEUTRAL_GRADE, lift: -0.2 },
    { ...NEUTRAL_GRADE, saturation: 1 },
    { ...NEUTRAL_GRADE, saturation: -1 },
    { ...NEUTRAL_GRADE, temperature: 1 },
    { ...NEUTRAL_GRADE, temperature: -1 },
    { ...NEUTRAL_GRADE, tint: 1 },
    { ...NEUTRAL_GRADE, tint: -1 },
    { ...NEUTRAL_GRADE, shadowTint: { hue: 245, strength: 1 } },
    { ...NEUTRAL_GRADE, highlightTint: { hue: 40, strength: 1 } },
    { ...NEUTRAL_GRADE, vignette: 1 },
  ];

  for (const grade of extremes) {
    const rendered = renderWithShader(source, grade);
    const reference = applyGradeToRgba(source, SIZE, SIZE, resolveGrade(grade));
    expect(worstDifference(rendered, reference)).toBeLessThanOrEqual(2);
  }
});

it('carries alpha through untouched', () => {
  const source = sourcePixels();
  for (let index = 3; index < source.length; index += 4) source[index] = 128;
  const rendered = renderWithShader(source, { ...NEUTRAL_GRADE, saturation: 1 });
  for (let index = 3; index < rendered.length; index += 4) {
    expect(Math.abs((rendered[index] ?? 0) - 128)).toBeLessThanOrEqual(2);
  }
});
