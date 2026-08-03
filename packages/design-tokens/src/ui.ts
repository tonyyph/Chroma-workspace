/**
 * Chroma Wave app UI system.
 *
 * Source: `Chroma Wave App.dc.html` — SYSTEM F · UI SYSTEM & SPECS,
 * APP UI · 390×844 · iOS FIRST · V1 · JUL 2026. Values are transcribed from that
 * section and from the measured screens, so a surface built only from these
 * tokens lands on the design without per-screen magic numbers.
 */

/* ------------------------------------------------------------------ colour */

/**
 * SEMANTIC TOKENS. The guardrail from the sheet — "never pure #000 or #FFF as
 * ground" — is why `bg.base` is #08070E and `text.primary` is #EDEAE3.
 */
export const ui = {
  bg: {
    base: '#08070E',
    sheet: '#100E1C',
    raised: '#171233',
    media: '#241F3D',
  },
  action: {
    primary: '#7C5CFF',
    primaryHover: '#8F73FF',
    primaryActive: '#6A49F0',
    /** Disabled primary keeps its hue at 35% rather than going grey. */
    primaryDisabled: 'rgba(124,92,255,.35)',
    onPrimary: '#FFFFFF',
    onPrimaryDisabled: 'rgba(255,255,255,.55)',
    /** "Contrast" button: bone on ink. */
    contrast: '#EDEAE3',
    contrastHover: '#FFFFFF',
    onContrast: '#0C0B18',
    link: '#B79CFF',
    linkHover: '#D9C9FF',
  },
  accent: {
    info: '#22D3EE',
    /** Text-weight cyan — the raw accent fails contrast on ink at body size. */
    infoText: '#7FE9F5',
    signal: '#FF7A5C',
    signalText: '#FFB49F',
    warm: '#FFC24A',
  },
  /** "success uses accent/info · destructive #FF6B5A" */
  status: {
    success: '#22D3EE',
    successText: '#7FE9F5',
    danger: '#FF6B5A',
    dangerText: '#FFB49F',
  },
  text: {
    primary: '#EDEAE3',
    secondary: 'rgba(237,234,227,.62)',
    tertiary: 'rgba(237,234,227,.45)',
    /** For meta rows that sit under a title. */
    quaternary: 'rgba(237,234,227,.3)',
    onLight: '#0C0B18',
  },
  /** "border/hairline rgba(237,234,227,.09–.14)" — the range, both ends named. */
  border: {
    hairline: 'rgba(237,234,227,.09)',
    hairlineStrong: 'rgba(237,234,227,.14)',
    control: 'rgba(237,234,227,.2)',
    dashed: 'rgba(237,234,227,.22)',
  },
  /** Card and chip fills are alpha over the ground, not opaque greys. */
  fill: {
    card: 'rgba(237,234,227,.04)',
    chip: 'rgba(237,234,227,.06)',
    chipGhost: 'rgba(237,234,227,.03)',
    track: 'rgba(237,234,227,.12)',
    toggleOff: 'rgba(237,234,227,.16)',
  },
  overlay: 'rgba(8,7,14,.6)',
  /** Glass containers over a live camera feed need a heavier ground. */
  scrim: {
    control: 'rgba(8,7,14,.55)',
    panel: 'rgba(8,7,14,.62)',
    strong: 'rgba(8,7,14,.72)',
  },
  tabBar: 'rgba(36, 32, 61, 0.92)',
} as const;

/** Tinted container recipes that recur across every flow. */
export const tint = {
  pro: {
    backgroundColor: 'rgba(124,92,255,.16)',
    borderColor: 'rgba(124,92,255,.4)',
    color: '#B79CFF',
  },
  info: {
    backgroundColor: 'rgba(34,211,238,.16)',
    borderColor: 'rgba(34,211,238,.4)',
    color: '#7FE9F5',
  },
  infoSubtle: {
    backgroundColor: 'rgba(34,211,238,.1)',
    borderColor: 'rgba(34,211,238,.32)',
    color: '#7FE9F5',
  },
  danger: {
    backgroundColor: 'rgba(255,107,90,.1)',
    borderColor: 'rgba(255,107,90,.36)',
    color: '#FFB49F',
  },
  signal: {
    backgroundColor: 'rgba(255,122,92,.14)',
    borderColor: 'rgba(255,122,92,.4)',
    color: '#FFB49F',
  },
} as const;

