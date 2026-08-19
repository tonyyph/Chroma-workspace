import type { GlowEffect, GrainEffect, OutlineEffect, ShadowEffect } from '@cw/domain';
import { BlendMode, Skia, type SkImageFilter, type SkShader } from '@shopify/react-native-skia';

/**
 * The Skia filters each effect is made of.
 *
 * Every factory used here was verified against the installed `.d.ts` for
 * `@shopify/react-native-skia@2.4.18` on 2026-08-19 — see
 * `10-cutout-and-effects-design.md` §4. Nothing here is a hoped-for API.
 *
 * Untested by unit test on purpose: these return Skia objects and need the
 * native side. The arithmetic that decides their *values* lives in
 * `domain/effects.ts:scaledEffects` and is tested there, which is the same split
 * `bakeGrade.ts` uses.
 */

/**
 * The subject, spread outward and tinted.
 *
 * `MakeDilate` grows the alpha; `MakeBlend(colour, SrcIn)` replaces every
 * surviving pixel with the outline colour. Drawn behind the image, so the
 * original covers the middle and only the grown rim shows.
 *
 * An earlier draft of the design specified eight offset draws instead, because
 * dilate was believed unavailable. Checking the type definitions took a minute
 * and removed seven draws per outlined element.
 */
export const outlineFilter = (outline: OutlineEffect): SkImageFilter =>
  Skia.ImageFilter.MakeColorFilter(
    Skia.ColorFilter.MakeBlend(Skia.Color(outline.colorHex), BlendMode.SrcIn),
    Skia.ImageFilter.MakeDilate(outline.width, outline.width, null),
  );

/** Offset and blurred, drawn behind. `DropShadowOnly` omits the source image. */
export const shadowFilter = (shadow: ShadowEffect): SkImageFilter =>
  Skia.ImageFilter.MakeDropShadowOnly(
    shadow.dx,
    shadow.dy,
    shadow.blur,
    shadow.blur,
    Skia.Color(shadow.colorHex),
    null,
  );

/**
 * A halo: the same primitive as a shadow, with no offset and a large sigma.
 *
 * One primitive covering two effects is worth stating — a separate glow
 * implementation would be a second thing to keep in agreement with the first.
 */
export const glowFilter = (glow: GlowEffect): SkImageFilter =>
  Skia.ImageFilter.MakeDropShadowOnly(
    0,
    0,
    glow.radius,
    glow.radius,
    Skia.Color(glow.colorHex),
    null,
  );

/**
 * Film grain, seeded from the document.
 *
 * `MakeTurbulence` takes the seed, so two renders of the same document produce
 * the same grain — which is what keeps an export reproducible. The frequency is
 * fixed rather than exposed: it is what makes the noise read as grain rather
 * than as clouds, and it is not a decision worth handing to a slider.
 */
const GRAIN_FREQUENCY = 0.8;
const GRAIN_OCTAVES = 2;

export const grainShader = (grain: GrainEffect, width: number, height: number): SkShader =>
  Skia.Shader.MakeTurbulence(
    GRAIN_FREQUENCY,
    GRAIN_FREQUENCY,
    GRAIN_OCTAVES,
    grain.seed,
    Math.max(1, Math.round(width)),
    Math.max(1, Math.round(height)),
  );
