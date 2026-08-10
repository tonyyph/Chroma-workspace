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
