import { describe, expect, it } from 'vitest';

import { storyElementSchema } from './elements';
import {
  elementEffectsSchema,
  EMPTY_EFFECTS,
  hasEffects,
  MAX_GLOW_RADIUS,
  MAX_OUTLINE_WIDTH,
  paperCut,
  scaledEffects,
  type ElementEffects,
} from './effects';

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
    expect(
      elementEffectsSchema.safeParse({ ...EMPTY_EFFECTS, grain: { amount: 1.5, seed: 1 } }).success,
    ).toBe(false);
  });

  it('requires an integer grain seed, so a render is reproducible', () => {
    expect(
      elementEffectsSchema.safeParse({ ...EMPTY_EFFECTS, grain: { amount: 0.5, seed: 1.5 } })
        .success,
    ).toBe(false);
  });

  it('accepts a fully configured set', () => {
    const full = {
      outline: { width: 10, colorHex: '#FFFFFF' },
      shadow: { dx: 4, dy: 6, blur: 12, colorHex: '#000000' },
      glow: { radius: 30, colorHex: '#7C5CFF' },
      grain: { amount: 0.3, seed: 42 },
    };
    expect(elementEffectsSchema.safeParse(full).success).toBe(true);
  });
});

describe('hasEffects', () => {
  it('is false for nothing switched on, so the renderer can skip the work', () => {
    expect(hasEffects(EMPTY_EFFECTS)).toBe(false);
  });

  it('is true when any one is set', () => {
    expect(hasEffects({ ...EMPTY_EFFECTS, grain: { amount: 0.1, seed: 1 } })).toBe(true);
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

  it('produces something the schema accepts', () => {
    expect(elementEffectsSchema.safeParse(paperCut('#EDEAE3')).success).toBe(true);
  });

  it('takes its colour from the caller rather than owning one', () => {
    // Two skins, two grounds. A literal here would be the appearance leak.
    expect(paperCut('#101010').outline?.colorHex).toBe('#101010');
  });
});

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
    expect(half.shadow?.dy).toBe(-5);
    expect(half.shadow?.blur).toBe(4);
    expect(half.glow?.radius).toBe(20);
  });

  it('leaves grain alone, because it is a ratio and a seed, not a length', () => {
    expect(scaledEffects(full, 0.5).grain).toEqual(full.grain);
  });

  it('keeps colours untouched', () => {
    expect(scaledEffects(full, 0.25).outline?.colorHex).toBe('#FFFFFF');
    expect(scaledEffects(full, 0.25).shadow?.colorHex).toBe('#000000');
  });

  it('passes nulls through', () => {
    expect(scaledEffects(EMPTY_EFFECTS, 0.5)).toEqual(EMPTY_EFFECTS);
  });
});

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
      effects: { ...EMPTY_EFFECTS, glow: { radius: MAX_GLOW_RADIUS + 1, colorHex: '#FFFFFF' } },
    });
    expect(storyElementSchema.safeParse(over).success).toBe(false);
  });
});
