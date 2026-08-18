import type { StoryElement } from './elements';
import type { StoryFormat } from './formats';
import { sliceBounds, type Rect } from './geometry';

/**
 * Snapping, and the guides that explain it.
 *
 * **The design constraint that shapes all of this: snapping that fights the user
 * is worse than no snapping.** So three rules:
 *
 *   1. **A snap moves the element, never resizes it.** Adjusting width to meet a
 *      guide silently changes a crop, and the user sees their photograph shift
 *      inside its frame for no reason they can name.
 *   2. **One snap per axis, the nearest.** Two candidates within threshold on the
 *      same axis is a coin toss the user cannot predict; the nearest is the one
 *      they were aiming at.
 *   3. **Nothing snaps beyond the threshold.** Above it the element goes exactly
 *      where it was dragged. A snap that reaches out to grab something far away
 *      is the behaviour people describe as "it keeps jumping".
 *
 * Pure, and separated from the gesture, because these are the numbers that are
 * wrong in ways only a finger reveals — and a finger is the most expensive place
 * to discover them.
 */

/** How near, in canvas units, before a candidate pulls. */
export const SNAP_THRESHOLD = 24;

export const snapKinds = [
  'slide-center-x',
  'slide-center-y',
  'slide-edge',
  'canvas-edge',
  'element-edge',
  'element-center',
] as const;
export type SnapKind = (typeof snapKinds)[number];

export type SnapGuide = Readonly<{
  kind: SnapKind;
  axis: 'x' | 'y';
  /** Where to draw the line, in logical canvas units. */
  position: number;
}>;

export type SnapResult = Readonly<{
  /** The frame to use. Identical to the input when nothing was near enough. */
  frame: Rect;
  /** What pulled, for drawing guides and for announcing the snap. */
  guides: readonly SnapGuide[];
}>;

type Candidate = Readonly<{ kind: SnapKind; axis: 'x' | 'y'; position: number }>;

/** The three interesting positions of a rect on one axis: near edge, centre, far edge. */
const edgesOf = (frame: Rect, axis: 'x' | 'y'): readonly number[] =>
  axis === 'x'
    ? [frame.x, frame.x + frame.width / 2, frame.x + frame.width]
    : [frame.y, frame.y + frame.height / 2, frame.y + frame.height];

/**
 * Everything an element could align to on the slide it is being dragged over.
 *
 * Deliberately **not** every slide's guides at once. An element on slide 3
 * snapping to slide 7's centre is technically an alignment and practically a
 * bug: the user cannot see what it aligned to.
 */
export function snapCandidates(
  format: StoryFormat,
  slideIndex: number,
  slideCount: number,
  others: readonly StoryElement[],
): readonly Candidate[] {
  const slide = sliceBounds(format, slideIndex);
  const candidates: Candidate[] = [
    { kind: 'slide-center-x', axis: 'x', position: slide.x + slide.width / 2 },
    { kind: 'slide-center-y', axis: 'y', position: slide.y + slide.height / 2 },
    { kind: 'slide-edge', axis: 'x', position: slide.x },
    { kind: 'slide-edge', axis: 'x', position: slide.x + slide.width },
    { kind: 'slide-edge', axis: 'y', position: slide.y },
    { kind: 'slide-edge', axis: 'y', position: slide.y + slide.height },
  ];

  // The outer edges of the whole story, which are the only canvas edges that are
  // not also a slide edge.
  candidates.push({ kind: 'canvas-edge', axis: 'x', position: 0 });
  candidates.push({ kind: 'canvas-edge', axis: 'x', position: format.slideWidth * slideCount });

  for (const other of others) {
    if (other.hidden) continue;
    for (const position of edgesOf(other.frame, 'x')) {
      candidates.push({ kind: 'element-edge', axis: 'x', position });
    }
    for (const position of edgesOf(other.frame, 'y')) {
      candidates.push({ kind: 'element-edge', axis: 'y', position });
    }
    candidates.push({
      kind: 'element-center',
      axis: 'x',
      position: other.frame.x + other.frame.width / 2,
    });
    candidates.push({
      kind: 'element-center',
      axis: 'y',
      position: other.frame.y + other.frame.height / 2,
    });
  }

  return candidates;
}

/**
 * Applies at most one snap per axis to a dragged frame.
 *
 * The element's own three edges are each tested against every candidate; the
 * smallest distance under the threshold wins, and the frame is **translated** by
 * that distance. Width and height are never touched.
 */
export function snapFrame(
  frame: Rect,
  candidates: readonly Candidate[],
  threshold: number = SNAP_THRESHOLD,
): SnapResult {
  const guides: SnapGuide[] = [];
  let dx = 0;
  let dy = 0;

  for (const axis of ['x', 'y'] as const) {
    const own = edgesOf(frame, axis);
    let best: { delta: number; guide: SnapGuide } | null = null;

    for (const candidate of candidates) {
      if (candidate.axis !== axis) continue;
      for (const edge of own) {
        const delta = candidate.position - edge;
        if (Math.abs(delta) > threshold) continue;
        // Strictly nearer, so the first candidate at a given distance wins and
        // the result does not depend on the order others happen to be in.
        if (best === null || Math.abs(delta) < Math.abs(best.delta)) {
          best = {
            delta,
            guide: { kind: candidate.kind, axis, position: candidate.position },
          };
        }
      }
    }

    if (best === null) continue;
    if (axis === 'x') dx = best.delta;
    else dy = best.delta;
    guides.push(best.guide);
  }

  if (dx === 0 && dy === 0) return { frame, guides };
  return { frame: { ...frame, x: frame.x + dx, y: frame.y + dy }, guides };
}

/**
 * The whole operation: what a dragged element should become.
 *
 * `movingId` is excluded from the candidates — an element that could snap to its
 * own edges would never move at all.
 */
export function snapDraggedFrame(input: {
  frame: Rect;
  movingId: string;
  layers: readonly StoryElement[];
  format: StoryFormat;
  slideIndex: number;
  slideCount: number;
  threshold?: number;
  /** False disables snapping entirely — a held modifier, or a preference. */
  enabled?: boolean;
}): SnapResult {
  if (input.enabled === false) return { frame: input.frame, guides: [] };

  const others = input.layers.filter((layer) => layer.id !== input.movingId);
  const candidates = snapCandidates(input.format, input.slideIndex, input.slideCount, others);
  return snapFrame(input.frame, candidates, input.threshold ?? SNAP_THRESHOLD);
}
