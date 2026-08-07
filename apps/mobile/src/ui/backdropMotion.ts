import { makeMutable, withSpring } from 'react-native-reanimated';

/**
 * What the backdrop is currently reacting to.
 *
 * Module-level shared values rather than context: these are written from scroll
 * handlers running on the UI thread and read by a Skia shader also on the UI
 * thread. Routing them through React would put a re-render between a finger
 * moving and the field responding, which is the difference between parallax and
 * lag.
 *
 * They are deliberately global. There is one backdrop for the whole app — every
 * screen draws the same field from these values, so a push shows a continuous
 * ground rather than two fields at different points in their loop.
 */

/** Cumulative scroll offset, in points, of whatever list is in front. */
export const backdropScroll = makeMutable(0);

/**
 * The field's position in its loop, 0-1. Written by the one driver mounted at
 * the root; read by every canvas, which is what keeps them frame-identical.
 */
export const backdropCycle = makeMutable(0);

/**
 * `backdropScroll`, chased rather than tracked — the lag is what separates the
 * backdrop's plane from the content's. Damped centrally for the same reason the
 * cycle is: a canvas mounting mid-push must not start its chase from zero and
 * slide the field into place while the screen it is replacing holds it still.
 */
export const backdropShift = makeMutable(0);

/**
 * The screen, in points. A shared value rather than a closed-over prop: the
 * frame callback that reads it is registered once, so a rotation has to reach it
 * through something it re-reads every frame.
 */
export const backdropResolution = makeMutable<[number, number]>([0, 0]);

/** The shader's inputs. Shaped exactly as the SkSL declares them. */
export type BackdropUniforms = {
  resolution: [number, number];
  cycle: number;
  scroll: number;
  focus: [number, number];
  bandA: [number, number, number];
  bandB: [number, number, number];
  bandC: [number, number, number];
  ground: [number, number, number];
};

/**
 * The uniforms themselves, built once per frame by the driver.
 *
 * Every screen draws the field, so a canvas that assembled its own would
 * allocate one of these per screen per frame — and the screens that are mounted
 * but not on show would pay it too. Built centrally, the cost is one object a
 * frame no matter how deep the stack is.
 */
export const backdropUniforms = makeMutable<BackdropUniforms>({
  resolution: [0, 0],
  cycle: 0,
  scroll: 0,
  focus: [0.5, 0.42],
  bandA: [0, 0, 0],
  bandB: [0, 0, 0],
  bandC: [0, 0, 0],
  ground: [0, 0, 0],
});

/** Where the light is pulled towards, normalised across the screen. */
export const backdropTouchX = makeMutable(0.5);
export const backdropTouchY = makeMutable(0.42);

/** Spring shared by both touch axes, so the light moves as one point. */
const TOUCH_SPRING = { damping: 26, stiffness: 40, mass: 1.1 } as const;

/**
 * Feeds a scroll position in. Safe to call from a worklet or the JS thread.
 *
 * The value is not smoothed here: the shader damps it, and a spring on top
 * would fight that damping and make the field feel loose.
 */
export function reportBackdropScroll(offset: number) {
  'worklet';
  backdropScroll.value = offset;
}

/**
 * Draws the light towards a point. Sprung rather than set, so a tap pulls the
 * field over instead of teleporting it.
 */
export function reportBackdropTouch(x: number, y: number) {
  'worklet';
  backdropTouchX.value = withSpring(x, TOUCH_SPRING);
  backdropTouchY.value = withSpring(y, TOUCH_SPRING);
}
