/**
 * Geometry shared by the landing carousel and the screen that lays it out.
 *
 * The peek has to match the screen gutter exactly, or the resting slide is
 * a few points off the alignment every other block on the screen sits on and
 * the whole column looks bent.
 */
import { space } from '@chromawave/design-tokens';

/**
 * A fifth shorter than it was.
 *
 * At 222 the carousel was the tallest thing on the screen and read as the
 * headline; the archive underneath it is the headline. 178 keeps a slide
 * legible — eyebrow, title, body and a button still fit — while making it
 * plainly a suggestion rather than the main event.
 */
export const HERO_HEIGHT = 178;
export const HERO_PEEK = space.gutter;
