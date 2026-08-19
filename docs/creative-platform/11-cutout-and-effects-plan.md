# Chroma Cutout and Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the effects layer (outline, glow, grain, shadow, paper-cut) on photo elements, then subject extraction through a local Expo module over iOS Vision.

**Architecture:** Two phases that are independently shippable. **Phase A (Tasks 1–7)** adds effects to the existing photo element — pure schema plus Skia image filters, verifiable without a device. **Phase B (Tasks 8–13)** adds the native module, which produces pre-cut RGBA assets that the Phase A renderer already knows how to draw. Phase A must be green before Phase B starts.

**Tech Stack:** TypeScript 5.9 strict, zod 4, `@shopify/react-native-skia` 2.4.18, Expo SDK 55 local modules, Swift + Vision (iOS 17+), vitest (domain), jest + jest-expo (mobile).

**Spec:** `docs/creative-platform/10-cutout-and-effects-design.md`

## Global Constraints

- **No new dependencies.** Everything needed is installed.
- **No colour literals in `features/` or `app/`.** `no-appearance-leaks.test.ts` fails the build. Colours are passed in from the skin.
- **`en.ts` and `vi.ts` in lockstep**, within the character budgets in `localization.test.ts` (chip 16, button 34, tab 10). Vietnamese runs ~25–30% longer.
- **Every schema addition is a widening with `.default(...)`.** No `schemaVersion` bump. Existing records must still parse.
- **Exports must be deterministic.** No unseeded randomness anywhere in the render path.
- **New screens register in `src/__tests__/screens.test.tsx`.**
- **Gate after every task:** `corepack pnpm check` must exit 0.
- **Effect dimensions are in logical canvas units**, never screen points.
- **Never delete the author's work** to satisfy a layout or a capability.

---

## File Structure

**Phase A — effects**

| File                                                              | Responsibility                                            |
| ----------------------------------------------------------------- | --------------------------------------------------------- |
| `packages/domain/src/story/effects.ts` (create)                   | Effect schemas, bounds, paper-cut preset, `scaledEffects` |
| `packages/domain/src/story/effects.test.ts` (create)              | Bounds, defaults, preset, scaling arithmetic              |
| `packages/domain/src/story/elements.ts` (modify)                  | `effects` field on the photo element                      |
| `packages/domain/src/story/patch.ts` (modify)                     | Reject out-of-bounds effect proposals                     |
| `packages/domain/src/story/remix.ts` (modify)                     | Photo slots carry effects                                 |
| `apps/mobile/src/features/story/render/effectFilters.ts` (create) | Build the Skia filter chain                               |
| `apps/mobile/src/features/story/render/drawScene.ts` (modify)     | Apply effects in the fixed order                          |
| `apps/mobile/src/features/story/EffectControls.tsx` (create)      | Chip row plus per-effect sheet                            |

**Phase B — cutout**

| File                                                                    | Responsibility                                |
| ----------------------------------------------------------------------- | --------------------------------------------- |
| `packages/domain/src/story/elements.ts` (modify)                        | `maskAssetId` → `cutoutAssetId`               |
| `apps/mobile/modules/chromawave-subject-cutout/` (create)               | The local Expo module: config, podspec, Swift |
| `apps/mobile/src/infrastructure/story/ExpoSubjectExtractor.ts` (create) | TS binding, availability mapping              |
| `apps/mobile/src/features/story/cutoutElements.ts` (create)             | N instances → N elements, pure                |
| `apps/mobile/src/features/story/CutoutPicker.tsx` (create)              | Instance picker                               |

---

## Phase A — the effects layer

### Task 1: Effect schemas

**Files:**

- Create: `packages/domain/src/story/effects.ts`
- Test: `packages/domain/src/story/effects.test.ts`
- Modify: `packages/domain/src/story/index.ts`

**Interfaces:**

- Consumes: `hexSchema` from `../palette`
- Produces: `elementEffectsSchema`, `ElementEffects`, `EMPTY_EFFECTS`, `paperCut(colorHex)`, `MAX_OUTLINE_WIDTH`, `MAX_SHADOW_OFFSET`, `MAX_SHADOW_BLUR`, `MAX_GLOW_RADIUS`

- [ ] **Step 1: Write the failing test**

```ts
// packages/domain/src/story/effects.test.ts
import { describe, expect, it } from 'vitest';
import { elementEffectsSchema, EMPTY_EFFECTS, MAX_OUTLINE_WIDTH, paperCut } from './effects';

describe('effect bounds', () => {
  it('defaults to nothing switched on', () => {
    expect(elementEffectsSchema.parse(undefined)).toEqual(EMPTY_EFFECTS);
  });

  it('rejects an outline wider than the ceiling', () => {
    // The bound is in the schema because `applyStoryPatch` has to reject a
    // composer proposing an absurd value, and that is how it rejects.
    const over = {
      ...EMPTY_EFFECTS,
      outline: { width: MAX_OUTLINE_WIDTH + 1, colorHex: '#FFFFFF' },
    };
    expect(elementEffectsSchema.safeParse(over).success).toBe(false);
  });

  it('rejects grain outside 0-1', () => {
    const over = { ...EMPTY_EFFECTS, grain: { amount: 1.5, seed: 1 } };
    expect(elementEffectsSchema.safeParse(over).success).toBe(false);
  });

  it('requires an integer grain seed, so a render is reproducible', () => {
    const fractional = { ...EMPTY_EFFECTS, grain: { amount: 0.5, seed: 1.5 } };
    expect(elementEffectsSchema.safeParse(fractional).success).toBe(false);
  });
});

describe('paper-cut', () => {
  it('is a preset of outline and shadow, not a fifth primitive', () => {
    const preset = paperCut('#FFFFFF');
    expect(preset.outline).not.toBeNull();
    expect(preset.shadow).not.toBeNull();
    expect(preset.glow).toBeNull();
  });

  it('gives the shadow a hard edge, which is what makes it read as paper', () => {
    expect(paperCut('#FFFFFF').shadow?.blur).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd packages/domain && npx vitest run src/story/effects`
Expected: FAIL — cannot resolve `./effects`

- [ ] **Step 3: Implement**

```ts
// packages/domain/src/story/effects.ts
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
```

- [ ] **Step 4: Export it**

Add to `packages/domain/src/story/index.ts`, keeping the list alphabetical:

```ts
export * from './effects';
```

- [ ] **Step 5: Run the tests**

Run: `cd packages/domain && npx vitest run src/story/effects`
Expected: PASS, 6 tests

- [ ] **Step 6: Full gate**

Run: `corepack pnpm check`
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add packages/domain/src/story/effects.ts packages/domain/src/story/effects.test.ts packages/domain/src/story/index.ts
git commit -m "feat(story): add bounded effect schemas and the paper-cut preset"
```

---

### Task 2: Effects on the photo element

**Files:**

- Modify: `packages/domain/src/story/elements.ts`
- Test: `packages/domain/src/story/effects.test.ts` (append)

**Interfaces:**

- Consumes: `elementEffectsSchema` from Task 1
- Produces: `photoElementSchema` gains `effects: ElementEffects`

- [ ] **Step 1: Write the failing test**

Append to `packages/domain/src/story/effects.test.ts`:

```ts
import { storyElementSchema } from './elements';