/* -------------------------------------------------------------------- type */

export const fontFamily = {
  regular: 'SpaceGrotesk_400Regular',
  medium: 'SpaceGrotesk_500Medium',
  semibold: 'SpaceGrotesk_600SemiBold',
  bold: 'SpaceGrotesk_700Bold',
  monoRegular: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
  monoSemibold: 'IBMPlexMono_600SemiBold',
} as const;

/**
 * TYPE SCALE · SPACE GROTESK. Tracking is given in em on the sheet and resolved
 * to points here (RN takes absolute letterSpacing): Display −3% of 32 = −0.96,
 * Title −2.5% of 28 = −0.7, Section −2% of 20 = −0.4, Meta +14% of 10 = 1.4.
 */
export const type = {
  /** Display 32/34 · SemiBold −3% */
  display: {
    fontFamily: fontFamily.semibold,
    fontSize: 32,
    lineHeight: 34,
    letterSpacing: -0.96,
  },
  /** Title 28/32 · screen headers */
  title: {
    fontFamily: fontFamily.semibold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.7,
  },
  /** Section 20/26 · sheets, cards */
  section: {
    fontFamily: fontFamily.semibold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  /** Row title 15/20 · list items */
  rowTitle: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0,
  },
  /** Body 14/21 · Regular */
  body: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0,
  },
  /** META 10 · MONO · +14% TRACK. Always rendered upper case. */
  meta: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 1.4,
  },
} as const;

/** Sizes that appear inside components rather than as page-level roles. */
export const typeExtra = {
  /** Onboarding headline — 30-32px at 1.12 leading. */
  headline: { fontFamily: fontFamily.semibold, fontSize: 30, lineHeight: 34, letterSpacing: -0.9 },
  /** Card titles in grids and rows. */
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: 13.5, lineHeight: 17, letterSpacing: 0 },
  /** Button label. */
  button: { fontFamily: fontFamily.semibold, fontSize: 15, lineHeight: 18, letterSpacing: 0 },
  buttonLarge: { fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 19, letterSpacing: 0 },
  /** Chip / pill label — mono, tighter track than meta. */
  chip: { fontFamily: fontFamily.monoSemibold, fontSize: 10, lineHeight: 13, letterSpacing: 0.6 },
  /** Hex values and numeric readouts. */
  mono: { fontFamily: fontFamily.monoMedium, fontSize: 11, lineHeight: 15, letterSpacing: 0 },
  monoSmall: { fontFamily: fontFamily.monoMedium, fontSize: 9, lineHeight: 13, letterSpacing: 0 },
  /** Section eyebrows — "LIVE READ", "SUGGESTED FIX". */
  eyebrow: {
    fontFamily: fontFamily.monoSemibold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: 1.5,
  },
} as const;

/* ---------------------------------------------------------- space & shape */

/** "grid 4pt · gutter 20 · card gap 14 · section gap 22" */
export const space = {
  grid: 4,
  xxs: 4,
  xs: 8,
  sm: 12,
  cardGap: 14,
  md: 16,
  gutter: 20,
  sectionGap: 22,
  lg: 26,
  xl: 34,
} as const;

/** "radius: chip 11 · card 18 · sheet 28 · pill 27 · icon tile 22.5%" */
export const round = {
  chip: 11,
  swatch: 12,
  control: 14,
  card: 18,
  media: 22,
  sheet: 28,
  pill: 27,
  /** Superellipse approximation for the app-icon tile, as a fraction of size. */
  iconTileRatio: 0.225,
  full: 999,
} as const;

