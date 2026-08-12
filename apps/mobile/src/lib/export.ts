import type { Palette } from '@cw/domain';
import {
  FontSlant,
  FontWeight,
  FontWidth,
  Skia,
  TileMode,
  type SkCanvas,
  type SkFont,
} from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import { Share } from 'react-native';
import { expand, type GradientKind, type Interpolation } from '@/ui/GradientCanvas';

/**
 * Raster and vector export for G5 and C4.
 *
 * Both render off screen rather than snapshotting the view: the on-screen canvas
 * is however many points wide the phone is, and a 4K wallpaper cropped up from
 * 390pt is not a 4K wallpaper. Drawing again at the target size costs one frame
 * and produces the real thing.
 *
 * Nothing here writes to the photo library — that needs a permission and a
 * native module this build does not carry. Files land in the cache directory and
 * go out through the system share sheet, which offers "Save Image" itself.
 */

export type ShareOutcome = 'shared' | 'dismissed' | 'failed';

/** Writes bytes beside the cache and hands the file to the system share sheet. */
export async function shareFile(
  data: Uint8Array | string,
  filename: string,
): Promise<ShareOutcome> {
  try {
    const file = new File(Paths.cache, filename);
    // Exports reuse their filename, so overwriting is the normal case rather
    // than an error to be recovered from.
    file.create({ overwrite: true, intermediates: true });
    file.write(data);
    const result = await Share.share({ url: file.uri, title: filename });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'failed';
  }
}

/* --------------------------------------------------------------- gradients */

const paintFor = (hex: string) => {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(hex));
  return paint;
};

/**
 * Renders the gradient at an arbitrary size. Mirrors `GradientCanvas` so what is
 * exported is what was on screen — including the OKLab midpoint expansion, which
 * is why the stops come from the same `expand`.
 */
export function renderGradientPng({
  colors,
  kind,
  angle,
  interpolation,
  width,
  height,
}: {
  colors: readonly string[];
  kind: GradientKind;
  angle: number;
  interpolation: Interpolation;
  width: number;
  height: number;
}): Uint8Array | null {
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) return null;

  const stops = expand(colors, interpolation);
  const positions = stops.map((_, index) => index / Math.max(1, stops.length - 1));
  const skColors = stops.map((hex) => Skia.Color(hex));
  const radians = (angle * Math.PI) / 180;
  const centre = Skia.Point(width / 2, height / 2);

  const paint = Skia.Paint();
  if (kind === 'radial') {
    paint.setShader(
      Skia.Shader.MakeRadialGradient(
        centre,
        Math.hypot(width, height) / 2,
        skColors,
        positions,
        TileMode.Clamp,
      ),
    );
  } else if (kind === 'conic') {
    // A sweep has to return to its first colour or the seam shows as a hard edge.
    const looped = [...skColors, skColors[0] ?? Skia.Color('#000000')];
    const loopedPositions = looped.map((_, index) => index / Math.max(1, looped.length - 1));
    paint.setShader(
      Skia.Shader.MakeSweepGradient(
        centre.x,
        centre.y,
        looped,
        loopedPositions,
        TileMode.Clamp,
        null,
        0,
        angle,
        angle + 360,
      ),
    );
  } else {
    // Mesh has no offscreen equivalent without re-uploading the SkSL uniforms;
    // exporting it as its dominant linear ramp is closer than exporting nothing.
    paint.setShader(
      Skia.Shader.MakeLinearGradient(
        Skia.Point(
          width / 2 - (Math.cos(radians) * width) / 2,
          height / 2 - (Math.sin(radians) * height) / 2,
        ),
        Skia.Point(
          width / 2 + (Math.cos(radians) * width) / 2,
          height / 2 + (Math.sin(radians) * height) / 2,
        ),
        skColors,
        positions,
        TileMode.Clamp,
      ),
    );
  }

  const canvas = surface.getCanvas();
  canvas.drawRect(Skia.XYWHRect(0, 0, width, height), paint);
  surface.flush();
  return surface.makeImageSnapshot().encodeToBytes() ?? null;
}

/**
 * The same gradient as SVG markup.
 *
 * Conic has no SVG primitive, so it degrades to the linear ramp rather than
 * emitting a file that renders as nothing. Everything else is exact.
 */
