import {
  findLayer,
  planSlicesFor,
  translateRect,
  type SlicePlan,
  type SnapGuide,
  type StoryProject,
} from '@cw/domain';
import {
  Canvas,
  PaintStyle,
  Picture,
  Skia,
  type SkCanvas,
  type SkImage,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { View } from 'react-native';
import { drawScene, type SceneReport } from '../render/drawScene';
import { useStoryFonts } from '../render/storyFonts';

/**
 * One slide of the story, drawn on screen.
 *
 * **The same renderer the exporter uses.** `drawScene` is called here with a
 * fractional `scale` and preview images, and there with `scale: 1` and masters.
 * Nothing else differs, which is what makes the preview an actual preview rather
 * than a second implementation that has to be kept in agreement.
 *
 * **The picture is rebuilt when the document changes, not when a gesture moves.**
 * An in-flight drag is an overlay transform on the UI thread (`useElementGesture`),
 * and only its final position reaches the document. So this recording happens on
 * the order of once per edit, not sixty times a second.
 */
export function StoryCanvas({
  project,
  slideIndex,
  images,
  width,
  background,
  onReport,
  guides,
  guideColor,
  selectedId,
}: {
  project: StoryProject;
  slideIndex: number;
  images: ReadonlyMap<string, SkImage>;
  width: number;
  background: string;
  onReport?: (report: SceneReport) => void;
  /** Alignment lines from the last snap. Drawn over the scene, never exported. */
  guides?: readonly SnapGuide[];
  guideColor?: string;
  /** Outlined so selection is visible without relying on colour alone. */
  selectedId?: string | null;
}) {
  const plans = useMemo(() => planSlicesFor(project), [project]);
  const plan: SlicePlan | undefined = plans[slideIndex];

  const scale = plan === undefined ? 1 : width / plan.width;
  const height = plan === undefined ? 0 : plan.height * scale;

  const fonts = useStoryFonts(plan?.width ?? 1080);

  const picture = useMemo(() => {
    if (plan === undefined || fonts === null) return null;

    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));

    const report = drawScene({
      canvas,
      layers: project.layers,
      plan,
      images: (assetId) => images.get(assetId) ?? null,
      fonts,
      scale,
      background,
    });
    onReport?.(report);

    /**
     * Guides and the selection outline are drawn *after* the scene and are not
     * part of it.
     *
     * They exist only in the editor: `exportStory` builds its own picture from
     * `drawScene` alone, so there is no path by which a guide reaches an
     * exported slide. That is the same reason slide boundaries are chrome rather
     * than elements.
     */
    drawOverlay({
      canvas,
      plan,
      scale,
      guides: guides ?? [],
      guideColor: guideColor ?? '#FFFFFF',
      selected: selectedId == null ? null : findLayer(project, selectedId),
    });

    return recorder.finishRecordingAsPicture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project,
    plan,
    images,
    fonts,
    scale,
    width,
    height,
    background,
    guides,
    guideColor,
    selectedId,
  ]);

  if (plan === undefined || picture === null) return <View style={{ width, height: 0 }} />;

  return (
    <Canvas style={{ width, height }}>
      <Picture picture={picture} />
    </Canvas>
  );
}

/**
 * The whole story at once, laid end to end.
 *
 * The overview the brief asks for, and the cheapest possible honest one: the
 * slides are the same recordings the single-slide view makes, placed side by
 * side, so what the overview shows cannot disagree with what each slide shows.
 * Slide boundaries are drawn by the caller as guides — they are not part of the
 * scene and never reach an export.
 */
export function StoryOverview({
  project,
  images,
  width,
  background,
}: {
  project: StoryProject;
  images: ReadonlyMap<string, SkImage>;
  width: number;
  background: string;
}) {
  const plans = useMemo(() => planSlicesFor(project), [project]);
  const first = plans[0];

  const scale = first === undefined ? 1 : width / (first.width * plans.length);
  const height = first === undefined ? 0 : first.height * scale;
  const slideWidth = first === undefined ? 0 : first.width * scale;

  const fonts = useStoryFonts(first?.width ?? 1080);

  const picture = useMemo(() => {
    if (first === undefined || fonts === null) return null;

    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, width, height));

    for (const plan of plans) {
      canvas.save();
      canvas.translate(plan.index * slideWidth, 0);
      drawScene({
        canvas,
        layers: project.layers,
        plan,
        images: (assetId) => images.get(assetId) ?? null,
        fonts,
        scale,
        background,
      });
      canvas.restore();
    }

    return recorder.finishRecordingAsPicture();
  }, [project.layers, plans, first, images, fonts, scale, slideWidth, width, height, background]);

  if (picture === null) return <View style={{ width, height: 0 }} />;

  return (
    <Canvas style={{ width, height }}>
      <Picture picture={picture} />
    </Canvas>
  );
}

/**
 * The editor's own marks: alignment guides and the selection outline.
 *
 * Deliberately a separate function from `drawScene`, and deliberately never
 * called by the exporter. A guide that could reach an export is a guide that
 * eventually does.
 *
 * The selection outline is a **shape**, not a tint. Selection must not be
 * signalled by colour alone — an outline is visible to someone who cannot
 * distinguish the accent from the photograph underneath it, and it survives both
 * skins without either needing a colour it does not have.
 */
function drawOverlay(input: {
  canvas: SkCanvas;
  plan: SlicePlan;
  scale: number;
  guides: readonly SnapGuide[];
  guideColor: string;
  selected: StoryProject['layers'][number] | null;
}): void {
  const { canvas, plan, scale, guides, guideColor, selected } = input;

  canvas.save();
  canvas.scale(scale, scale);

  if (guides.length > 0) {
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(guideColor));
    paint.setStyle(PaintStyle.Stroke);
    // Divided by the scale so the line is a constant width on screen rather than
    // a hairline at small zoom and a bar at large.
    paint.setStrokeWidth(1 / scale);

    for (const guide of guides) {
      const local = guide.axis === 'x' ? guide.position + plan.translateX : guide.position;
      if (guide.axis === 'x') {
        canvas.drawLine(local, 0, local, plan.height, paint);
      } else {
        canvas.drawLine(0, local, plan.width, local, paint);
      }
    }
  }

  if (selected !== null) {
    const frame = translateRect(selected.frame, plan.translateX, 0);
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(guideColor));
    paint.setStyle(PaintStyle.Stroke);
    paint.setStrokeWidth(2 / scale);
    canvas.drawRect(Skia.XYWHRect(frame.x, frame.y, frame.width, frame.height), paint);
  }

  canvas.restore();
}