/** "hit target ≥44 · shutter 84 · tab bar 66 · status bar 54" */
export const size = {
  hitTarget: 44,
  shutter: 84,
  tabBar: 66,
  statusBar: 54,
  /** Button heights measured across the screens. */
  buttonSm: 46,
  button: 50,
  buttonMd: 54,
  buttonLg: 56,
  field: 46,
  toggleWidth: 46,
  toggleHeight: 28,
  toggleKnob: 22,
  sliderTrack: 10,
  sliderThumb: 24,
  /** The mark, centred in the tab bar. */
  tabMark: 56,
  /** Navigation icon and its selected pill inside the floating tab bar. */
  tabIcon: 20,
  tabIconSurfaceWidth: 38,
  tabIconSurfaceHeight: 32,
  tabItem: 54,
  grabberWidth: 44,
  grabberHeight: 5,
  /**
   * Icon sizes, set against the type scale rather than the icon grid: `inline`
   * matches the 10px mono chip's cap height, `control` the 14px row label, and
   * `action` the 40pt circular buttons in a nav row.
   */
  iconInline: 13,
  iconControl: 17,
  iconAction: 20,
  /** "band strips keep 10px minimum height" at Dynamic Type XXL. */
  bandStripMin: 10,
} as const;

/* ------------------------------------------------------------------ motion */

/**
 * BUILD KIT · 01 · MOTION LANGUAGE.
 *
 * "One principle: light travels, glass stays. Bands move; the container never
 * bounces, spins, or scales. Nothing in the product uses a spinner."
 */

/** DURATION TOKENS, verbatim. Every animated value picks one of these eight. */
export const duration = {
  /** press feedback */
  instant: 60,
  /** toggles, chips */
  quick: 120,
  /** tabs, fades */
  base: 180,
  /** cards, toasts */
  enter: 240,
  /** modals, sheets */
  sheet: 320,
  /** full-screen push */
  scene: 480,
  /** band sweep */
  loop: 1100,
  /** splash total */
  launch: 1480,
} as const;

