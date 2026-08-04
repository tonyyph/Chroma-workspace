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
 * They are deliberately global. There is one backdrop for the whole app, living
 * behind the navigator, so there is one thing to drive.
 */

/** Cumulative scroll offset, in points, of whatever list is in front. */
export const backdropScroll = makeMutable(0);

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
