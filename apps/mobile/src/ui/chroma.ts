import { brandBands } from '@chromawave/design-tokens';
import { clampOklch, hexToRgb, type Color } from '@chromawave/domain';
import { Easing, makeMutable, withTiming } from 'react-native-reanimated';

/**
 * The colour the app is currently wearing.
 *
 * Chroma Wave measures colour for a living and, until this existed, looked
 * exactly the same whatever it had measured: a terracotta wall and a chlorine
 * pool produced identical chrome, and the ambient field behind every screen
 * drifted in the same three brand colours for ever. An app about colour that is
 * not itself affected by colour is leaving its whole subject on the table.
 *
 * So the field takes its bands from whatever palette is in front of the user.
 * Opening a palette changes the light in the room; going back changes it back.
 *
 * **One animated value, not nine.** Springing three RGB triples would be nine
 * shared values evaluated per frame. Instead the two endpoints are plain values
 * written from JS and a single progress is animated, with the interpolation
 * happening inside the driver's existing per-frame worklet — which was already
 * running and already building this object.
 */

export type Bands = readonly [Triple, Triple, Triple];
type Triple = readonly [number, number, number];

const triple = (hex: string): Triple => {
  const { red, green, blue } = hexToRgb(hex);
  return [red / 255, green / 255, blue / 255];
};

/**
 * What the field can actually render.
 *
 * The shader adds its masses and normalises, so a near-black band contributes
 * nothing and the field goes flat, while a fully saturated one blows out where
 * two masses meet. Both ends are clamped in OKLCh — holding hue, which is the
 * part that has to survive, since the whole point is that the field is *this*
 * palette and not some other one.
 */
const BAND_LIGHTNESS = [0.42, 0.78] as const;
const BAND_CHROMA = [0.06, 0.22] as const;

export const BRAND: Bands = [
  triple(brandBands[0] ?? '#7C5CFF'),
  triple(brandBands[1] ?? '#22D3EE'),
  triple(brandBands[2] ?? '#FF7A5C'),
];

/**
 * The three bands a palette contributes.
 *
 * Roled colours first, because dominant/support/signal is the composition the
 * extractor found; a palette that never got named roles falls back to its first
 * three by weight. Fewer than three colours repeat rather than leaving a mass
 * black — an unlit mass is a hole in the field, not a subtler field.
 */
export function bandsFor(colors: readonly Color[]): Bands {
  if (colors.length === 0) return BRAND;
  const ordered = (['dominant', 'support', 'signal'] as const)
    .map((role) => colors.find((color) => color.role === role))
    .filter((color): color is Color => color !== undefined);
  const source = ordered.length === 3 ? ordered : colors;

  const pick = (index: number) => {
    const color = source[index % source.length] ?? source[0];
    return triple(
      clampOklch(color?.hex ?? (brandBands[0] as string), {
        lightness: BAND_LIGHTNESS,
        chroma: BAND_CHROMA,
      }),
    );
  };
  return [pick(0), pick(1), pick(2)];
}

export const chromaFrom = makeMutable<Bands>(BRAND);
export const chromaTo = makeMutable<Bands>(BRAND);
/** 0 at the start of a change, 1 when the field has fully become `chromaTo`. */
export const chromaMix = makeMutable(1);

/**
 * Long enough to read as the room changing rather than a cut, short enough that
 * a back-swipe does not leave the field still arriving.
 */
const CHROMA_MS = 620;

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

const lerpTriple = (from: Triple, to: Triple, t: number): Triple => {
  'worklet';
  return [lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)];
};

/** The bands as they are on screen this instant, wherever the animation is. */
export function currentBands(): Bands {
  const from = chromaFrom.value;
  const to = chromaTo.value;
  const t = chromaMix.value;
  return [
    lerpTriple(from[0], to[0], t),
    lerpTriple(from[1], to[1], t),
    lerpTriple(from[2], to[2], t),
  ];
}

/**
 * Moves the field to a new set of bands.
 *
 * Starts from wherever the last change got to rather than from its target, so
 * interrupting one — swiping quickly between palettes — bends the transition
 * instead of snapping to the previous destination first.
 */
export function adoptChroma(bands: Bands, animate = true): void {
  chromaFrom.value = currentBands();
  chromaTo.value = bands;
  chromaMix.value = 0;
  chromaMix.value = animate
    ? withTiming(1, { duration: CHROMA_MS, easing: Easing.inOut(Easing.cubic) })
    : 1;
}

/** Back to the brand's own three. */
export function releaseChroma(animate = true): void {
  adoptChroma(BRAND, animate);
}

/** Reads the interpolated bands inside the driver's frame worklet. */
export function bandsAt(t: number, from: Bands, to: Bands): Bands {
  'worklet';
  return [
    lerpTriple(from[0], to[0], t),
    lerpTriple(from[1], to[1], t),
    lerpTriple(from[2], to[2], t),
  ];
}

/**
 * A container recipe built from one colour, shaped like the `tint.*` tokens.
 *
 * The tokens are fixed recipes for fixed meanings — pro is violet, info is
 * cyan, danger is coral. This is the same shape for a colour that is not known
 * until the user photographs it, so a screen can tint a control from its own
 * subject without inventing a second way of describing a filled pill.
 */
export function accentTint(accent: string): {
  backgroundColor: string;
  borderColor: string;
  color: string;
} {
  const { red, green, blue } = hexToRgb(accent);
  const rgba = (alpha: number) => `rgba(${red},${green},${blue},${alpha})`;
  return { backgroundColor: rgba(0.14), borderColor: rgba(0.34), color: accent };
}