/** EASING CURVES, as cubic-bezier control points. */
export const easing = {
  standard: [0.32, 0.72, 0, 1],
  exit: [0.4, 0, 1, 1],
  sweep: [0.16, 1, 0.3, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

/**
 * The five rules from the sheet, as values rather than prose so they can be
 * asserted. `bandDirection` is here because "Bands always travel left → right.
 * Reversal only signals undo" is a correctness rule, not a preference.
 */
export const motionRules = {
  bandDirection: 'ltr',
  reversalMeans: 'undo',
  /** "Stagger siblings 60ms, cap the chain at 5 items; the rest appear together." */
  stagger: 60,
  staggerCap: 5,
  /**
   * "Never animate hue and luminance at once — colour changes cross-fade, they
   * don't tween through mud."
   */
  colourChange: 'cross-fade',
  /**
   * "Reduce-motion: every sweep becomes a static three-band bar; durations drop
   * to 0 except opacity at 120ms."
   */
  reducedMotion: { duration: 0, opacityDuration: 120 },
  /** "60fps or it doesn't ship." Blur runs on the GPU, never re-rendered per frame. */
  targetFps: 60,
} as const;

/**
 * Named animations, each pinned to a duration token. Loop timings come from
 * BUILD KIT · 03 · LIVE LOOPS, which specifies them to the millisecond.
 */
export const uiMotion = {
  sheetPresent: { duration: duration.sheet, easing: easing.standard },
  tabSwitch: { duration: duration.base, rise: 4 },
  scenePush: { duration: duration.scene, easing: easing.standard },
  /** "1100ms · alternate · replaces every spinner" */
  bandSweep: { duration: duration.loop, easing: easing.sweep, alternate: true },
  /** "1400ms · linear · violet at 22%, never white" */
  shimmer: { duration: 1400, easing: 'linear', tint: 'rgba(124,92,255,.22)' },
  /** "1200ms · 200ms stagger · viewfinder confidence" */
  livePulse: { duration: 1200, stagger: 200, minOpacity: 0.35, minScale: 0.94 },
  /** "1600ms · linear · the only rotating element in the app" */
  syncOrbit: { duration: 1600, easing: 'linear' },
  /** "shutter press: scale .94 · 90ms · impact-medium haptic" */
  shutterPress: { scale: 0.94, duration: 90 },
  /** "palette saved: success haptic + toast 2.4s, undo persists 6s" */
  toast: { duration: 2400, undoWindow: 6000 },
  /** "list item press: opacity .7 · 60ms, no scale" */
  listPress: { opacity: 0.7, duration: duration.instant },
} as const;

/**
 * BUILD KIT · 02 · FRAME STORYBOARDS. Four sequences given frame by frame,
 * each with a timestamp, a property and a curve.
 */
export const storyboard = {
  /** "Cold launch · 1480ms · LOTTIE + NATIVE FALLBACK" */
  launch: {
    total: duration.launch,
    seedDot: { at: 0, from: 0, to: 1, property: 'scale', easing: easing.standard },
    band1: { at: 180, from: '-40%', to: '0%', property: 'translateX', easing: easing.sweep },
    bands23: { at: 420, stagger: 80, easing: easing.sweep },
    glassClip: { at: 760, from: 0, to: 360, property: 'radius', duration: duration.sheet },
    wordmark: { at: 1080, rise: 8, property: 'opacity+translateY' },
    handoff: { at: 1480, crossFade: 200 },
  },
  /** "Capture → extraction → result · 1240ms · NATIVE ONLY" */
  capture: {
    total: 1240,
    shutter: { at: 0, scale: 0.94, duration: 90, haptic: 'impactMedium' },
    freeze: { at: 120, flashOpacity: 0.08, duration: 100 },
    scanSweep: { at: 300, duration: 620 },
    swatchesDrop: { at: 620, stagger: motionRules.stagger, easing: easing.standard },
    sheetRise: { at: 920, from: '100%', to: '0%', duration: duration.sheet },
    settled: { at: 1240, haptic: 'notificationSuccess' },
  },
  /** "Save confirmation · 640ms" */
  save: {
    total: 640,
    tap: { at: 0 },
    converge: { at: 160 },
    check: { at: 380 },
    toast: { at: 640 },
  },
  /** "Pull to refresh · DRAG-DRIVEN" — bands reveal by drag distance, in points. */
  pullRefresh: {
    oneBand: 0,
    twoBands: 40,
    threeBands: 70,
    /** "70pt · three · haptic" then release into the 1100ms loop. */
    triggerAt: 70,
    haptic: 'impactLight',
    loop: duration.loop,
  },
} as const;

/**
 * BUILD KIT · 04 · RUNTIME BUDGET. Enforced by review rather than by the type
 * system, but recorded here so the numbers live with the code they govern.
 */
export const motionBudget = {
  launchBytesMax: 48 * 1024,
  loopBytesMax: 20 * 1024,
  /** "never more than 2 concurrent loops on screen" */
  concurrentLoopsMax: 2,
  /** "drop to poster frame under 30fps for 2 consecutive seconds" */
  degradeBelowFps: 30,
  degradeAfterMs: 2000,
  /** "splash budget: first frame < 400ms from process start" */
  firstFrameMs: 400,
} as const;

export const uiShadow = {
  /** Sliders and pin markers. */
  thumb: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  /** The mark in the tab bar. */
  mark: {
    shadowColor: '#7C5CFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 12,
  },
  /** Separates the floating navigation shell from scrolling artwork beneath it. */
  tabBar: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 16,
  },
  /** A bounded glow that makes the selected destination legible at a glance. */
  tabActive: {
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 5,
  },
  sheet: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 30 },
    shadowOpacity: 0.5,
    shadowRadius: 70,
    elevation: 20,
  },
} as const;

export const uiLayer = {
  base: 0,
  content: 10,
  sticky: 20,
  navigation: 30,
  sheet: 40,
  overlay: 50,
  toast: 60,
} as const;
