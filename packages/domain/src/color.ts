import { DomainError } from './errors';
import type { Palette, PaletteColor, PaletteMetrics, PaletteMood } from './schemas';

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

export const classifyPaletteMood = (metrics: PaletteMetrics): PaletteMood => {
  if (metrics.contrast >= 48 && metrics.saturation >= 0.2) return 'energetic';
  if (metrics.brightness >= 76 && metrics.saturation <= 0.16) return 'airy';
  if (metrics.brightness <= 36) return 'moody';
  if (metrics.temperature >= 0.24) return 'warm';
  if (metrics.saturation <= 0.12) return 'calm';
  return 'grounded';
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
): Palette => {
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
  pixels.forEach((pixel, index) => {
    const cluster = clusters[assignments[index] ?? 0]!;
    cluster.red += pixel.rgb.red;
    cluster.green += pixel.rgb.green;
    cluster.blue += pixel.rgb.blue;
    cluster.count += 1;
  });

  const colors: PaletteColor[] = clusters
    .map((cluster) => {
      if (cluster.count === 0) return null;
      const rgb = {
        red: cluster.red / cluster.count,
        green: cluster.green / cluster.count,
        blue: cluster.blue / cluster.count,
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
    .filter((color): color is PaletteColor => color !== null)
    .sort((left, right) => right.weight - left.weight);

  const brightness = colors.reduce((sum, color) => sum + color.lightness * color.weight, 0) * 100;
  const saturation = clamp(
    colors.reduce((sum, color) => sum + color.chroma * color.weight, 0) / 0.32,
  );
  const temperature = clamp(
    colors.reduce((sum, color) => sum + temperatureForHue(color.hue) * color.weight, 0),
    -1,
    1,
  );
  const lightnesses = colors.map((color) => color.lightness);
  const contrast = (Math.max(...lightnesses) - Math.min(...lightnesses)) * 100;
  const metrics = { brightness, saturation, temperature, contrast };

  return { colors, metrics, mood: classifyPaletteMood(metrics) };
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
