import { z } from 'zod';

import { hexSchema } from '../palette';

/**
 * What can be drawn around and over an element.
 *
 * **Four primitives and one preset**, not the seven the brief lists. Duplicating
 * a subject is `duplicateElement`, which has existed since Phase 1, and parallax
 * is motion that a still export cannot carry — see
 * `10-cutout-and-effects-design.md` §3.
 *
 * **Every number is bounded, and the bound lives here.** Not for tidiness:
 * `applyStoryPatch` has to refuse a composer proposing a 4000-unit shadow, and
 * the way it refuses is that the ceiling is in the schema.
 *
 * All dimensions are **logical canvas units**, never screen points — the same
 * space element frames live in, so an effect means the same thing at every
 * preview scale.
 */

export const MAX_OUTLINE_WIDTH = 64;
export const MAX_SHADOW_OFFSET = 256;
export const MAX_SHADOW_BLUR = 128;
export const MAX_GLOW_RADIUS = 256;

export const outlineEffectSchema = z.object({
  width: z.number().min(0).max(MAX_OUTLINE_WIDTH),
  colorHex: hexSchema,
});

export const shadowEffectSchema = z.object({
  dx: z.number().min(-MAX_SHADOW_OFFSET).max(MAX_SHADOW_OFFSET),
  dy: z.number().min(-MAX_SHADOW_OFFSET).max(MAX_SHADOW_OFFSET),
  blur: z.number().min(0).max(MAX_SHADOW_BLUR),
  colorHex: hexSchema,
});

export const glowEffectSchema = z.object({
  radius: z.number().min(0).max(MAX_GLOW_RADIUS),
  colorHex: hexSchema,
});

export const grainEffectSchema = z.object({
  amount: z.number().min(0).max(1),
  /**
   * Fixed at the moment grain is switched on, and stored.
   *
   * `Shader.MakeTurbulence` takes a seed, so determinism is a parameter rather
   * than something to engineer around. Re-randomising per render would break
   * reproducible exports quietly, because two exports would look *nearly* the
   * same.
   */
  seed: z.number().int().min(0).max(2147483647),
});

export const elementEffectsSchema = z
  .object({
    outline: outlineEffectSchema.nullable().default(null),
    shadow: shadowEffectSchema.nullable().default(null),
    glow: glowEffectSchema.nullable().default(null),
    grain: grainEffectSchema.nullable().default(null),
  })
  .default({ outline: null, shadow: null, glow: null, grain: null });

export type ElementEffects = z.infer<typeof elementEffectsSchema>;
export type OutlineEffect = z.infer<typeof outlineEffectSchema>;
export type ShadowEffect = z.infer<typeof shadowEffectSchema>;
export type GlowEffect = z.infer<typeof glowEffectSchema>;
export type GrainEffect = z.infer<typeof grainEffectSchema>;

export const EMPTY_EFFECTS: ElementEffects = {
  outline: null,
  shadow: null,
  glow: null,
  grain: null,
};

/** Whether anything at all is switched on, so the renderer can skip the work. */
export const hasEffects = (effects: ElementEffects): boolean =>
  effects.outline !== null ||
  effects.shadow !== null ||
  effects.glow !== null ||
  effects.grain !== null;

/**
 * The paper-cut look, as a preset over the primitives.
 *
 * A thick outline and a hard, unblurred shadow — the shadow's sharpness is what
 * makes it read as a cut edge rather than as a soft drop.
 */
export function paperCut(colorHex: string): ElementEffects {
  return {
    outline: { width: 18, colorHex },
    shadow: { dx: 10, dy: 14, blur: 0, colorHex: '#000000' },
    glow: null,
    grain: null,
  };
}

/**
 * The same effects, expressed at a different drawing scale.
 *
 * **This exists because of the one risk the design names.** `drawScene` scales
 * the canvas once, and geometry follows — but a Skia blur sigma may be in device
 * space rather than in the scaled space. If it is, the preview shows a 4px
 * outline and the export shows a 12px one: same code, same document, different
 * result.
 *
 * Keeping the arithmetic here and pure means the maths is proven even though the
 * rendering is not, and there is one place to change if the device check in §4
 * of the design says the scaling is not needed.
 *
 * Grain is untouched: `amount` is a ratio and `seed` is an identity, and scaling
 * either would change the picture rather than its size.
 */
export function scaledEffects(effects: ElementEffects, scale: number): ElementEffects {
  if (scale === 1) return effects;

  return {
    outline:
      effects.outline === null
        ? null
        : { ...effects.outline, width: effects.outline.width * scale },
    shadow:
      effects.shadow === null
        ? null
        : {
            ...effects.shadow,
            dx: effects.shadow.dx * scale,
            dy: effects.shadow.dy * scale,
            blur: effects.shadow.blur * scale,
          },
    glow: effects.glow === null ? null : { ...effects.glow, radius: effects.glow.radius * scale },
    grain: effects.grain,
  };
}
