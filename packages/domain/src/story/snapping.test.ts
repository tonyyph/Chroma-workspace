import { describe, expect, it } from 'vitest';

import { storyElementSchema, type StoryElement } from './elements';
import { formatOf } from './formats';
import { type Rect } from './geometry';
import { SNAP_THRESHOLD, snapDraggedFrame, snapFrame, snapCandidates } from './snapping';

const portrait = formatOf('portrait');

const photo = (id: string, frame: Rect, overrides: Partial<StoryElement> = {}): StoryElement =>
  storyElementSchema.parse({
    kind: 'photo',
    id,
    frame,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    assetId: `asset-${id}`,
    sourceWidth: 3000,
    sourceHeight: 4000,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    ...overrides,
  });

const drag = (frame: Rect, layers: readonly StoryElement[] = [], slideIndex = 0) =>
  snapDraggedFrame({
    frame,
    movingId: 'moving',
    layers,
    format: portrait,
    slideIndex,
    slideCount: 3,
  });

describe('a snap moves and never resizes', () => {
  it('preserves width and height exactly', () => {
    // Near the slide's horizontal centre (540) but not on it.
    const frame: Rect = { x: 400, y: 400, width: 300, height: 200 };
    const result = drag(frame);

    expect(result.frame.width).toBe(300);
    expect(result.frame.height).toBe(200);
  });

  it('translates the frame by the snap distance', () => {
    // Centre of this frame is 545; the slide centre is 540, so it pulls by -5.
    const frame: Rect = { x: 395, y: 4000, width: 300, height: 200 };
    const result = drag(frame);

    expect(result.frame.x).toBe(390);
    expect(result.frame.width).toBe(300);
  });
});

describe('the threshold', () => {
  it('does not reach out beyond it', () => {
    // Far from every candidate on both axes.
    const frame: Rect = { x: 250, y: 500, width: 137, height: 111 };
    const result = drag(frame);
    expect(result.frame).toEqual(frame);
    expect(result.guides).toEqual([]);
  });

  it('pulls at exactly the threshold', () => {
    // Left edge SNAP_THRESHOLD away from the slide's left edge (0).
    const frame: Rect = { x: SNAP_THRESHOLD, y: 600, width: 100, height: 100 };
    const result = drag(frame);
    expect(result.frame.x).toBe(0);
  });

  it('honours a custom threshold', () => {
    const frame: Rect = { x: 100, y: 600, width: 100, height: 100 };
    expect(snapFrame(frame, snapCandidates(portrait, 0, 3, []), 200).frame.x).toBe(0);
    expect(snapFrame(frame, snapCandidates(portrait, 0, 3, []), 1).frame).toEqual(frame);
  });

  it('can be turned off entirely', () => {
    const frame: Rect = { x: 2, y: 600, width: 100, height: 100 };
    const result = snapDraggedFrame({
      frame,
      movingId: 'moving',
      layers: [],
      format: portrait,
      slideIndex: 0,
      slideCount: 3,
      enabled: false,
    });
    expect(result.frame).toEqual(frame);
    expect(result.guides).toEqual([]);
  });
});

describe('one snap per axis, the nearest', () => {
  it('takes the nearer of two candidates on the same axis', () => {
    // Two elements offering edges at 500 and 520; the frame's left edge is 518.
    const others = [
      photo('a', { x: 500, y: 0, width: 10, height: 10 }),
      photo('b', { x: 520, y: 0, width: 10, height: 10 }),
    ];
    const result = drag({ x: 518, y: 600, width: 100, height: 100 }, others);

    // 520 is 2 away; 500 is 18 away. The nearer wins.
    expect(result.frame.x).toBe(520);
  });

  it('produces at most one guide per axis', () => {
    const others = [photo('a', { x: 540, y: 675, width: 10, height: 10 })];
    const result = drag({ x: 535, y: 670, width: 100, height: 100 }, others);

    expect(result.guides.filter((guide) => guide.axis === 'x')).toHaveLength(1);
    expect(result.guides.filter((guide) => guide.axis === 'y')).toHaveLength(1);
  });

  it('snaps both axes independently', () => {
    // Left edge near the slide's left; top edge near the slide's top.
    const result = drag({ x: 5, y: 5, width: 100, height: 100 });
    expect(result.frame.x).toBe(0);
    expect(result.frame.y).toBe(0);
    expect(result.guides).toHaveLength(2);
  });
});

describe('what an element can align to', () => {
  it('snaps its centre to the slide centre', () => {
    // Frame centred at 550; slide centre is 540.
    const result = drag({ x: 450, y: 4000, width: 200, height: 100 });
    expect(result.frame.x + result.frame.width / 2).toBe(540);
    expect(result.guides[0]?.kind).toBe('slide-center-x');
  });

  it('snaps to another element edge', () => {
    const others = [photo('other', { x: 300, y: 0, width: 200, height: 200 })];
    // Left edge at 306, other's left edge at 300.
    const result = drag({ x: 306, y: 700, width: 50, height: 50 }, others);
    expect(result.frame.x).toBe(300);
    expect(result.guides.some((guide) => guide.kind.startsWith('element'))).toBe(true);
  });

  it('never snaps to itself', () => {
    const moving = photo('moving', { x: 0, y: 0, width: 100, height: 100 });
    // A frame dragged well away from every other candidate. If its own edges
    // were candidates it would be pinned in place forever.
    const frame: Rect = { x: 251, y: 511, width: 100, height: 100 };
    const result = drag(frame, [moving]);
    expect(result.frame).toEqual(frame);
  });

  it('ignores hidden elements as guides', () => {
    const hidden = [photo('h', { x: 300, y: 0, width: 200, height: 200 }, { hidden: true })];
    const frame: Rect = { x: 306, y: 700, width: 50, height: 50 };
    // 306 is within threshold of 300, but that element is not on screen — so
    // snapping to it would align to something invisible.
    expect(drag(frame, hidden).frame.x).toBe(frame.x);
  });

  it('offers the dragged slide’s guides, not every slide’s', () => {
    const candidates = snapCandidates(portrait, 1, 3, []);
    const centres = candidates.filter((candidate) => candidate.kind === 'slide-center-x');

    // Slide 1's centre is 1080 + 540 = 1620, and it is the only one offered.
    expect(centres).toHaveLength(1);
    expect(centres[0]?.position).toBe(1620);
  });

  it('offers the outer canvas edges', () => {
    const candidates = snapCandidates(portrait, 0, 3, []);
    const canvasEdges = candidates
      .filter((candidate) => candidate.kind === 'canvas-edge')
      .map((candidate) => candidate.position);

    expect(canvasEdges).toContain(0);
    expect(canvasEdges).toContain(3240);
  });
});

describe('guides describe what happened', () => {
  it('reports the position the line should be drawn at', () => {
    const result = drag({ x: 450, y: 4000, width: 200, height: 100 });
    const guide = result.guides.find((entry) => entry.axis === 'x');
    expect(guide?.position).toBe(540);
  });

  it('reports nothing when nothing snapped', () => {
    expect(drag({ x: 251, y: 511, width: 137, height: 111 }).guides).toEqual([]);
  });
});

describe('determinism', () => {
  it('gives the same answer regardless of the order others are listed in', () => {
    const a = photo('a', { x: 500, y: 0, width: 10, height: 10 });
    const b = photo('b', { x: 520, y: 0, width: 10, height: 10 });
    const frame: Rect = { x: 518, y: 600, width: 100, height: 100 };

    expect(drag(frame, [a, b]).frame).toEqual(drag(frame, [b, a]).frame);
  });
});
