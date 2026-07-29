/**
 * CHROMAWAVE brand.
 *
 * Source: `CHROMAWAVE Final Concept.dc.html` — CONCEPT 07 · CHROMA SIGNAL · V1 · JUL 2026,
 * marked FINAL · LOCKED. One mark: a soft glass squircle carrying three refracted
 * chroma bands. There are no alternates and no fallback concepts; the raster
 * assets are produced by `@chromawave/brand-assets` from the same geometry.
 */

/** Section 04 · Colour. Band order is violet → cyan → coral and is not reorderable. */
export const brandColors = {
  violet: '#7C5CFF',
  cyan: '#22D3EE',
  coral: '#FF7A5C',
  glass: '#EDE8F4',
  glassDeep: '#DCD4EC',
  surface: '#161327',
  ink: '#0C0B18',
} as const;

/** The three chroma bands, in band order. */
export const brandBands = [brandColors.violet, brandColors.cyan, brandColors.coral] as const;

/**
 * Section 01 · The mark. A 1024 master; every derived size is a scale of this.
 * `safeInset` is the 12% margin that keeps iOS corner clipping off the bands.
 */
export const brandGeometry = {
  master: 1024,
  radius: 360,
  /** Superellipse exponent — n=4. */
  exponent: 4,
  safeInset: 123,
  /** Band midlines on the master, 106px apart. */
  midlines: [430, 536, 626],
  amplitudes: [74, 74, 66],
  strokeWidths: [96, 96, 88],
  /** Phase shift between adjacent bands, in radians. */
  phaseStep: 1.1,
  cycles: 0.85,
  /** Blur σ at the 1024 master; scale with size. */
  blurSigma: 44,
  /** iOS superellipse corner ratio, for in-app tiles that mimic the home screen icon. */
  cornerRatio: 0.225,
} as const;

/**
 * Section 03 · Adaptive rule. Below this size the blurred master muddies, so the
 * two-band SMALL cut is mandatory — "Blur at 29px muddies — SMALL variant is
 * mandatory, not optional."
 */
export const smallMarkAtOrBelow = 40;

/**
 * Section 06 · Splash & launch motion. "1480ms total, no logo hold.
 * Signal → bands → glass forms → refraction settles → interface."
 */
export const launchSequence = {
  totalDuration: 1480,
  /** Storyboard keyframes, in ms from first paint. */
  frames: {
    seedDot: 0,
    firstBand: 180,
    threeBands: 420,
    glassClipsIn: 760,
    wordmark: 1080,
    handoff: 1480,
  },
  /** Timing and easing, verbatim from the motion spec block. */
  timing: {
    dot: { duration: 180, property: 'scale', from: 0, to: 1, easing: [0.2, 0.9, 0.2, 1] as const },
    bands: {
      duration: 240,
      stagger: 80,
      property: 'translateX',
      from: '-40%',
      to: '0%',
      easing: [0.16, 1, 0.3, 1] as const,
    },
    glassMask: {
      duration: 320,
      property: 'radius',
      from: 0,
      to: 360,
      easing: [0.65, 0, 0.35, 1] as const,
    },
    wordmark: { duration: 220, rise: 8, easing: 'ease-out' as const },
    crossFade: { duration: 200 },
  },
} as const;

/** Motion budgets that apply to every branded animation. */
export const brandMotion = {
  microInteractionMax: 300,
  sceneTransition: { min: 400, max: 700 },
  splash: launchSequence.totalDuration,
  /** Energy comes from elements arriving 40-80ms apart, not from overshoot. */
  phaseOffset: { min: 40, max: 80 },
  maxSpringOvershoot: 0.04,
  ambientAmplitudeMax: 0.3,
  reducedMotionCrossfade: 160,
} as const;