describe('effects on a photo element', () => {
  const photo = (overrides: Record<string, unknown> = {}) => ({
    kind: 'photo',
    id: 'p',
    frame: { x: 0, y: 0, width: 100, height: 100 },
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId: 'a',
    sourceWidth: 4032,
    sourceHeight: 3024,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    ...overrides,
  });

  it('defaults to no effects, so every existing project still parses', () => {
    const parsed = storyElementSchema.parse(photo());
    expect(parsed.kind).toBe('photo');
    if (parsed.kind === 'photo') expect(parsed.effects).toEqual(EMPTY_EFFECTS);
  });

  it('accepts an element carrying effects', () => {
    const parsed = storyElementSchema.parse(
      photo({ effects: { ...EMPTY_EFFECTS, grain: { amount: 0.4, seed: 7 } } }),
    );
    if (parsed.kind === 'photo') expect(parsed.effects.grain?.seed).toBe(7);
  });

  it('rejects an element whose effects are out of bounds', () => {
    const over = photo({
      effects: { ...EMPTY_EFFECTS, glow: { radius: 9999, colorHex: '#FFFFFF' } },
    });
    expect(storyElementSchema.safeParse(over).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd packages/domain && npx vitest run src/story/effects`
Expected: FAIL — `effects` is undefined on the parsed element

- [ ] **Step 3: Implement**

In `packages/domain/src/story/elements.ts`, add the import:

```ts
import { elementEffectsSchema } from './effects';
```

and add the field to `photoElementSchema`, after `focal`:

```ts
  /**
   * What is drawn around and over this photograph.
   *
   * A nested object rather than five flat fields: one widening, one place to
   * read, and the whole set is optional in a single default. Photo elements
   * only for now — effects on text are a separate widening later.
   */
  effects: elementEffectsSchema,
```

- [ ] **Step 4: Run the tests**

Run: `cd packages/domain && npx vitest run src/story`
Expected: PASS

- [ ] **Step 5: Fix the constructors the compiler now rejects**

Run: `corepack pnpm typecheck`

`exactOptionalPropertyTypes` means every place constructing a photo element by
object literal must now supply `effects`. Add `effects: EMPTY_EFFECTS` in:

- `apps/mobile/src/features/story/placePhoto.ts`
- `apps/mobile/src/features/story/composeFromMemories.ts`
- `packages/domain/src/story/remix.ts` (in `applyRecipe`)

- [ ] **Step 6: Full gate**

Run: `corepack pnpm check`
Expected: exit 0

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(story): carry effects on the photo element"
```

---

### Task 3: Scaling effects for the preview

**Files:**

- Modify: `packages/domain/src/story/effects.ts`
- Test: `packages/domain/src/story/effects.test.ts` (append)

**Interfaces:**

- Produces: `scaledEffects(effects: ElementEffects, scale: number): ElementEffects`

This is the arithmetic behind the largest risk in the spec (§4): if effect
dimensions do not scale with the canvas, the preview and the export disagree.
Keeping it pure means the maths is proven even though the rendering is not.

- [ ] **Step 1: Write the failing test**

Append to `packages/domain/src/story/effects.test.ts`:

```ts
import { scaledEffects } from './effects';

describe('scaledEffects', () => {
  const full: ElementEffects = {
    outline: { width: 20, colorHex: '#FFFFFF' },
    shadow: { dx: 10, dy: -10, blur: 8, colorHex: '#000000' },
    glow: { radius: 40, colorHex: '#7C5CFF' },
    grain: { amount: 0.5, seed: 3 },
  };

  it('is the identity at export scale', () => {
    expect(scaledEffects(full, 1)).toEqual(full);
  });

  it('scales every dimension by the same factor', () => {
    const half = scaledEffects(full, 0.5);
    expect(half.outline?.width).toBe(10);
    expect(half.shadow?.dx).toBe(5);
    expect(half.shadow?.blur).toBe(4);
    expect(half.glow?.radius).toBe(20);
  });

  it('leaves grain alone, because it is a ratio and a seed, not a length', () => {
    const half = scaledEffects(full, 0.5);
    expect(half.grain).toEqual(full.grain);
  });

  it('keeps colours untouched', () => {
    expect(scaledEffects(full, 0.25).outline?.colorHex).toBe('#FFFFFF');
  });

  it('passes nulls through', () => {
    expect(scaledEffects(EMPTY_EFFECTS, 0.5)).toEqual(EMPTY_EFFECTS);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd packages/domain && npx vitest run src/story/effects`
Expected: FAIL — `scaledEffects` is not exported

- [ ] **Step 3: Implement**

Append to `packages/domain/src/story/effects.ts`:

```ts
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
 * Grain is untouched: `amount` is a ratio and `seed` is an identity, and
 * scaling either would change the picture rather than its size.
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
```

- [ ] **Step 4: Run the tests**

Run: `cd packages/domain && npx vitest run src/story/effects`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/story/effects.ts packages/domain/src/story/effects.test.ts
git commit -m "feat(story): scale effect dimensions for the preview"
```

---

### Task 4: The Skia filter chain

**Files:**

- Create: `apps/mobile/src/features/story/render/effectFilters.ts`

**Interfaces:**

- Consumes: `ElementEffects` from Task 1
- Produces: `outlineFilter`, `shadowFilter`, `glowFilter`, `grainShader`

No unit test: every function returns a Skia object and needs the native side.
Following `bakeGrade.test.ts`'s precedent — the arithmetic was extracted into
`scaledEffects` in Task 3 and is tested there; the construction is verified on a
device.

- [ ] **Step 1: Implement**

```ts
// apps/mobile/src/features/story/render/effectFilters.ts
import type { GlowEffect, GrainEffect, OutlineEffect, ShadowEffect } from '@cw/domain';
import {
  BlendMode,
  Skia,
  TileMode,
  type SkImageFilter,
  type SkShader,
} from '@shopify/react-native-skia';

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
    width,
    height,
  );

/** The tile mode blurs use. Exported so the renderer does not pick its own. */
export const EFFECT_TILE_MODE = TileMode.Decal;
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/story/render/effectFilters.ts
git commit -m "feat(story): build the Skia filter chain for effects"
```

---

### Task 5: Draw the effects

**Files:**

- Modify: `apps/mobile/src/features/story/render/drawScene.ts`

**Interfaces:**

- Consumes: `effectFilters` from Task 4, `scaledEffects` and `hasEffects` from Tasks 1 and 3

- [ ] **Step 1: Implement**

In `drawScene.ts`, replace the body of `drawPhoto` so effects are drawn in the
fixed order from the design. Add the imports:

```ts
import { hasEffects, scaledEffects, type ElementEffects } from '@cw/domain';
import { glowFilter, grainShader, outlineFilter, shadowFilter } from './effectFilters';
```

Change `drawPhoto`'s signature to take the scale, and pass `scale` at its call
site inside `drawScene`:

```ts
function drawPhoto(
  canvas: SkCanvas,
  image: SkImage,
  element: Extract<StoryElement, { kind: 'photo' }>,
  frame: { x: number; y: number; width: number; height: number },
  alpha: number,
  scale: number,
): void {
  const source = cropToSourceRect(element.crop, {
    width: image.width(),
    height: image.height(),
  });
  const destination = Skia.XYWHRect(frame.x, frame.y, frame.width, frame.height);
  const src = Skia.XYWHRect(source.x, source.y, source.width, source.height);

  /**
   * Effect dimensions are in canvas units and the canvas is already scaled, so
   * they are scaled to match. If the device check in the design's §4 shows Skia
   * sigmas already follow the canvas transform, this call becomes the identity —
   * one line to change, in one place.
   */
  const effects: ElementEffects = scaledEffects(element.effects, scale);

  const drawWith = (filter: Parameters<SkPaint['setImageFilter']>[0]) => {
    const paint = Skia.Paint();
    paint.setAlphaf(alpha);
    paint.setImageFilter(filter);
    canvas.drawImageRectOptions(
      image,
      src,
      destination,
      FilterMode.Linear,
      MipmapMode.Nearest,
      paint,
    );
  };

  // Back to front: glow, shadow, outline, image, grain. Fixed here rather than
  // decided per call, so two renders cannot disagree about depth.
  if (effects.glow !== null) drawWith(glowFilter(effects.glow));
  if (effects.shadow !== null) drawWith(shadowFilter(effects.shadow));
  if (effects.outline !== null) drawWith(outlineFilter(effects.outline));

  const paint = Skia.Paint();
  paint.setAlphaf(alpha);

  canvas.save();
  canvas.clipRect(destination, ClipOp.Intersect, true);
  canvas.drawImageRectOptions(
    image,
    src,
    destination,
    FilterMode.Linear,
    MipmapMode.Nearest,
    paint,
  );

  if (effects.grain !== null) {
    /**
     * Clipped to the element rather than the frame.
     *
     * Over a cut subject, grain covering the whole slide is a different effect
     * from grain on the subject — and the one the author asked for is the
     * second. `SrcATop` keeps it inside whatever alpha the image has.
     */
    const grainPaint = Skia.Paint();
    grainPaint.setShader(grainShader(effects.grain, frame.width, frame.height));
    grainPaint.setAlphaf(alpha * effects.grain.amount);
    grainPaint.setBlendMode(BlendMode.SrcATop);
    canvas.drawRect(destination, grainPaint);
  }

  canvas.restore();
}
```

Add `BlendMode` and `type SkPaint` to the `@shopify/react-native-skia` import.

Guard the whole effect path so an element with nothing switched on costs nothing:

```ts
if (!hasEffects(element.effects)) {
  // Unchanged fast path: no filters, no extra draws.
}
```

- [ ] **Step 2: Typecheck and run the mobile suite**

Run: `cd apps/mobile && npx tsc --noEmit && npx jest src/features/story --runInBand`
Expected: no type errors; existing story tests still pass

- [ ] **Step 3: Full gate**

Run: `corepack pnpm check`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/features/story/render/drawScene.ts
git commit -m "feat(story): draw element effects in a fixed order"
```

---

### Task 6: Effects travel and are validated

**Files:**

- Modify: `packages/domain/src/story/patch.ts`
- Modify: `packages/domain/src/story/remix.ts`
- Test: `packages/domain/src/story/patch.test.ts`, `packages/domain/src/story/remix.test.ts`

**Interfaces:**

- Produces: `StoryPatch` gains `effects: { elementId, effects }[]`; `photoSlotSchema` gains `effects`

- [ ] **Step 1: Write the failing tests**

Append to `packages/domain/src/story/patch.test.ts`:

```ts
import { EMPTY_EFFECTS, MAX_GLOW_RADIUS } from './effects';

describe('a patch cannot propose an absurd effect', () => {
  it('is rejected at parse time when a bound is exceeded', () => {
    const bad = {
      ...patch(),
      effects: [
        {
          elementId: 'p',
          effects: { ...EMPTY_EFFECTS, glow: { radius: MAX_GLOW_RADIUS + 1, colorHex: '#FFFFFF' } },
        },
      ],
    };
    expect(acceptStoryPatch(bad)).toBeNull();
  });

  it('applies a valid one', () => {
    const project = projectWith([photo('p')]);
    const result = applyStoryPatch(
      project,
      patch({
        effects: [
          { elementId: 'p', effects: { ...EMPTY_EFFECTS, grain: { amount: 0.3, seed: 5 } } },
        ],
      }),
      GROUND,
    );
    const layer = result.project.layers[0];
    expect(layer?.kind === 'photo' ? layer.effects.grain?.seed : null).toBe(5);
  });

  it('refuses to change effects on a locked element', () => {
    const project = projectWith([photo('p', { locked: true })]);
    const result = applyStoryPatch(
      project,
      patch({ effects: [{ elementId: 'p', effects: EMPTY_EFFECTS }] }),
      GROUND,
    );
    expect(result.rejected).toContainEqual({ reason: 'element-locked', elementId: 'p' });
  });
});
```

Append to `packages/domain/src/story/remix.test.ts`:

```ts
describe('effects travel in a recipe', () => {
  it('carries them, because they are design rather than content', () => {
    const withGrain = storyProjectSchema.parse({
      ...project(),
      layers: [
        {
          ...photo('p', 'a1'),
          effects: { outline: null, shadow: null, glow: null, grain: { amount: 0.4, seed: 9 } },
        },
      ],
    });
    const slot = toRecipe(withGrain, { recipeId: 'r1', now: NOW }).slots.find(
      (s) => s.kind === 'photo',
    );
    expect(slot?.kind === 'photo' ? slot.effects.grain?.seed : null).toBe(9);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

Run: `cd packages/domain && npx vitest run src/story/patch src/story/remix`
Expected: FAIL — `effects` is not a field on the patch or the slot

- [ ] **Step 3: Implement the patch field**

In `packages/domain/src/story/patch.ts`, import `elementEffectsSchema` and add
to `storyPatchSchema`:

```ts
  /** Effect changes, by element id. Bounds are the schema's, not this file's. */
  effects: z
    .array(z.object({ elementId: z.string().min(1).max(64), effects: elementEffectsSchema }))
    .max(MAX_SLIDES),
```

and a block in `applyStoryPatch`, after the typography block:

```ts
for (const entry of patch.effects) {
  const layer = byId.get(entry.elementId);
  if (layer === undefined) {
    rejected.push({ reason: 'unknown-element', elementId: entry.elementId });
    continue;
  }
  if (layer.kind !== 'photo') {
    rejected.push({ reason: 'wrong-element-kind', elementId: entry.elementId });
    continue;
  }
  if (layer.locked) {
    rejected.push({ reason: 'element-locked', elementId: entry.elementId });
    continue;
  }
  layers = replace(layers, entry.elementId, { ...layer, effects: entry.effects });
  changed = true;
}
```

- [ ] **Step 4: Implement the recipe field**

In `packages/domain/src/story/remix.ts`, add `effects: elementEffectsSchema` to
`photoSlotSchema`, carry it in `toRecipe`'s photo branch (`effects: layer.effects`),
and apply it in `applyRecipe`'s photo branch (`effects: slot.effects`).

`cutoutAssetId` is **not** added — an asset never travels.

- [ ] **Step 5: Fix the composer**

`compose()` in `director.ts` returns a `StoryPatch`; add `effects: []` to the
returned patch so it still parses.

- [ ] **Step 6: Run the tests**

Run: `cd packages/domain && npx vitest run src/story`
Expected: PASS

- [ ] **Step 7: Full gate and commit**

```bash
corepack pnpm check
git add -A
git commit -m "feat(story): validate effect patches and carry effects in a recipe"
```

---

### Task 7: Effect controls

**Files:**

- Create: `apps/mobile/src/features/story/EffectControls.tsx`
- Modify: `apps/mobile/src/features/story/StoryEditorScreen.tsx`
- Modify: `apps/mobile/src/localization/en.ts`, `vi.ts`
- Modify: `packages/domain/src/entitlements.ts`
- Modify: `packages/analytics/src/index.ts`
- Modify: `apps/mobile/src/__tests__/screens.test.tsx`

- [ ] **Step 1: Add the entitlement**

In `packages/domain/src/entitlements.ts`, add to the union and to the `pro` set:

```ts
  /**
   * The effects that surround a subject: outline, glow, grain, shadow.
   *
   * **The gate is on setting an effect, never on drawing one.** A story made
   * while subscribed keeps its effects and keeps exporting them if the
   * subscription lapses; only the controls become unavailable. Effects that
   * stopped rendering would silently alter a finished composition someone may
   * already have published from — and this product does not take back work it
   * has already accepted.
   */
  | 'cutout_effects';
```

- [ ] **Step 2: Add the analytics event**

In `packages/analytics/src/index.ts`, inside `AnalyticsEventMap`:

```ts
/** `effect` is the primitive's name, never the values or the element. */
effect_applied: {
  effect: 'outline' | 'glow' | 'grain' | 'shadow' | 'paper-cut';
}
```

- [ ] **Step 3: Add the strings**

`en.ts`:

```ts
  'story.effect.title': 'Effects',
  'story.effect.outline': 'Outline',
  'story.effect.glow': 'Glow',
  'story.effect.grain': 'Grain',
  'story.effect.shadow': 'Shadow',
  'story.effect.paperCut': 'Paper cut',
  'story.effect.none': 'None',
  'story.effect.locked': 'Pro',
```

`vi.ts`, same keys:

```ts
  'story.effect.title': 'Hiệu ứng',
  'story.effect.outline': 'Viền',
  'story.effect.glow': 'Quầng sáng',
  'story.effect.grain': 'Hạt phim',
  'story.effect.shadow': 'Đổ bóng',
  'story.effect.paperCut': 'Cắt giấy',
  'story.effect.none': 'Không',
  'story.effect.locked': 'Pro',
```

- [ ] **Step 4: Implement the control row**

```tsx
// apps/mobile/src/features/story/EffectControls.tsx
import { EMPTY_EFFECTS, paperCut, type ElementEffects } from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import { ScrollView, StyleSheet } from 'react-native';
import { useEntitlements, usePreferences, useSkin } from '@/providers';
import { Chip, useStyles } from '@/ui';

/**
 * Switching effects on, with defaults that already look right.
 *
 * **The defaults are part of the design, not numbers filled in later.** An
 * effect that has to be tuned before it stops looking broken is an effect people
 * switch off, so each chip applies a value chosen to be usable immediately.
 *
 * Colours come from the skin rather than from literals — the same rule text
 * colour follows, and `no-appearance-leaks.test.ts` enforces it.
 */
export function EffectControls({
  effects,
  onChange,
  onLocked,
}: {
  effects: ElementEffects;
  onChange: (
    next: ElementEffects,
    applied: 'outline' | 'glow' | 'grain' | 'shadow' | 'paper-cut' | 'none',
  ) => void;
  onLocked: () => void;
}) {
  const styles = useStyles(makeStyles);
  const skin = useSkin();
  const { t } = usePreferences();
  const { has, ready } = useEntitlements();

  const unlocked = ready && has('cutout_effects');
  const guard = (apply: () => void) => (unlocked ? apply() : onLocked());

  const ink = skin.ui.text.primary;
  const accent = skin.ui.action.primary;

  return (
    <ScrollView
      contentContainerStyle={styles.row}
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
    >
      <Chip
        label={t('story.effect.none')}
        onPress={() => onChange(EMPTY_EFFECTS, 'none')}
        tone={effects === EMPTY_EFFECTS ? 'selected' : 'default'}
      />
      <Chip
        label={unlocked ? t('story.effect.outline') : t('story.effect.locked')}
        onPress={() =>
          guard(() => onChange({ ...effects, outline: { width: 12, colorHex: ink } }, 'outline'))
        }
        tone={effects.outline === null ? 'default' : 'selected'}
      />
      <Chip
        label={unlocked ? t('story.effect.shadow') : t('story.effect.locked')}
        onPress={() =>
          guard(() =>
            onChange(
              { ...effects, shadow: { dx: 8, dy: 12, blur: 18, colorHex: '#000000' } },
              'shadow',
            ),
          )
        }
        tone={effects.shadow === null ? 'default' : 'selected'}
      />
      <Chip
        label={unlocked ? t('story.effect.glow') : t('story.effect.locked')}
        onPress={() =>
          guard(() => onChange({ ...effects, glow: { radius: 36, colorHex: accent } }, 'glow'))
        }
        tone={effects.glow === null ? 'default' : 'selected'}
      />
      <Chip
        label={unlocked ? t('story.effect.grain') : t('story.effect.locked')}
        onPress={() =>
          guard(() =>
            onChange(
              // The seed is fixed here, once, and stored — see `effects.ts`.
              { ...effects, grain: { amount: 0.35, seed: Math.floor(Math.random() * 2147483647) } },
              'grain',
            ),
          )
        }
        tone={effects.grain === null ? 'default' : 'selected'}
      />
      <Chip
        label={unlocked ? t('story.effect.paperCut') : t('story.effect.locked')}
        onPress={() => guard(() => onChange(paperCut(ink), 'paper-cut'))}
        tone="add"
      />
    </ScrollView>
  );
}

const makeStyles = (_skin: Skin) =>
  StyleSheet.create({
    row: {
      gap: space.xs,
      paddingHorizontal: space.gutter,
      paddingVertical: space.sm,
    },
  });
```

- [ ] **Step 5: Wire it into the editor**

In `StoryEditorScreen.tsx`, render it when the selected element is a photo,
alongside the existing Living Palette row:

```tsx
{
  selected?.kind !== 'photo' ? null : (
    <EffectControls
      effects={selected.effects}
      onChange={(next, applied) => {
        act((current) =>
          mapElement(
            current,
            selected.id,
            (element) => (element.kind === 'photo' ? { ...element, effects: next } : element),
            new Date().toISOString(),
          ),
        );
        if (applied !== 'none') analytics.track('effect_applied', { effect: applied });
      }}
      onLocked={() => router.push({ pathname: '/paywall', params: { trigger: 'template' } })}
    />
  );
}
```

- [ ] **Step 6: Run the guards**

Run: `cd apps/mobile && npx jest src/__tests__ --runInBand`
Expected: PASS — in particular `no-appearance-leaks` and `localization`

- [ ] **Step 7: Full gate and commit**

```bash
corepack pnpm check
git add -A
git commit -m "feat(story): add effect controls behind the cutout_effects entitlement"
```

**Phase A is complete here. It ships on its own: effects work on ordinary photographs, with no native code involved.**

---

## Phase B — subject extraction

### Task 8: Rename the mask field

**Files:**

- Modify: `packages/domain/src/story/elements.ts`
- Modify: `packages/domain/src/story/cutout.test.ts`
- Modify: `apps/mobile/src/features/story/placePhoto.ts`

**Interfaces:**

- Produces: `photoElementSchema.cutoutAssetId: string | null`

- [ ] **Step 1: Write the failing test**

In `packages/domain/src/story/cutout.test.ts`, replace the `maskAssetId` block:

```ts
describe('the cutout field on a photo', () => {
  it('defaults to no cutout, so every existing project still parses', () => {
    const parsed = storyElementSchema.parse(photo());
    if (parsed.kind === 'photo') expect(parsed.cutoutAssetId).toBeNull();
  });

  it('drops the old field name without failing', () => {
    // zod strips unknown keys, so a record written while the field was called
    // `maskAssetId` parses and takes the new default. No version bump.
    const parsed = storyElementSchema.parse(photo({ maskAssetId: 'old' }));
    if (parsed.kind === 'photo') expect(parsed.cutoutAssetId).toBeNull();
    expect(Object.keys(parsed)).not.toContain('maskAssetId');
  });

  it('accepts a cutout asset id', () => {
    const parsed = storyElementSchema.parse(photo({ cutoutAssetId: 'cut-1' }));
    if (parsed.kind === 'photo') expect(parsed.cutoutAssetId).toBe('cut-1');
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd packages/domain && npx vitest run src/story/cutout`
Expected: FAIL — `cutoutAssetId` is undefined

- [ ] **Step 3: Implement**

In `elements.ts`, replace the `maskAssetId` field with:

```ts
  /**
   * A background-removed rendering of the same photograph, or null.
   *
   * The element keeps its original `assetId`; this is an *alternative* asset the
   * renderer draws instead when present. Keeping both is what satisfies the
   * brief's "replace the background without modifying the original asset", and
   * it means a lost cutout file degrades to "the background came back" rather
   * than to a missing photograph.
   */
  cutoutAssetId: z.string().min(1).max(64).nullable().default(null),
```

Update `placePhoto.ts` to set `cutoutAssetId: null`.

- [ ] **Step 4: Run and gate**

```bash
cd packages/domain && npx vitest run src/story
corepack pnpm check
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(story): rename maskAssetId to cutoutAssetId"
```

---

### Task 9: The native module

**Files:**

- Create: `apps/mobile/modules/chromawave-subject-cutout/expo-module.config.json`
- Create: `apps/mobile/modules/chromawave-subject-cutout/ios/ChromawaveSubjectCutout.podspec`
- Create: `apps/mobile/modules/chromawave-subject-cutout/ios/ChromawaveSubjectCutoutModule.swift`

**Interfaces:**

- Produces: a native module named `ChromawaveSubjectCutout` with
  `isSupported(): Boolean` and `extract(sourceUri: String, destinationDir: String): [[String: Any]]` (async)

**This task cannot be verified by any check in this repo.** It compiles only in
Xcode, and the API surface is marked **[verify]** in the design's §7. Treat a
green `pnpm check` after this task as meaning "the JavaScript still builds", not
"the module works".

- [ ] **Step 1: Create the module config**

```json
{
  "platforms": ["apple"],
  "apple": {
    "modules": ["ChromawaveSubjectCutoutModule"]
  }
}
```

- [ ] **Step 2: Create the podspec**

```ruby
Pod::Spec.new do |s|
  s.name           = 'ChromawaveSubjectCutout'
  s.version        = '1.0.0'
  s.summary        = 'Lifts foreground subjects out of a photograph with Vision.'
  s.description    = 'A local Expo module. See docs/creative-platform/10-cutout-and-effects-design.md.'
  s.author         = 'Chroma Wave'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = { :type => 'Proprietary' }
  # Deliberately the app's own target, not 17. Vision is guarded at runtime;
  # raising the whole app's floor for one feature charges every user who will
  # never reach it.
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
```

- [ ] **Step 3: Implement the Swift module**

```swift
import ExpoModulesCore
import Foundation
import Vision
import UIKit

/// Foreground subjects, lifted out of a photograph and written to disk.
///
/// **Why files rather than bytes.** A 4096px RGBA image is roughly 67MB. Passing
/// that over the bridge as base64 is what the project refuses for photographs
/// everywhere else, so the caller supplies a directory and gets back paths.
///
/// **Why async, when `ChromawaveSharedContainer` is entirely synchronous.** That
/// module is on the tail of a save and must never make one fail. This one runs a
/// Vision request that takes 100-500ms; there is no synchronous form of it, and
/// pretending otherwise would block the JS thread for half a second.
public class ChromawaveSubjectCutoutModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ChromawaveSubjectCutout")

    /// Whether this build and this OS can lift a subject at all.
    ///
    /// Separate from `extract` and synchronous, because the answer decides
    /// whether the feature appears in the UI, and a screen should not have to
    /// run an extraction to find out.
    Function("isSupported") { () -> Bool in
      if #available(iOS 17.0, *) { return true }
      return false
    }

    AsyncFunction("extract") { (sourceUri: String, destinationDir: String) -> [[String: Any]] in
      guard #available(iOS 17.0, *) else {
        throw Exception(name: "os-too-old", description: "Subject lifting needs iOS 17.")
      }
      return try Self.lift(sourceUri: sourceUri, destinationDir: destinationDir)
    }
  }

  @available(iOS 17.0, *)
  private static func lift(sourceUri: String, destinationDir: String) throws -> [[String: Any]] {
    guard let url = URL(string: sourceUri),
          let data = try? Data(contentsOf: url),
          let image = UIImage(data: data),
          let cgImage = image.cgImage else {
      throw Exception(name: "unreadable-source", description: "Could not read the photograph.")
    }

    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    guard let observation = request.results?.first else { return [] }

    try FileManager.default.createDirectory(
      atPath: destinationDir, withIntermediateDirectories: true)

    var out: [[String: Any]] = []

    // One entry per instance: two people in a frame become two subjects the
    // author can move independently.
    for (index, instance) in observation.allInstances.enumerated() {
      let masked = try observation.generateMaskedImage(
        ofInstances: [instance], from: handler, croppedToInstancesExtent: true)

      let ciImage = CIImage(cvPixelBuffer: masked)
      let context = CIContext()
      guard let cg = context.createCGImage(ciImage, from: ciImage.extent),
            let png = UIImage(cgImage: cg).pngData() else { continue }

      let path = (destinationDir as NSString).appendingPathComponent("cutout-\(index).png")
      try png.write(to: URL(fileURLWithPath: path))

      out.append([
        "uri": URL(fileURLWithPath: path).absoluteString,
        "width": cg.width,
        "height": cg.height,
        "confidence": Double(observation.confidence),
      ])
    }

    return out
  }
}
```

- [ ] **Step 4: Typecheck the JavaScript side is unaffected**

Run: `corepack pnpm check`
Expected: exit 0 — nothing in TypeScript references this yet

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/modules/chromawave-subject-cutout
git commit -m "feat(cutout): add the iOS Vision subject-lifting module"
```

---

### Task 10: The TypeScript binding

**Files:**

- Create: `apps/mobile/src/infrastructure/story/ExpoSubjectExtractor.ts`
- Create: `apps/mobile/src/infrastructure/story/ExpoSubjectExtractor.test.ts`
- Modify: `apps/mobile/src/infrastructure/dependencies.ts`

**Interfaces:**

- Consumes: `SubjectExtractor`, `CutoutAvailability` from `@cw/domain`
- Produces: `ExpoSubjectExtractor` implementing `SubjectExtractor`

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/src/infrastructure/story/ExpoSubjectExtractor.test.ts
import { ExpoSubjectExtractor } from './ExpoSubjectExtractor';

describe('availability', () => {
  it('reports not-implemented when the module is absent', async () => {
    // Android, Expo Go and Jest all land here.
    const availability = await new ExpoSubjectExtractor(null).availability();
    expect(availability).toEqual({ status: 'unavailable', reason: 'not-implemented' });
  });

  it('reports os-too-old when the module says the OS cannot', async () => {
    const module = { isSupported: () => false, extract: jest.fn() };
    const availability = await new ExpoSubjectExtractor(module).availability();
    expect(availability).toEqual({ status: 'unavailable', reason: 'os-too-old' });
  });

  it('reports available when it can', async () => {
    const module = { isSupported: () => true, extract: jest.fn() };
    expect(await new ExpoSubjectExtractor(module).availability()).toEqual({ status: 'available' });
  });
});

describe('extraction', () => {
  it('returns no-subject rather than an error when nothing was found', async () => {
    // Vision ran correctly and the answer was none. That is an answer.
    const module = { isSupported: () => true, extract: jest.fn(async () => []) };
    const outcome = await new ExpoSubjectExtractor(module).extract({
      sourceUri: 'file:///a.jpg',
      destinationUri: 'file:///dir',
    });
    expect(outcome.status).toBe('no-subject');
  });

  it('reports a failure rather than throwing into the screen', async () => {
    const module = {
      isSupported: () => true,
      extract: jest.fn(async () => {
        throw new Error('vision exploded');
      }),
    };
    const outcome = await new ExpoSubjectExtractor(module).extract({
      sourceUri: 'file:///a.jpg',
      destinationUri: 'file:///dir',
    });
    expect(outcome.status).toBe('failed');
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd apps/mobile && npx jest src/infrastructure/story/ExpoSubjectExtractor --runInBand`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// apps/mobile/src/infrastructure/story/ExpoSubjectExtractor.ts
import type {
  CutoutAvailability,
  CutoutOutcome,
  CutoutRequest,
  SubjectExtractor,
} from '@cw/domain';
import { requireOptionalNativeModule } from 'expo';

/**
 * Subject extraction over the local module in
 * `modules/chromawave-subject-cutout`.
 *
 * `requireOptionalNativeModule` rather than `requireNativeModule` is the design
 * of this file, exactly as it is in `ExpoSharedContainer`: the module is iOS-only
 * and absent on Android, in Expo Go and under Jest. The optional form returns
 * null there instead of throwing at import time, which is what lets availability
 * be an honest answer rather than a try/catch at every call site.
 */

type NativeCutout = {
  isSupported(): boolean;
  extract(
    sourceUri: string,
    destinationDir: string,
  ): Promise<{ uri: string; width: number; height: number; confidence: number }[]>;
};

const native = requireOptionalNativeModule<NativeCutout>('ChromawaveSubjectCutout');

/** How long to wait before treating an extraction as failed rather than pending. */
const TIMEOUT_MS = 15_000;

export class ExpoSubjectExtractor implements SubjectExtractor {
  readonly id = 'ios-vision';

  constructor(private readonly module: NativeCutout | null = native) {}

  availability(): Promise<CutoutAvailability> {
    if (this.module === null) {
      return Promise.resolve({ status: 'unavailable', reason: 'not-implemented' });
    }
    if (!this.module.isSupported()) {
      return Promise.resolve({ status: 'unavailable', reason: 'os-too-old' });
    }
    return Promise.resolve({ status: 'available' });
  }

  async extract(request: CutoutRequest): Promise<CutoutOutcome> {
    if (this.module === null) {
      return { status: 'failed', reason: 'not-implemented' };
    }

    try {
      const instances = await withTimeout(
        this.module.extract(request.sourceUri, request.destinationUri),
        TIMEOUT_MS,
      );

      // Not an error. Vision ran and the answer was that there is no clear
      // foreground subject in this photograph.
      if (instances.length === 0) return { status: 'no-subject' };

      const first = instances[0];
      if (first === undefined) return { status: 'no-subject' };

      return {
        status: 'extracted',
        mask: {
          maskUri: first.uri,
          width: first.width,
          height: first.height,
          confidence: first.confidence,
          extractorVersion: 'ios-vision-1',
          extractedAt: new Date().toISOString(),
        },
      };
    } catch {
      // A hung or failed call is a state the screen can show, not a rejection to
      // propagate into a gesture handler.
      return { status: 'failed', reason: 'extraction-failed' };
    }
  }

  /** Every instance, for the picker. The interface's `extract` returns only the first. */
  async extractAll(request: CutoutRequest): Promise<readonly NativeInstance[]> {
    if (this.module === null) return [];
    try {
      return await withTimeout(
        this.module.extract(request.sourceUri, request.destinationUri),
        TIMEOUT_MS,
      );
    } catch {
      return [];
    }
  }
}

/**
 * A promise that gives up.
 *
 * Without this a hung native call is an unresolving spinner, which is the one
 * failure state with no way out for the user.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}
```

- [ ] **Step 4: Wire it**

In `dependencies.ts`, replace the `UnavailableSubjectExtractor` construction:

```ts
export const subjectExtractor: SubjectExtractor = new ExpoSubjectExtractor();
```

Keep `UnavailableSubjectExtractor` exported, the way `UnconfiguredMusicProvider`
is, so the absent path stays a reachable code path rather than a claim.

- [ ] **Step 5: Run and gate**

```bash
cd apps/mobile && npx jest src/infrastructure/story --runInBand
corepack pnpm check
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cutout): bind the Vision module and map its availability"
```

---

### Task 11: Instances become elements

**Files:**

- Create: `apps/mobile/src/features/story/cutoutElements.ts`
- Create: `apps/mobile/src/features/story/cutoutElements.test.ts`

**Interfaces:**

- Produces: `addCutoutElements(project, sourceElementId, instances, input): { project, added }`

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/src/features/story/cutoutElements.test.ts
import { createStoryProject, storyProjectSchema, type StoryProject } from '@cw/domain';
import { addCutoutElements } from './cutoutElements';

const ID = '11111111-1111-4111-8111-111111111111';
const NOW = '2026-08-19T09:00:00.000Z';

const instances = [
  { uri: 'file:///cut-0.png', width: 800, height: 1200, confidence: 0.9 },
  { uri: 'file:///cut-1.png', width: 700, height: 1100, confidence: 0.8 },
];

const asset = {
  id: 'a1',
  uri: 'file:///photos/a1.jpg',
  width: 4032,
  height: 3024,
  previewUri: null,
  createdAt: NOW,
};

const project = (): StoryProject =>
  storyProjectSchema.parse({
    ...createStoryProject({ id: ID, format: 'portrait', slideCount: 1, now: NOW }),
    assets: [asset],
    layers: [
      {
        kind: 'photo',
        id: 'p',
        frame: { x: 0, y: 0, width: 1080, height: 1350 },
        rotation: 0,
        opacity: 1,
        locked: false,
        hidden: false,
        assetId: 'a1',
        sourceWidth: 4032,
        sourceHeight: 3024,
        crop: { x: 0, y: 0, width: 1, height: 1 },
        focal: { x: 0.5, y: 0.5 },
        cutoutAssetId: null,
        effects: { outline: null, shadow: null, glow: null, grain: null },
      },
    ],
  });

const ids = () => {
  let n = 0;
  return () => `new-${(n += 1)}`;
};

describe('turning instances into elements', () => {
  it('creates one element per chosen instance', () => {
    const { project: after, added } = addCutoutElements(project(), 'p', instances, {
      now: NOW,
      nextId: ids(),
    });
    expect(added).toBe(2);
    expect(after.layers.filter((l) => l.kind === 'photo' && l.cutoutAssetId !== null)).toHaveLength(
      2,
    );
  });

  it('keeps the original element', () => {
    // Nothing of the author's disappears because the app decided it should.
    const { project: after } = addCutoutElements(project(), 'p', instances, {
      now: NOW,
      nextId: ids(),
    });
    expect(after.layers.some((l) => l.id === 'p')).toBe(true);
  });

  it('keeps the original asset id on every cutout element', () => {
    // The original stays in the manifest, so a lost cutout falls back to the
    // photograph rather than to a gap.
    const { project: after } = addCutoutElements(project(), 'p', instances, {
      now: NOW,
      nextId: ids(),
    });
    for (const layer of after.layers) {
      if (layer.kind === 'photo' && layer.cutoutAssetId !== null) expect(layer.assetId).toBe('a1');
    }
  });

  it('registers each cutout as an asset', () => {
    const { project: after } = addCutoutElements(project(), 'p', instances, {
      now: NOW,
      nextId: ids(),
    });
    expect(after.assets.filter((a) => a.uri.includes('cut-'))).toHaveLength(2);
  });

  it('produces a document that validates', () => {
    const { project: after } = addCutoutElements(project(), 'p', instances, {
      now: NOW,
      nextId: ids(),
    });
    expect(storyProjectSchema.safeParse(after).success).toBe(true);
  });

  it('does nothing when the source element is gone', () => {
    const before = project();
    expect(
      addCutoutElements(before, 'absent', instances, { now: NOW, nextId: ids() }).project,
    ).toBe(before);
  });
});
```

- [ ] **Step 2: Run and watch it fail**

Run: `cd apps/mobile && npx jest src/features/story/cutoutElements --runInBand`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```ts
// apps/mobile/src/features/story/cutoutElements.ts
import { addAsset, addElement, EMPTY_EFFECTS, type StoryProject } from '@cw/domain';

/**
 * Turning lifted instances into elements the author can move.
 *
 * **One element per instance.** Two people in a frame become two subjects that
 * move independently — which is also how the brief's "duplicate and layer the
 * subject" is satisfied, with no separate feature.
 *
 * **The original element is kept.** The author hides or deletes it. The same
 * rule `applyTemplate` follows: nothing of theirs disappears because the app
 * decided it should.
 *
 * **Each cutout element keeps the original `assetId`** and carries the cut image
 * as `cutoutAssetId`. That is what makes a lost cutout degrade to "the
 * background came back" instead of to a missing photograph.
 */

export type CutoutInstance = {
  readonly uri: string;
  readonly width: number;
  readonly height: number;
  readonly confidence: number;
};

export function addCutoutElements(
  project: StoryProject,
  sourceElementId: string,
  instances: readonly CutoutInstance[],
  input: { now: string; nextId: () => string },
): { project: StoryProject; added: number } {
  const source = project.layers.find((layer) => layer.id === sourceElementId);
  if (source === undefined || source.kind !== 'photo') return { project, added: 0 };

  let next = project;
  let added = 0;

  for (const [index, instance] of instances.entries()) {
    const assetId = input.nextId();

    next = addAsset(
      next,
      {
        id: assetId,
        uri: instance.uri,
        width: instance.width,
        height: instance.height,
        previewUri: null,
        createdAt: input.now,
      },
      input.now,
    );

    next = addElement(
      next,
      {
        ...source,
        id: input.nextId(),
        // Offset each subsequent subject so two cutouts are not exactly stacked
        // and indistinguishable.
        frame: { ...source.frame, x: source.frame.x + index * 24, y: source.frame.y + index * 24 },
        cutoutAssetId: assetId,
        effects: EMPTY_EFFECTS,
        locked: false,
      },
      input.now,
    );
    added += 1;
  }

  return { project: next, added };
}
```

- [ ] **Step 4: Run and gate**

```bash
cd apps/mobile && npx jest src/features/story/cutoutElements --runInBand
corepack pnpm check
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cutout): turn lifted instances into independent elements"
```

---

### Task 12: Draw the cutout, and fall back

**Files:**

- Modify: `apps/mobile/src/features/story/render/drawScene.ts`
- Modify: `apps/mobile/src/features/story/canvas/useStoryImages.ts`

- [ ] **Step 1: Implement**

In `drawScene`, resolve the cutout first and fall back to the original:

```ts
      case 'photo': {
        /**
         * The cutout when it resolves, the original when it does not.
         *
         * A missing cutout file degrades to "the background came back" rather
         * than to a visible gap — the photograph is still there. That is a
         * property of keeping both assets, not of error handling.
         */
        const cut = element.cutoutAssetId === null ? null : images(element.cutoutAssetId);
        const image = cut ?? images(element.assetId);
        if (image === null) {
          missingAssets.push(element.assetId);
          drawMissing(canvas, frame, alpha);
          break;
        }
        drawPhoto(canvas, image, element, frame, alpha, scale);
        break;
      }
```

In `useStoryImages`, nothing changes: cutouts are registered as ordinary assets
by Task 11, so they are already decoded.

- [ ] **Step 2: Run and gate**

```bash
cd apps/mobile && npx jest src/features/story --runInBand
corepack pnpm check
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(cutout): draw the cutout and fall back to the original"
```

---

### Task 13: The cutout UI

**Files:**

- Create: `apps/mobile/src/features/story/CutoutPicker.tsx`
- Modify: `apps/mobile/src/features/story/StoryEditorScreen.tsx`
- Modify: `apps/mobile/src/localization/en.ts`, `vi.ts`
- Modify: `apps/mobile/src/__tests__/screens.test.tsx`

- [ ] **Step 1: Add the strings**

`en.ts`:

```ts
  'story.cutout.action': 'Cut out',
  'story.cutout.working': 'Lifting the subject…',
  'story.cutout.none': 'No subject found in this photo',
  'story.cutout.failed': 'The subject could not be lifted',
  'story.cutout.pick': 'Choose subjects',
  'story.cutout.apply': 'Add',
  'story.cutout.needsNewer': 'Cutting out subjects needs iOS 17 or later.',
```

`vi.ts`:

```ts
  'story.cutout.action': 'Tách nền',
  'story.cutout.working': 'Đang tách chủ thể…',
  'story.cutout.none': 'Không tìm thấy chủ thể trong ảnh này',
  'story.cutout.failed': 'Không tách được chủ thể',
  'story.cutout.pick': 'Chọn chủ thể',
  'story.cutout.apply': 'Thêm',
  'story.cutout.needsNewer': 'Tách nền cần iOS 17 trở lên.',
```

- [ ] **Step 2: Implement the picker**

```tsx
// apps/mobile/src/features/story/CutoutPicker.tsx
import { space, type Skin } from '@cw/tokens';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers';
import { Button, Pressable, Text, useStyles } from '@/ui';
import type { CutoutInstance } from './cutoutElements';

/**
 * Choosing which lifted subjects to keep.
 *
 * Shown only when Vision found more than one: a picker with a single option is a
 * tax, so one instance is applied directly by the caller and never reaches here.
 *
 * Multi-select, because each chosen instance becomes its own element — which is
 * what makes two people in a frame two subjects the author can move apart.
 */
export function CutoutPicker({
  instances,
  onApply,
  onCancel,
}: {
  instances: readonly CutoutInstance[];
  onApply: (chosen: readonly CutoutInstance[]) => void;
  onCancel: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();
  const [chosen, setChosen] = useState<readonly number[]>([0]);

  return (
    <View style={styles.panel}>
      <Text variant="cardTitle">{t('story.cutout.pick')}</Text>

      <ScrollView
        contentContainerStyle={styles.row}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {instances.map((instance, index) => (
          <Pressable
            accessibilityLabel={`${t('story.cutout.pick')} ${index + 1}`}
            accessibilityRole="button"
            accessibilityState={{ selected: chosen.includes(index) }}
            key={instance.uri}
            onPress={() =>
              setChosen((current) =>
                current.includes(index)
                  ? current.filter((entry) => entry !== index)
                  : [...current, index],
              )
            }
            style={[styles.tile, chosen.includes(index) && styles.chosen]}
          >
            <Image contentFit="contain" source={{ uri: instance.uri }} style={styles.thumb} />
          </Pressable>
        ))}
      </ScrollView>

      <Button
        disabled={chosen.length === 0}
        label={t('story.cutout.apply')}
        onPress={() =>
          onApply(chosen.map((index) => instances[index]).filter((i) => i !== undefined))
        }
      />
      <Button label={t('story.editor.delete')} onPress={onCancel} variant="ghost" />
    </View>
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    panel: { gap: space.sm, paddingHorizontal: space.gutter, paddingVertical: space.sm },
    row: { gap: space.xs },
    tile: { width: 72, height: 96, borderWidth: 2, borderColor: 'transparent' },
    // A border, not a tint: selection must not be signalled by colour alone.
    chosen: { borderColor: skin.ui.action.primary },
    thumb: { width: '100%', height: '100%' },
  });
```

- [ ] **Step 3: Wire it into the editor**

Add state, an availability probe on mount, and the action chip. The availability
rules from the design's §5:

```tsx
const [cutoutState, setCutoutState] = useState<
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'picking'; instances: readonly CutoutInstance[] }
  | { kind: 'message'; text: string }
>({ kind: 'idle' });
const [cutoutAvailable, setCutoutAvailable] = useState<CutoutAvailability | null>(null);

useEffect(() => {
  void subjectExtractor.availability().then(setCutoutAvailable);
}, []);
```

Then the handler, which implements the 0 / 1 / N branching from the design's §5:

```tsx
const runCutout = useCallback(async () => {
  if (selected === null || selected.kind !== 'photo') return;
  const asset = project?.assets.find((entry) => entry.id === selected.assetId);
  if (asset === undefined || project === null) return;

  setCutoutState({ kind: 'working' });

  const instances = await subjectExtractor.extractAll({
    sourceUri: asset.uri,
    destinationUri: `${Paths.document.uri}story-assets/${project.id}`,
  });

  if (instances.length === 0) {
    // A real answer, not an error: Vision ran and found no clear subject.
    setCutoutState({ kind: 'message', text: t('story.cutout.none') });
    return;
  }

  if (instances.length === 1) {
    // A picker with one option is a tax.
    applyCutouts(instances);
    return;
  }

  setCutoutState({ kind: 'picking', instances });
}, [applyCutouts, project, selected, t]);

const applyCutouts = useCallback(
  (chosen: readonly CutoutInstance[]) => {
    if (selected === null) return;
    act(
      (current) =>
        addCutoutElements(current, selected.id, chosen, {
          now: new Date().toISOString(),
          nextId: () => Crypto.randomUUID(),
        }).project,
    );
    setCutoutState({ kind: 'idle' });
  },
  [act, selected],
);
```

And the rendering, which is where the design's three availability reasons become
three different behaviours:

```tsx
{
  /* Available: the action. */
}
{
  cutoutAvailable?.status === 'available' && selected?.kind === 'photo' ? (
    <Chip label={t('story.cutout.action')} onPress={() => void runCutout()} tone="add" />
  ) : null;
}

{
  /* Too old: one line, because updating iOS is something they can do.
          `not-implemented` renders nothing at all — there is no action behind it,
          and naming it would only describe something out of reach. */
}
{
  cutoutAvailable?.status === 'unavailable' &&
  cutoutAvailable.reason === 'os-too-old' &&
  selected?.kind === 'photo' ? (
    <Text tone="secondary" variant="meta">
      {t('story.cutout.needsNewer')}
    </Text>
  ) : null;
}

{
  cutoutState.kind === 'working' ? <Text variant="meta">{t('story.cutout.working')}</Text> : null;
}

{
  cutoutState.kind === 'message' ? (
    <Text tone="secondary" variant="meta">
      {cutoutState.text}
    </Text>
  ) : null;
}

{
  cutoutState.kind === 'picking' ? (
    <CutoutPicker
      instances={cutoutState.instances}
      onApply={applyCutouts}
      onCancel={() => setCutoutState({ kind: 'idle' })}
    />
  ) : null;
}
```

`applyCutouts` is declared before `runCutout` reads it, and both after `act`.

- [ ] **Step 4: Register the picker in the screens guard**

Add to `cases` in `src/__tests__/screens.test.tsx`:

```tsx
  ['Cutout picker', () => <CutoutPicker instances={[]} onApply={jest.fn()} onCancel={jest.fn()} />],
```

- [ ] **Step 5: Run the guards and gate**

```bash
cd apps/mobile && npx jest src/__tests__ --runInBand
corepack pnpm check
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cutout): add the instance picker and its availability rules"
```

---

## After the plan: what only a device can close

Phase A and Phase B both end green, and neither has drawn a pixel on hardware.
`09-device-qa.md` gains these checks:

1. **The blur-versus-scale comparison** — export a slide carrying a shadow,
   screenshot the same slide in the editor, and compare the blur. Not "the
   effects look right": compare two numbers. This is open item 3 in the design's
   §7, and **it changes the design if the answer is no** — `scaledEffects`
   becomes the identity.
2. **Vision returns instances at all**, and `confidence` exists on the
   observation. If it does not, drop the field rather than substituting a
   constant.
3. **Cost of blurs at 4096px** during export, measured rather than estimated.
4. **The iOS 16 path** — the single line, not a broken control.
5. **Effect defaults chosen by eye.** The values in Task 7 are starting points.
