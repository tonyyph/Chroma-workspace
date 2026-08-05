/**
 * The geometry of the ambient field, kept in TypeScript so the one property it
 * must have can be tested.
 *
 * **Seamless looping is an arithmetic condition, not a matter of taste.** The
 * clock runs 0 → 1 and restarts. A mass positioned by `sin(k · t · 2π)` returns
 * to exactly where it started only when `k` is a whole number — and its
 * *velocity* matches too, so there is no visible flick at the wrap either.
 *
 * A previous version used ratios like 0.61 and 0.29 on the theory that
 * non-repeating frequencies make a richer composition. They do, but they also
 * guarantee a discontinuity every lap: at the wrap those two alone jumped 0.64
 * and 0.97 of a full swing. The richness has to come from combining whole
 * harmonics with different phases instead.
 */

export type Harmonic = {
  /** Whole-number frequency on each axis. Anything else breaks the loop. */
  fx: number;
  fy: number;
  /** Phase offsets, in turns. These are free — they shift, never break, a loop. */
  px: number;
  py: number;
  /** Where the mass sits, and how far it wanders. */
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  /** Falloff radius, and how strongly scroll drags it. */
  radius: number;
  drag: number;
};

/**
 * Four masses. Frequencies stay in 1-3: high enough that movement is plainly
 * visible within a few seconds, low enough that nothing darts.
 */
export const HARMONICS: readonly Harmonic[] = [
  { fx: 1, fy: 2, px: 0.0, py: 0.25, cx: 0.3, cy: 0.26, ax: 0.19, ay: 0.15, radius: 0.6, drag: 1 },
  {
    fx: 2,
    fy: 1,
    px: 0.35,
    py: 0.6,
    cx: 0.72,
    cy: 0.44,
    ax: 0.2,
    ay: 0.17,
    radius: 0.54,
    drag: 1.7,
  },
  {
    fx: 3,
    fy: 2,
    px: 0.7,
    py: 0.1,
    cx: 0.44,
    cy: 0.76,
    ax: 0.17,
    ay: 0.14,
    radius: 0.64,
    drag: 2.4,
  },
  {
    fx: 1,
    fy: 3,
    px: 0.5,
    py: 0.8,
    cx: 0.6,
    cy: 0.14,
    ax: 0.22,
    ay: 0.12,
    radius: 0.46,
    drag: 0.6,
  },
];

/** Every frequency that has to be whole for the loop to close. */
export const loopFrequencies = (): number[] => HARMONICS.flatMap(({ fx, fy }) => [fx, fy]);

/**
 * A mass's offset from its centre at a point in the cycle, in turns (0-1).
 * Mirrors the shader exactly, so the loop can be checked without a GPU.
 */
export function offsetAt(harmonic: Harmonic, cycle: number): { x: number; y: number } {
  const TAU = Math.PI * 2;
  return {
    x: Math.sin((cycle * harmonic.fx + harmonic.px) * TAU) * harmonic.ax,
    y: Math.cos((cycle * harmonic.fy + harmonic.py) * TAU) * harmonic.ay,
  };
}
