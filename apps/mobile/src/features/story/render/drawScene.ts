import {
  cropToSourceRect,
  translateRect,
  type SlicePlan,
  type StoryElement,
  type TextRole,
} from '@cw/domain';
import {
  ClipOp,
  FilterMode,
  MipmapMode,
  Skia,
  type SkCanvas,
  type SkFont,
  type SkImage,
} from '@shopify/react-native-skia';
import { alignX, paletteBands, textBlockTop } from './layout';
import { layoutLines, wrapText } from './wrapText';

/**
 * Drawing one slice of a story.
 *
 * **This is the single renderer.** The editor's canvas and the exporter both
 * call it, differing only in `scale` and in which image they hand over — a
 * preview on screen, a master on export. That is what makes "what you edited is
 * what you exported" true by construction rather than by two implementations
 * agreeing to stay in step.
 *
 * **Slices differ by exactly one number.** Every element is drawn at its logical
 * position translated by `plan.translateX`, and nothing else about the scene
 * changes between slides. Two adjacent slices therefore agree at their shared
 * edge because they are the same drawing, offset — see `slicing.ts` for the
 * argument and the test that holds it.
 *
 * Pure with respect to the document: it reads elements and draws, and never
 * writes. What it *does* return is a report of what it could not draw, because a
 * missing photograph is something the editor has to be able to say out loud.
 */

export type SceneImages = (assetId: string) => SkImage | null;

/** One font per text role. The skin chooses them; the renderer only uses them. */
export type SceneTypography = Readonly<Record<TextRole, SkFont>>;

export type SceneReport = {
  /** Assets an element referenced whose bytes could not be resolved. */
  missingAssets: readonly string[];
};

export type DrawSceneOptions = {
  canvas: SkCanvas;
  layers: readonly StoryElement[];
  plan: SlicePlan;
  images: SceneImages;
  fonts: SceneTypography;
  /**
   * Logical units to output pixels. `1` at export, where one logical unit is one
   * pixel by definition; a fraction on screen, where a 1080-wide slide is drawn
   * into roughly 360 points.
   */
  scale: number;
  /** The ground the slice is drawn on, as `#RRGGBB`. */
  background: string;
};

/**
 * Draws one slice and reports what it could not resolve.
 *
 * The canvas is left in the state it arrived in: every element's transform is
 * bracketed by `save`/`restore`, so one rotated element cannot leave the canvas
 * rotated for the next.
 */
export function drawScene(options: DrawSceneOptions): SceneReport {
  const { canvas, layers, plan, images, fonts, scale, background } = options;
  const missingAssets: string[] = [];

  canvas.drawColor(Skia.Color(background));

  canvas.save();
  // Logical units become output pixels here, once, so nothing below this line
  // has to know what resolution it is drawing at.
  canvas.scale(scale, scale);

  for (const element of layers) {
    if (element.hidden || element.opacity <= 0) continue;

    // The element's frame, expressed relative to this slice's left edge.
    //
    // `plan.translateX` *is* the difference between drawing slide 0 and slide 7
    // — it is already `-index × slideWidth`, computed once in `slicing.ts` with
    // the `-0` guard. Recomputing it here from a format would be a second place
    // for the two to disagree, and disagreement is what a seam is.
    const frame = translateRect(element.frame, plan.translateX, 0);
    const alpha = Math.max(0, Math.min(1, element.opacity));

    canvas.save();
    if (element.rotation !== 0) {
      canvas.rotate(element.rotation, frame.x + frame.width / 2, frame.y + frame.height / 2);
    }

    switch (element.kind) {
      case 'photo': {
        const image = images(element.assetId);
        if (image === null) {
          missingAssets.push(element.assetId);
          drawMissing(canvas, frame, alpha);
          break;
        }
        drawPhoto(canvas, image, element, frame, alpha);
        break;
      }

      case 'text':
        drawTextElement(canvas, element, frame, alpha, fonts);
        break;

      case 'paletteStrip':
        drawPaletteStrip(canvas, element, frame, alpha);
        break;

      case 'video':
        // Unreachable: `videoElementSchema` refuses to validate, so no stored
        // document can contain one (decision D2). The branch exists so that the
        // day the refusal is lifted, this is a compile error naming the exact
        // place video has to be implemented rather than a silently blank frame.
        missingAssets.push(element.assetId);
        drawMissing(canvas, frame, alpha);
        break;
    }

    canvas.restore();
  }

  canvas.restore();
  return { missingAssets };
}

