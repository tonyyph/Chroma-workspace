import { DomainError } from './errors';
import type { Color, ColorRole } from './palette';
import { withExactWeights } from './weights';

/** An extracted cluster before it is narrowed to the shipped swatch shape. */
type ExtractedColor = Readonly<{
  hex: string;
  weight: number;
  lightness: number;
  chroma: number;
  hue: number;
}>;

export type ExtractionResult = Readonly<{
  colors: readonly Color[];
  /** Mean perceptual spread of the clusters. B2 reports this as "ΔE 2.4". */
  deltaE: number;
  /** 0-1. B2 reports this as "CONF 94%". */
  confidence: number;
}>;

type Rgb = Readonly<{ red: number; green: number; blue: number }>;
type Oklab = Readonly<{ lightness: number; a: number; b: number }>;
type Pixel = Readonly<{ rgb: Rgb; lab: Oklab }>;

const clamp = (value: number, minimum = 0, maximum = 1): number =>
  Math.min(maximum, Math.max(minimum, value));

const srgbToLinear = (value: number): number => {
  const normalized = clamp(value / 255);
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

export const rgbToOklab = ({ red, green, blue }: Rgb): Oklab => {
  const r = srgbToLinear(red);
  const g = srgbToLinear(green);
  const b = srgbToLinear(blue);

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const lRoot = Math.cbrt(l);
  const mRoot = Math.cbrt(m);
  const sRoot = Math.cbrt(s);

  return {
    lightness: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  };
};

export const rgbToHex = ({ red, green, blue }: Rgb): string =>
  `#${[red, green, blue]
    .map((channel) =>
      Math.round(clamp(channel, 0, 255))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;

const oklabDistanceSquared = (left: Oklab, right: Oklab): number =>
  (left.lightness - right.lightness) ** 2 + (left.a - right.a) ** 2 + (left.b - right.b) ** 2;

const hueForLab = (lab: Oklab): number => {
  const degrees = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  return degrees < 0 ? degrees + 360 : degrees;
};

const circularHueDistance = (left: number, right: number): number => {
  const distance = Math.abs(left - right);
  return Math.min(distance, 360 - distance);
};

const temperatureForHue = (hue: number): number => {
  const warmDistance = Math.min(circularHueDistance(hue, 45), circularHueDistance(hue, 15));
  const coolDistance = circularHueDistance(hue, 230);
  const total = warmDistance + coolDistance;
  return total === 0 ? 0 : clamp((coolDistance - warmDistance) / total, -1, 1);
};

const makeInitialCentroids = (pixels: readonly Pixel[], count: number): Oklab[] => {
  const ordered = [...pixels].sort((left, right) => {
    const lightnessDelta = left.lab.lightness - right.lab.lightness;
    return Math.abs(lightnessDelta) > 0.04
      ? lightnessDelta
      : hueForLab(left.lab) - hueForLab(right.lab);
  });

  return Array.from({ length: count }, (_, index) => {
    const position = Math.min(
      ordered.length - 1,
      Math.floor(((index + 0.5) / count) * ordered.length),
    );
    return ordered[position]?.lab ?? ordered[0]!.lab;
  });
};

const normalizePixels = (
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): Pixel[] => {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    throw new DomainError('INVALID_IMAGE', 'Image pixels do not match the supplied dimensions.');
  }

  const maximumSamples = 4096;
  const step = Math.max(1, Math.floor((width * height) / maximumSamples));
  const pixels: Pixel[] = [];

  for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += step) {
    const offset = pixelIndex * 4;
    const alpha = rgba[offset + 3] ?? 0;
    if (alpha < 200) continue;

    const rgb = {
      red: rgba[offset] ?? 0,
      green: rgba[offset + 1] ?? 0,
      blue: rgba[offset + 2] ?? 0,
    };
    pixels.push({ rgb, lab: rgbToOklab(rgb) });
  }

  if (pixels.length === 0) {
    throw new DomainError('INVALID_IMAGE', 'Image contains no visible pixels.');
  }

  return pixels;
};

export const extractPaletteFromRgba = (
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  requestedColorCount = 5,
): ExtractionResult => {
  const pixels = normalizePixels(rgba, width, height);
  const clusterCount = Math.min(Math.max(1, requestedColorCount), 6, pixels.length);
  let centroids = makeInitialCentroids(pixels, clusterCount);
  let assignments = new Uint8Array(pixels.length);

  for (let iteration = 0; iteration < 14; iteration += 1) {
    const totals = Array.from({ length: clusterCount }, () => ({
      lightness: 0,
      a: 0,
      b: 0,
      red: 0,
      green: 0,
      blue: 0,
      count: 0,
    }));
    let changed = false;

    pixels.forEach((pixel, pixelIndex) => {
      let bestCluster = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid, centroidIndex) => {
        const distance = oklabDistanceSquared(pixel.lab, centroid);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestCluster = centroidIndex;
        }
      });

      if (assignments[pixelIndex] !== bestCluster) changed = true;
      assignments[pixelIndex] = bestCluster;
      const total = totals[bestCluster]!;
      total.lightness += pixel.lab.lightness;
      total.a += pixel.lab.a;
      total.b += pixel.lab.b;
      total.red += pixel.rgb.red;
      total.green += pixel.rgb.green;
      total.blue += pixel.rgb.blue;
      total.count += 1;
    });

    centroids = centroids.map((centroid, index) => {
      const total = totals[index]!;
      return total.count === 0
        ? centroid
        : {
            lightness: total.lightness / total.count,
            a: total.a / total.count,
            b: total.b / total.count,
          };
    });
    if (!changed && iteration > 0) break;
  }

  const clusters = Array.from({ length: clusterCount }, () => ({
    red: 0,
    green: 0,
    blue: 0,
    count: 0,
  }));
  // BUILD KIT · section 8: "Extract in linear light, not sRGB-encoded values —
  // averaging gamma-encoded pixels shifts every result muddy." Channels are
  // linearised before accumulation and re-encoded once, after the mean.
  pixels.forEach((pixel, index) => {
    const cluster = clusters[assignments[index] ?? 0]!;
    cluster.red += srgbToLinear(pixel.rgb.red);
    cluster.green += srgbToLinear(pixel.rgb.green);
    cluster.blue += srgbToLinear(pixel.rgb.blue);
    cluster.count += 1;
  });

  const colors: ExtractedColor[] = clusters
    .map((cluster) => {
      if (cluster.count === 0) return null;
      const rgb = {
        red: linearToSrgb(cluster.red / cluster.count),
        green: linearToSrgb(cluster.green / cluster.count),
        blue: linearToSrgb(cluster.blue / cluster.count),
      };
      const lab = rgbToOklab(rgb);
      return {
        hex: rgbToHex(rgb),
        weight: cluster.count / pixels.length,
        lightness: clamp(lab.lightness),
        chroma: clamp(Math.hypot(lab.a, lab.b), 0, 0.5),
        hue: hueForLab(lab),
      };
    })
    .filter((color): color is ExtractedColor => color !== null)
    .sort((left, right) => right.weight - left.weight);

  // FLOW A3 names the three roles in share order, and the document's own
  // reference palette ("Harbour dusk": 38 / 24 / 18%) assigns them that way, so
  // role follows weight rather than a separate salience score.
  const roles: readonly ColorRole[] = ['dominant', 'support', 'signal'];
  // Built here rather than through `palette.makeColor`: importing a value from
  // `palette` would form a require cycle, since `palette` needs this module's
  // colour conversions. `makeColor` derives exactly these fields the same way.
  const swatches: Color[] = colors.map((color, index) => {
    const rgb = hexToRgb(color.hex);
    const oklch = rgbToOklch(rgb);
    return {
      hex: color.hex,
      rgb,
      oklch: {
        lightness: clamp(oklch.lightness),
        chroma: Math.min(0.5, Math.max(0, oklch.chroma)),
        hue: oklch.hue,
      },
      role: roles[index] ?? 'extra',
      weight: color.weight,
      locked: false,
    };
  });

  const rounded = withExactWeights(swatches);

  // BUILD KIT · section 8: "Report ΔE00, never ΔE76." The read's stability is the
  // mean perceptual distance from each sampled pixel to the colour it was folded
  // into — B2 renders this as "ΔE 2.4 · STABLE". Cluster labs are computed once;
  // the per-pixel conversion is the only real cost and `normalizePixels` has
  // already capped the sample.
  const clusterLabs = colors.map((color) => rgbToLab(hexToRgb(color.hex)));
  const clusterIndexByOriginal = new Map<number, number>();
  clusters.forEach((cluster, index) => {
    if (cluster.count > 0) clusterIndexByOriginal.set(index, clusterIndexByOriginal.size);
  });

  let distanceTotal = 0;
  pixels.forEach((pixel, index) => {
    const lab = clusterLabs[clusterIndexByOriginal.get(assignments[index] ?? 0) ?? 0];
    if (!lab) return;
    distanceTotal += deltaE00(rgbToLab(pixel.rgb), lab);
  });
  const deltaE = Math.round((distanceTotal / Math.max(1, pixels.length)) * 10) / 10;

  // Confidence falls away as the read drifts. ΔE00 of 10 is an unmistakable
  // difference, so a read that far from its own clusters carries no confidence.
  const confidence = clamp(1 - deltaE / 10);

  return { colors: rounded, deltaE, confidence };
};

export const relativeLuminance = (hex: string): number => {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new DomainError('INVALID_IMAGE', `Invalid hex color: ${hex}`);
  }
  const channels = [1, 3, 5].map((start) =>
    srgbToLinear(Number.parseInt(hex.slice(start, start + 2), 16)),
  );
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
};

export const contrastRatio = (foreground: string, background: string): number => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
};

export const safeForegroundFor = (background: string): '#09090B' | '#FFFFFF' =>
  contrastRatio('#09090B', background) >= contrastRatio('#FFFFFF', background)
    ? '#09090B'
    : '#FFFFFF';

/* --------------------------------------------------- BUILD KIT · section 8 */

/** Inverse of `srgbToLinear`, for returning an averaged linear colour to 8-bit sRGB. */
const linearToSrgb = (value: number): number => {
  const v = clamp(value);
  const encoded = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return encoded * 255;
};

export type Oklch = Readonly<{ lightness: number; chroma: number; hue: number }>;
export type Lab = Readonly<{ lightness: number; a: number; b: number }>;

/** Cylindrical form of OKLab. The kit's `Color` carries `oklch`. */
export const oklabToOklch = ({ lightness, a, b }: Oklab): Oklch => ({
  lightness,
  chroma: Math.hypot(a, b),
  hue: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
});

export const rgbToOklch = (rgb: Rgb): Oklch => oklabToOklch(rgbToOklab(rgb));

/* --------------------------------------------------- the way back out again */

/**
 * OKLab → linear sRGB, unclamped, so the caller can tell in-gamut from out.
 *
 * Everything above this line could turn a colour into a perceptual number;
 * nothing could turn a perceptual number back into a colour, so any code that
 * wanted to *adjust* a colour rather than measure one had to fall back to HSL —
 * which moves hue as it moves lightness.
 */
const oklabToLinear = ({ lightness, a, b }: Oklab): [number, number, number] => {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
};

const EPSILON = 1e-4;
const inGamut = ([red, green, blue]: [number, number, number]): boolean =>
  red >= -EPSILON &&
  red <= 1 + EPSILON &&
  green >= -EPSILON &&
  green <= 1 + EPSILON &&
  blue >= -EPSILON &&
  blue <= 1 + EPSILON;

export const oklabToRgb = (oklab: Oklab): Rgb => {
  const [red, green, blue] = oklabToLinear(oklab);
  return { red: linearToSrgb(red), green: linearToSrgb(green), blue: linearToSrgb(blue) };
};

export const oklchToOklab = ({ lightness, chroma, hue }: Oklch): Oklab => {
  const radians = (hue * Math.PI) / 180;
  return { lightness, a: chroma * Math.cos(radians), b: chroma * Math.sin(radians) };
};

/**
 * OKLCh → sRGB, gamut-mapped by reducing chroma.
 *
 * A colour outside sRGB has to be brought back somehow, and clamping each
 * channel independently is the tempting way — it is also the wrong one, because
 * clipping one channel and not the others rotates the hue. Lightening a
 * saturated violet by a couple of steps is enough to do it, and the result
 * arrives blue.
 *
 * Holding lightness and hue and binary-searching chroma down keeps the colour
 * recognisably the same colour, only less saturated — which is the trade every
 * colour-managed pipeline makes, and the one a user would make by eye.
 */
export const oklchToHex = (oklch: Oklch): string => {
  const oklab = oklchToOklab(oklch);
  if (inGamut(oklabToLinear(oklab))) return rgbToHex(oklabToRgb(oklab));

  let reachable = 0;
  let unreachable = oklch.chroma;
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const chroma = (reachable + unreachable) / 2;
    if (inGamut(oklabToLinear(oklchToOklab({ ...oklch, chroma })))) reachable = chroma;
    else unreachable = chroma;
  }
  return rgbToHex(oklabToRgb(oklchToOklab({ ...oklch, chroma: reachable })));
};

/** Holds a colour inside a lightness and chroma range, keeping its hue. */
export const clampOklch = (
  hex: string,
  bounds: { lightness?: readonly [number, number]; chroma?: readonly [number, number] },
): string => {
  const oklch = rgbToOklch(hexToRgb(hex));
  const [lowLightness, highLightness] = bounds.lightness ?? [0, 1];
  const [lowChroma, highChroma] = bounds.chroma ?? [0, 0.5];
  return oklchToHex({
    lightness: clamp(oklch.lightness, lowLightness, highLightness),
    chroma: clamp(oklch.chroma, lowChroma, highChroma),
    hue: oklch.hue,
  });
};

/**
 * The nearest version of a colour that can legally carry text on `background`.
 *
 * Moves lightness only, away from the ground — so an accent taken from the
 * user's own palette keeps its hue and its saturation and merely becomes
 * readable. This is what lets a screen tint itself from its content without
 * ever producing something nobody can read.
 *
 * Falls back to plain black or white in the case no amount of lightness will
 * do it, which is a colour so close to the ground's own hue that only the
 * extremes clear the ratio.
 */
export const readableOn = (hex: string, background: string, minRatio = 4.5): string => {
  if (contrastRatio(hex, background) >= minRatio) return hex.toUpperCase();

  const base = rgbToOklch(hexToRgb(hex));
  const direction = relativeLuminance(background) < 0.5 ? 1 : -1;

  for (let step = 1; step <= 64; step += 1) {
    const lightness = base.lightness + direction * step * 0.015;
    if (lightness <= 0 || lightness >= 1) break;
    const candidate = oklchToHex({ ...base, lightness });
    if (contrastRatio(candidate, background) >= minRatio) return candidate;
  }
  return safeForegroundFor(background);
};

/**
 * CIELAB (D65). Distinct from OKLab: clustering happens in OKLab because it is
 * perceptually uniform for interpolation, but ΔE00 is *defined* on CIELAB, so
 * reporting a distance requires this conversion rather than reusing the other.
 */
export const rgbToLab = ({ red, green, blue }: Rgb): Lab => {
  const r = srgbToLinear(red);
  const g = srgbToLinear(green);
  const b = srgbToLinear(blue);

  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;

  const epsilon = (6 / 29) ** 3;
  const f = (t: number) => (t > epsilon ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29);

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return { lightness: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
};

/**
 * CIEDE2000. The kit is explicit — "Report ΔE00, never ΔE76" — because the
 * plain Euclidean distance overstates differences in saturated blues and
 * understates them in near-neutrals, which is where palettes actually live.
 *
 * Implements CIE 142-2001 with the standard kL = kC = kH = 1.
 */
export const deltaE00 = (first: Lab, second: Lab): number => {
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;

  const c1 = Math.hypot(first.a, first.b);
  const c2 = Math.hypot(second.a, second.b);
  const cBar = (c1 + c2) / 2;

  // G expands the a* axis for low-chroma pairs, the correction ΔE76 lacks.
  const g = 0.5 * (1 - Math.sqrt(cBar ** 7 / (cBar ** 7 + 25 ** 7)));
  const a1 = (1 + g) * first.a;
  const a2 = (1 + g) * second.a;

  const c1p = Math.hypot(a1, first.b);
  const c2p = Math.hypot(a2, second.b);

  const hp = (a: number, b: number) =>
    a === 0 && b === 0 ? 0 : (Math.atan2(b, a) * deg + 360) % 360;
  const h1p = hp(a1, first.b);
  const h2p = hp(a2, second.b);

  const dL = second.lightness - first.lightness;
  const dC = c2p - c1p;

  let dhp = 0;
  if (c1p * c2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dH = 2 * Math.sqrt(c1p * c2p) * Math.sin((dhp * rad) / 2);

  const lBar = (first.lightness + second.lightness) / 2;
  const cBarP = (c1p + c2p) / 2;

  let hBarP: number;
  if (c1p * c2p === 0) hBarP = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hBarP = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hBarP = (h1p + h2p + 360) / 2;
  else hBarP = (h1p + h2p - 360) / 2;

  const t =
    1 -
    0.17 * Math.cos((hBarP - 30) * rad) +
    0.24 * Math.cos(2 * hBarP * rad) +
    0.32 * Math.cos((3 * hBarP + 6) * rad) -
    0.2 * Math.cos((4 * hBarP - 63) * rad);

  const dTheta = 30 * Math.exp(-(((hBarP - 275) / 25) ** 2));
  const rc = 2 * Math.sqrt(cBarP ** 7 / (cBarP ** 7 + 25 ** 7));
  const sl = 1 + (0.015 * (lBar - 50) ** 2) / Math.sqrt(20 + (lBar - 50) ** 2);
  const sc = 1 + 0.045 * cBarP;
  const sh = 1 + 0.015 * cBarP * t;
  const rt = -Math.sin(2 * dTheta * rad) * rc;

  return Math.sqrt((dL / sl) ** 2 + (dC / sc) ** 2 + (dH / sh) ** 2 + rt * (dC / sc) * (dH / sh));
};

/** ΔE00 between two hex colours. */
export const hexDeltaE00 = (first: string, second: string): number =>
  deltaE00(rgbToLab(hexToRgb(first)), rgbToLab(hexToRgb(second)));

export const hexToRgb = (hex: string): Rgb => {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return { red: (value >> 16) & 255, green: (value >> 8) & 255, blue: value & 255 };
};

/**
 * The same colour expressed in Display P3. The kit requires storing both and
 * tagging exports; P3 has a wider gamut, so an sRGB colour is always
 * representable and the components come back in range.
 */
export const rgbToDisplayP3 = ({ red, green, blue }: Rgb): Rgb => {
  const r = srgbToLinear(red);
  const g = srgbToLinear(green);
  const b = srgbToLinear(blue);

  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;

  return {
    red: linearToSrgb(2.4934969119 * x - 0.9313836179 * y - 0.4027107845 * z),
    green: linearToSrgb(-0.8294889696 * x + 1.7626640603 * y + 0.0236246858 * z),
    blue: linearToSrgb(0.0358458302 * x - 0.0761723893 * y + 0.956884524 * z),
  };
};

/** The colour-vision deficiencies G4 can preview, plus achromatopsia. */
export type VisionSimulation = 'deuter' | 'protan' | 'tritan' | 'grey';

/**
 * Viénot, Brettel & Mollon (1999) dichromat matrices, in linear RGB.
 *
 * They work by projecting the colour onto the plane the missing cone type
 * collapses the gamut to, which is why a red-green pair that a trichromat reads
 * as two colours comes back as one. Applying them in gamma-encoded sRGB — which
 * is the usual shortcut — shifts luminance and understates the collapse, so the
 * conversion to linear light on either side is not optional.
 */
const VISION_MATRICES: Record<Exclude<VisionSimulation, 'grey'>, readonly number[]> = {
  protan: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998,
  ],
  deuter: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881,
  ],
  tritan: [
    1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039,
  ],
};

/**
 * How a colour appears to someone with the named vision type.
 *
 * This is what makes the G4 simulation chips honest: they transform the sample
 * swatches rather than annotating them, so a palette whose signal disappears
 * under deuteranopia visibly disappears.
 */
export const simulateVision = (rgb: Rgb, simulation: VisionSimulation): Rgb => {
  const r = srgbToLinear(rgb.red);
  const g = srgbToLinear(rgb.green);
  const b = srgbToLinear(rgb.blue);

  if (simulation === 'grey') {
    // Rec. 709 luminance, the same weighting `relativeLuminance` uses.
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const channel = linearToSrgb(luminance);
    return { red: channel, green: channel, blue: channel };
  }

  const m = VISION_MATRICES[simulation];
  return {
    red: linearToSrgb((m[0] ?? 0) * r + (m[1] ?? 0) * g + (m[2] ?? 0) * b),
    green: linearToSrgb((m[3] ?? 0) * r + (m[4] ?? 0) * g + (m[5] ?? 0) * b),
    blue: linearToSrgb((m[6] ?? 0) * r + (m[7] ?? 0) * g + (m[8] ?? 0) * b),
  };
};

/** `simulateVision` on a hex string, which is what the screens hold. */
export const simulateVisionHex = (hex: string, simulation: VisionSimulation): string =>
  rgbToHex(simulateVision(hexToRgb(hex), simulation));
