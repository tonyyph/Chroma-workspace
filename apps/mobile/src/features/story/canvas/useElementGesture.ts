import type { Rect } from '@cw/domain';
import { useCallback, useMemo } from 'react';
import { Gesture, type ComposedGesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * Moving and resizing an element with fingers.
 *
 * **The arbitration, stated before the code, because it is the whole problem.**
 * Three things want the same touch: moving the selected element, panning the
 * canvas, and changing slides. Left to compete, dragging a photograph near the
 * edge of a slide either scrolls the story or does both at once. The rules here:
 *
 *   1. **An element gesture requires a selected element and a touch that began
 *      on it.** Selection is a deliberate tap, so nothing moves by accident, and
 *      a drag that starts on empty space is never an element drag.
 *   2. **Pinch is element-only while something is selected.** Canvas zoom is not
 *      in this slice at all, so there is no second interpretation of two fingers
 *      to arbitrate against — a decision, not an omission.
 *   3. **Slide navigation is the scroll view outside the canvas**, and it is
 *      disabled for the duration of an element gesture. A gesture that could
 *      mean either is resolved by which one is *active*, never by a threshold
 *      race, because a threshold race is what produces a canvas that sometimes
 *      does the wrong thing.
 *
 * **No gesture frame reaches React.** Position lives in shared values on the UI
 * thread, and the document is written once, on end, through `onCommit`. That is
 * what keeps a drag at sixty frames on a document with twenty elements — a
 * `setState` per frame would re-record the Skia picture per frame.
 */

export type ElementGestureValues = {
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  scale: SharedValue<number>;
  active: SharedValue<boolean>;
};

export type ElementGestureOptions = {
  frame: Rect | null;
  locked: boolean;
  unitsPerPoint: number;
  onCommit: (frame: Rect) => void;
  onStart?: () => void;
  /**
   * Applies snapping to a candidate frame, on the JS thread.
   *
   * Passed in rather than computed here because it needs the document, and a
   * worklet must not read it. It runs **on release only**, never per frame: an
   * element that snapped mid-drag sticks to guides while the finger keeps
   * moving, which reads as lag rather than as alignment. The live drag follows
   * the finger exactly; the commit is where it lands.
   */
  snap?: (frame: Rect) => Rect;
};

/** Below this a pinch is a jitter in a two-finger drag, not a resize. */
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

export function useElementGesture(options: ElementGestureOptions): {
  gesture: ComposedGesture;
  values: ElementGestureValues;
} {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const active = useSharedValue(false);

  const { frame, locked, unitsPerPoint, onCommit, onStart, snap } = options;

  /**
   * One place where a committed frame is snapped and handed over.
   *
   * Both `onEnd` handlers call it through `runOnJS`, so the snap runs on the JS
   * thread where the document lives, and the element lands on the guide rather
   * than near it.
   */
  const commit = useCallback(
    (next: Rect) => {
      onCommit(snap === undefined ? next : snap(next));
    },
    [onCommit, snap],
  );

  const gesture = useMemo(() => {
    const enabled = frame !== null && !locked;

    const reset = (): void => {
      'worklet';
      translateX.value = 0;
      translateY.value = 0;
      scale.value = 1;
      active.value = false;
    };

    const pan = Gesture.Pan()
      .enabled(enabled)
      .maxPointers(1)
      .onStart(() => {
        'worklet';
        active.value = true;
        if (onStart !== undefined) runOnJS(onStart)();
      })
      .onUpdate((event) => {
        'worklet';
        translateX.value = event.translationX * unitsPerPoint;
        translateY.value = event.translationY * unitsPerPoint;
      })
      .onEnd(() => {
        'worklet';
        if (frame === null) {
          reset();
          return;
        }
        const next = committedFrame(frame, { x: translateX.value, y: translateY.value }, 1);
        runOnJS(commit)(next);
        reset();
      })
      .onFinalize(() => {
        'worklet';
        active.value = false;
      });

    const pinch = Gesture.Pinch()
      .enabled(enabled)
      .onStart(() => {
        'worklet';
        active.value = true;
        if (onStart !== undefined) runOnJS(onStart)();
      })
      .onUpdate((event) => {
        'worklet';
        scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, event.scale));
      })
      .onEnd(() => {
        'worklet';
        if (frame === null) {
          reset();
          return;
        }
        const next = committedFrame(frame, { x: 0, y: 0 }, scale.value);
        runOnJS(commit)(next);
        reset();
      })
      .onFinalize(() => {
        'worklet';
        active.value = false;
      });

    return Gesture.Simultaneous(pan, pinch);
  }, [frame, locked, unitsPerPoint, commit, onStart, translateX, translateY, scale, active]);

  return { gesture, values: { translateX, translateY, scale, active } };
}

/**
 * Where the committed frame is computed, lifted out of the worklets.
 *
 * Both `onEnd` handlers need it, and it is the arithmetic most worth asserting:
 * a resize that anchors to the top-left instead of the centre walks the element
 * across the canvas as it grows, which looks like a bug in the gesture rather
 * than in one line of geometry.
 */
export function committedFrame(
  frame: Rect,
  translation: { x: number; y: number },
  factor: number,
): Rect {
  const width = frame.width * factor;
  const height = frame.height * factor;
  return {
    x: frame.x + translation.x + (frame.width - width) / 2,
    y: frame.y + translation.y + (frame.height - height) / 2,
    width,
    height,
  };
}