function drawPhoto(
  canvas: SkCanvas,
  image: SkImage,
  element: Extract<StoryElement, { kind: 'photo' }>,
  frame: { x: number; y: number; width: number; height: number },
  alpha: number,
): void {
  // The crop is a fraction of the source, so it means the same thing whether
  // this is a 1024px preview or a 4096px master. Scaling it by the image's
  // *actual* dimensions rather than the document's `sourceWidth` is what makes
  // that true — those differ by design between preview and export.
  const source = cropToSourceRect(element.crop, {
    width: image.width(),
    height: image.height(),
  });

  const paint = Skia.Paint();
  paint.setAlphaf(alpha);

  const destination = Skia.XYWHRect(frame.x, frame.y, frame.width, frame.height);

  canvas.save();
  // Clipped to its frame so a photograph cannot bleed over a neighbour when the
  // crop and the frame disagree about aspect.
  canvas.clipRect(destination, ClipOp.Intersect, true);
  canvas.drawImageRectOptions(
    image,
    Skia.XYWHRect(source.x, source.y, source.width, source.height),
    destination,
    // Linear + nearest mipmap: this is a downscale of a photograph, where
    // nearest-neighbour sampling produces visible aliasing on export.
    FilterMode.Linear,
    MipmapMode.Nearest,
    paint,
  );
  canvas.restore();
}

/**
 * A visible, deliberate gap where a photograph should be.
 *
 * A missing file is expected — a restore from backup, a cleared cache — and the
 * honest response is to show that something is absent rather than to draw
 * nothing and let the author think they deleted it themselves. Drawn as an
 * outline so it reads as a placeholder rather than as a design element.
 */
function drawMissing(
  canvas: SkCanvas,
  frame: { x: number; y: number; width: number; height: number },
  alpha: number,
): void {
  const paint = Skia.Paint();
  paint.setAlphaf(alpha * 0.35);
  paint.setColor(Skia.Color('#808080'));
  canvas.drawRect(Skia.XYWHRect(frame.x, frame.y, frame.width, frame.height), paint);
}

function drawTextElement(
  canvas: SkCanvas,
  element: Extract<StoryElement, { kind: 'text' }>,
  frame: { x: number; y: number; width: number; height: number },
  alpha: number,
  fonts: SceneTypography,
): void {
  const font = fonts[element.role];
  const paint = Skia.Paint();
  paint.setAlphaf(alpha);
  paint.setColor(Skia.Color(element.colorHex));

  const lines = wrapText(element.text, (text) => font.measureText(text).width, {
    maxWidth: frame.width,
  });
  if (lines.length === 0) return;

  const metrics = font.getMetrics();
  // Skia reports ascent as a negative number above the baseline.
  const ascent = Math.abs(metrics.ascent);
  const lineHeight = ascent + Math.abs(metrics.descent);
  const { baselines, height } = layoutLines(lines.length, lineHeight, ascent);
  const top = textBlockTop(frame.y, frame.height, height);

  for (const [index, line] of lines.entries()) {
    const baseline = baselines[index];
    if (baseline === undefined) continue;

    const x = alignX(element.align, frame.x, frame.width, font.measureText(line).width);
    canvas.drawText(line, x, top + baseline, paint, font);
  }
}

/**
 * The palette, at the proportions the photograph actually had.
 *
 * Weighted is the default because the product's whole claim is that these
 * colours are what the picture is *made of*; an even grid quietly drops the
 * "how much" half of that. The weights are guaranteed to sum to one by
 * `paletteStripElementSchema`, so no normalisation is needed here — but the
 * running offset is accumulated rather than recomputed per band so rounding
 * cannot leave a hairline gap between two colours.
 */
function drawPaletteStrip(
  canvas: SkCanvas,
  element: Extract<StoryElement, { kind: 'paletteStrip' }>,
  frame: { x: number; y: number; width: number; height: number },
  alpha: number,
): void {
  const horizontal = element.orientation === 'horizontal';
  const span = horizontal ? frame.width : frame.height;

  for (const band of paletteBands(element.colors, span, element.weighted)) {
    const paint = Skia.Paint();
    paint.setAlphaf(alpha);
    paint.setColor(Skia.Color(band.hex));

    canvas.drawRect(
      horizontal
        ? Skia.XYWHRect(frame.x + band.offset, frame.y, band.length, frame.height)
        : Skia.XYWHRect(frame.x, frame.y + band.offset, frame.width, band.length),
      paint,
    );
  }
}
