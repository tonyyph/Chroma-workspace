/**
 * CHROMAWAVE brand identity system.
 *
 * Source: `CHROMAWAVE Identity.dc.html` — BRAND & ICON SYSTEM · V1 · JUL 2026.
 * Two of the eight explored icon territories ship: 01 Bandwave (recommended, 73/80)
 * and 07 Liquid Lens (55/80, premium material direction). The user picks between them
 * in Settings; the raster assets are produced by `@chromawave/brand-assets`.
 */

export type BrandIdentityId = 'bandwave' | 'liquid-lens';

export type BrandIdentity = {
  readonly id: BrandIdentityId;
  /** Concept number on the exploration board. */
  readonly conceptNumber: string;
  readonly name: string;
  readonly designation: string;
  /** Spectral order, cool -> warm. Bandwave runs four bands, Liquid Lens three. */
  readonly bands: readonly string[];
  readonly field: {
    readonly darkTop: string;
    readonly darkBase: string;
    readonly lightTop: string;
    readonly lightBase: string;
  };
  /**
   * Phase 05, ADJUST BEFORE PRODUCTION: "Cap user-recolouring to bands 2-4; band 1
   * stays violet so the mark is never unrecognisable." Indices into `bands`.
   */
  readonly recolourableBands: readonly number[];
  /**
   * `CFBundleAlternateIcons` key, or `null` for the build's default icon.
   * Consumed by `expo-alternate-app-icons`.
   */
  readonly alternateIconName: string | null;
  /** Whether the concept's native field is light — drives the launch sequence ground. */
  readonly nativeField: 'dark' | 'light';
  /** Size at or below which the separate simplified cut must be used. */
  readonly simplifiedAtOrBelow: number;
};

export const brandIdentities = {
  bandwave: {
    id: 'bandwave',
    conceptNumber: '01',
    name: 'Bandwave',
    designation: 'FLAT GEOMETRIC · DIR. A',
    bands: ['#7C5CFF', '#22D3EE', '#FF6B5A', '#FFC24A'],
    field: {
      darkTop: '#0B0918',
      darkBase: '#1B1140',
      lightTop: '#F5F2EC',
      lightBase: '#E8E2D6',
    },
    recolourableBands: [1, 2, 3],
    alternateIconName: null,
    nativeField: 'dark',
    simplifiedAtOrBelow: 87,
  },
  'liquid-lens': {
    id: 'liquid-lens',
    conceptNumber: '07',
    name: 'Liquid Lens',
    designation: 'GLASS REFRACTION · DIR. H',
    bands: ['#7C5CFF', '#22D3EE', '#FF7A5C'],
    field: {
      darkTop: '#161327',
      darkBase: '#0C0B18',
      lightTop: '#EDE8F4',
      lightBase: '#DCD4EC',
    },
    recolourableBands: [1, 2],
    alternateIconName: 'LiquidLens',
    nativeField: 'light',
    simplifiedAtOrBelow: 87,
  },
} as const satisfies Record<BrandIdentityId, BrandIdentity>;

export const brandIdentityIds = ['bandwave', 'liquid-lens'] as const;

/** The identity document's recommendation: "01 Bandwave, with Chroma Signal as the secondary mark". */
export const defaultBrandIdentity: BrandIdentityId = 'bandwave';

/**
 * ASSET SYSTEM · B — Splash & launch motion. "Total 1560ms, no logo hold.
 * Signal -> pulse -> wave -> refraction -> interface."
 */
export const launchSequence = {
  totalDuration: 1560,
  /** Storyboard keyframes, in ms from first paint. */
  frames: {
    signal: 0,
    firstPulse: 120,
    secondPulse: 280,
    unroll: 460,
    split: 700,
    spread: 980,
    settle: 1240,
    reveal: 1560,
  },
  /** TIMING & EASING, verbatim from the document. */
  timing: {
    pulse: { from: 0, to: 280, easing: [0.2, 0.8, 0.2, 1] as const },
    unroll: { from: 280, to: 700, spring: { stiffness: 210, damping: 22 } },
    spread: { from: 700, to: 1240, easing: [0.65, 0, 0.35, 1] as const },
    reveal: { from: 1240, to: 1560, spring: { stiffness: 260, damping: 26 } },
  },
  /** "reduced motion -> static frame 08, 180ms fade" */
  reducedMotionFade: 180,
} as const;

/** MOTION IDENTITY PRINCIPLES — budgets that apply to every branded animation. */
export const brandMotion = {
  microInteractionMax: 300,
  sceneTransition: { min: 400, max: 700 },
  splash: 1560,
  /** "Energy comes from elements arriving 40-80ms apart, not from overshoot." */
  phaseOffset: { min: 40, max: 80 },
  maxSpringOvershoot: 0.04,
  /** "One ambient loop per screen at <=0.3 amplitude." */
  ambientAmplitudeMax: 0.3,
  reducedMotionCrossfade: 160,
} as const;
