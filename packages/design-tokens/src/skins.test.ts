import { describe, expect, it } from 'vitest';

import { skinIds, skins, type Skin } from './skins';

/**
 * A second skin only works if it is *complete*. TypeScript enforces the shape,
 * but not that a value was thought about — a swiss skin that quietly inherited
 * chroma's violet somewhere would typecheck and look broken.
 */
const entries = skinIds.map((id) => [id, skins[id]] as const);

/** Every leaf string and number under a token object, flattened. */
function leaves(value: unknown, path = ''): [string, string | number][] {
  if (typeof value === 'string' || typeof value === 'number') return [[path, value]];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) =>
    leaves(child, path ? `${path}.${key}` : key),
  );
}

const tokensOf = (skin: Skin) =>
  leaves({ ui: skin.ui, tint: skin.tint, round: skin.round, type: skin.type });

const WEIGHTS = ['soft', 'medium', 'strong', 'full'] as const;

/** Every gradient a skin can be asked for, flattened to its stop colours. */
const everyEffect = (skin: Skin): string[] => [
  ...WEIGHTS.flatMap((w) => [
    ...skin.effects.scrimBottom(w).colors,
    ...skin.effects.scrimTop(w).colors,
  ]),
  ...skin.effects.fadeToGround.colors,
  ...skin.effects.screenWash.colors,
  ...skin.effects.surfaceWash.colors,
];

/** Chroma's ground and its violet, in the forms a stop can be written in. */
const CHROMA_DARK = /rgba\(\s*8,\s*7,\s*14|rgba\(\s*18,\s*17,\s*25|#0C0B18|#08070E/i;
const CHROMA_VIOLET = /rgba\(\s*124,\s*92,\s*255|#7C5CFF|#241C4A|#2A2352/i;

describe('skins', () => {
  it.each(entries)('%s declares every token the shape requires', (_id, skin) => {
    expect(tokensOf(skin).length).toBeGreaterThan(60);
    expect(tokensOf(skin).every(([, value]) => value !== undefined)).toBe(true);
  });

  it('gives both skins exactly the same token paths', () => {
    const [chroma, swiss] = [skins.chroma, skins.swiss].map((skin) =>
      tokensOf(skin)
        .map(([path]) => path)
        .sort(),
    );
    expect(swiss).toEqual(chroma);
  });

  /** The reason the architecture exists: these are not the same look. */
  it('shares no ground, ink or accent between the two', () => {
    expect(skins.swiss.ui.bg.base).not.toBe(skins.chroma.ui.bg.base);
    expect(skins.swiss.ui.text.primary).not.toBe(skins.chroma.ui.text.primary);
    expect(skins.swiss.ui.action.primary).not.toBe(skins.chroma.ui.action.primary);
  });

  it('leaves swiss square everywhere except where a circle is meant', () => {
    const { full, iconTileRatio, ...corners } = skins.swiss.round;
    expect(Object.values(corners).every((value) => value === 0)).toBe(true);
    expect(full).toBeGreaterThan(0);
    expect(iconTileRatio).toBe(0);
  });

  it('gives swiss no depth at all, since its structure is rules', () => {
    for (const level of ['flat', 'raised', 'floating'] as const) {
      expect(skins.swiss.elevation[level].shadowOpacity).toBe(0);
      expect(skins.swiss.elevation[level].highlightColor).toBe('transparent');
    }
    expect(Object.values(skins.swiss.shadow).every((entry) => entry.shadowOpacity === 0)).toBe(
      true,
    );
    expect(skins.swiss.chrome.depth).toBe(false);
    expect(skins.swiss.chrome.glass).toBe(false);
    expect(skins.swiss.chrome.backdrop).toBe(false);
  });

  it('keeps chroma exactly as it was, so the default look cannot drift', () => {
    expect(skins.chroma.ui.bg.base).toBe('#08070E');
    expect(skins.chroma.ui.action.primary).toBe('#7C5CFF');
    expect(skins.chroma.chrome.backdrop).toBe(true);
  });
});

describe('skin effects', () => {
  it.each(entries)('%s answers every role', (_id, skin) => {
    for (const weight of WEIGHTS) {
      expect(skin.effects.scrimBottom(weight).colors.length).toBeGreaterThanOrEqual(2);
      expect(skin.effects.scrimTop(weight).colors.length).toBeGreaterThanOrEqual(2);
    }
    for (const role of [
      skin.effects.fadeToGround,
      skin.effects.screenWash,
      skin.effects.surfaceWash,
    ]) {
      expect(role.colors.length).toBeGreaterThanOrEqual(2);
    }
  });

  it.each(entries)('%s keeps stops and locations the same length', (_id, skin) => {
    const roles = [
      ...WEIGHTS.map((w) => skin.effects.scrimBottom(w)),
      ...WEIGHTS.map((w) => skin.effects.scrimTop(w)),
      skin.effects.fadeToGround,
      skin.effects.screenWash,
      skin.effects.surfaceWash,
    ];
    // Mismatched arrays are the one way to make LinearGradient render nothing.
    for (const role of roles) {
      if (role.locations) expect(role.locations.length).toBe(role.colors.length);
    }
  });

  it.each(entries)(
    '%s reads a scrim from the head the same way it reads one from the foot',
    (_id, skin) => {
      for (const weight of WEIGHTS) {
        expect([...skin.effects.scrimTop(weight).colors]).toEqual(
          [...skin.effects.scrimBottom(weight).colors].reverse(),
        );
      }
    },
  );

  /** The whole point of the contract: swiss must not inherit a dark premise. */
  it('gives swiss no chroma ground and no violet anywhere in its effects', () => {
    for (const stop of everyEffect(skins.swiss)) {
      expect(stop).not.toMatch(CHROMA_DARK);
      expect(stop).not.toMatch(CHROMA_VIOLET);
    }
  });

  it('leaves swiss with a flat screen wash, because it does not do washes', () => {
    const wash = skins.swiss.effects.screenWash;
    expect(new Set(wash.colors).size).toBe(1);
  });

  it('pins chroma effects, so the default look cannot drift', () => {
    expect(skins.chroma.effects.scrimBottom('medium').colors).toEqual([
      'rgba(8,7,14,0)',
      'rgba(8,7,14,.78)',
    ]);
    expect(skins.chroma.effects.screenWash.colors[0]).toBe('#241C4A');
  });

  it('gives each skin three accents of its own', () => {
    expect(skins.chroma.accents).toHaveLength(3);
    expect(skins.swiss.accents).toHaveLength(3);
    for (const accent of skins.swiss.accents) {
      expect(accent).not.toMatch(CHROMA_VIOLET);
    }
  });
});