export function gradientSvg({
  colors,
  kind,
  angle,
  interpolation,
  width,
  height,
}: {
  colors: readonly string[];
  kind: GradientKind;
  angle: number;
  interpolation: Interpolation;
  width: number;
  height: number;
}): string {
  const stops = expand(colors, interpolation);
  const markup = stops
    .map(
      (hex, index) =>
        `      <stop offset="${((index / Math.max(1, stops.length - 1)) * 100).toFixed(2)}%" stop-color="${hex.toLocaleLowerCase()}" />`,
    )
    .join('\n');

  const radians = (angle * Math.PI) / 180;
  const definition =
    kind === 'radial'
      ? `    <radialGradient id="g" cx="50%" cy="50%" r="70%">\n${markup}\n    </radialGradient>`
      : `    <linearGradient id="g" x1="${(50 - Math.cos(radians) * 50).toFixed(2)}%" y1="${(50 - Math.sin(radians) * 50).toFixed(2)}%" x2="${(50 + Math.cos(radians) * 50).toFixed(2)}%" y2="${(50 + Math.sin(radians) * 50).toFixed(2)}%">\n${markup}\n    </linearGradient>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '  <defs>',
    definition,
    '  </defs>',
    `  <rect width="${width}" height="${height}" fill="url(#g)" />`,
    '</svg>',
    '',
  ].join('\n');
}

/* ------------------------------------------------------------ share cards */

/** C4's three ratios, as pixel sizes. */
export const SHARE_SIZES = {
  '1x1': { width: 1080, height: 1080 },
  '4x5': { width: 1080, height: 1350 },
  '9x16': { width: 1080, height: 1920 },
} as const;

export type ShareFormatKey = keyof typeof SHARE_SIZES;

/**
 * Draws the social card: the palette at its true proportions, the name, and the
 * hexes when asked for. Proportional rather than an even grid, because that is
 * what the card is for — the composition, not the swatch list.
 */
export function renderShareCard({
  palette,
  format,
  showHex,
  watermark,
}: {
  palette: Palette;
  format: ShareFormatKey;
  showHex: boolean;
  watermark: boolean;
}): Uint8Array | null {
  const { width, height } = SHARE_SIZES[format];
  const surface = Skia.Surface.MakeOffscreen(width, height);
  if (!surface) return null;

  const canvas = surface.getCanvas();
  canvas.drawColor(Skia.Color('#08070E'));

  const margin = Math.round(width * 0.07);
  const bandTop = margin;
  const bandHeight = Math.round(height * (showHex ? 0.6 : 0.68));

  // Bands are weighted, so the card shows the same proportions the library card
  // and the palette hero do.
  let x = margin;
  const bandWidth = width - margin * 2;
  for (const color of palette.colors) {
    const slice = Math.round(bandWidth * color.weight);
    canvas.drawRect(Skia.XYWHRect(x, bandTop, slice, bandHeight), paintFor(color.hex));
    x += slice;
  }
  // Rounding can leave a sliver of ground at the right edge; the dominant fills it.
  const dominant = palette.colors[0];
  if (x < margin + bandWidth && dominant) {
    canvas.drawRect(
      Skia.XYWHRect(x, bandTop, margin + bandWidth - x, bandHeight),
      paintFor(dominant.hex),
    );
  }

  const font = systemFont(Math.round(width * 0.045));
  const monoFont = systemFont(Math.round(width * 0.026));
  let cursor = bandTop + bandHeight + Math.round(height * 0.055);

  if (font) {
    drawText(canvas, palette.name, margin, cursor, font, '#EDEAE3');
    cursor += Math.round(width * 0.055);
  }

  if (showHex && monoFont) {
    drawText(
      canvas,
      palette.colors.map((color) => color.hex).join('   '),
      margin,
      cursor,
      monoFont,
      'rgba(237,234,227,0.66)',
    );
    cursor += Math.round(width * 0.04);
  }

  if (watermark && monoFont) {
    drawText(canvas, 'Chroma Wave', margin, height - margin, monoFont, 'rgba(237,234,227,0.42)');
  }

  surface.flush();
  return surface.makeImageSnapshot().encodeToBytes() ?? null;
}

/**
 * A system typeface at a size, or null.
 *
 * The card is worth exporting without type — bands and proportions are the
 * point — so a platform with no matching family degrades to an untitled card
 * rather than failing the export.
 */
function systemFont(size: number): SkFont | null {
  try {
    const typeface = Skia.FontMgr.System().matchFamilyStyle('', {
      weight: FontWeight.Medium,
      width: FontWidth.Normal,
      slant: FontSlant.Upright,
    });
    return typeface ? Skia.Font(typeface, size) : null;
  } catch {
    return null;
  }
}

function drawText(
  canvas: SkCanvas,
  text: string,
  x: number,
  y: number,
  font: SkFont | null,
  color: string,
) {
  if (!font) return;
  canvas.drawText(text, x, y, paintFor(color), font);
}
