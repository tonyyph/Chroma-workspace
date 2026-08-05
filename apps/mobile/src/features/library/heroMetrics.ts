/**
 * Geometry shared by the landing carousel and the screen that lays it out.
 *
 * The peek has to match the screen gutter exactly, or the resting slide is
 * a few points off the alignment every other block on the screen sits on and
 * the whole column looks bent.
 */
import { space } from '@chromawave/design-tokens';

export const HERO_HEIGHT = 222;
export const HERO_PEEK = space.gutter;
