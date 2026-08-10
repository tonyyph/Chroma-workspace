import { elevation, glass, round, tint, type, typeExtra, ui, uiShadow } from './ui';

/**
 * Two complete looks over one set of components.
 *
 * The app has always had exactly one appearance baked into its tokens, which
 * every primitive imported at module scope. That is the right shape for a
 * product with one look and the wrong one the moment there are two, because an
 * ES import cannot change at runtime.
 *
 * A skin is therefore every *value* a component reads, gathered into one object
 * that can be swapped. Nothing structural moves: the same `Card` renders in both
 * skins, and the difference is what it is told a card looks like.
 *
 * **The two are not variations on each other.** `chroma` is the app as designed
 * — an instrument in a dark room, a violet field drifting behind everything,
 * glass surfaces, soft depth. `swiss` is the opposite premise: paper, black ink,
 * one signal red, square corners, no depth at all, structure carried by rules
 * and labels instead of by shadow. A skin that only changed the accent colour
 * would not have been worth an architecture.
 */

/** Widens the `as const` literals so a second skin can supply its own values. */
type Loosen<T> = {
  -readonly [Key in keyof T]: T[Key] extends string
    ? string
    : T[Key] extends number
      ? number
      : Loosen<T[Key]>;
};

export type SkinId = 'chroma' | 'swiss';

/**
 * Decisions a skin makes that are not a value.
 *
 * These exist because some differences cannot be expressed as a colour. Swiss
 * does not draw the ambient field at all — a drifting metaball wash under a
 * paper ground is not a quieter version of the same idea, it is the wrong idea —
 * and no combination of token values says "do not render that component".
 */
export type SkinChrome = {
  /** Draw the ambient field behind every screen. */
  backdrop: boolean;
  /** Blur surfaces, or paint them flat. */
  glass: boolean;
  /** Soft depth. When false, separation comes from rules. */
  depth: boolean;
  /** Rules between rows and under section heads. */
  rules: boolean;
  /** Upper-case section heads and control labels. */
  shout: boolean;
};

/**
 * A gradient, as the two things `LinearGradient` needs and nothing else.
 *
 * Screens spread this rather than naming stops, so a skin can change how many
 * stops a role has without every call site learning about it.
 */
export type GradientRole = {
  colors: readonly [string, string, ...string[]];
  locations?: readonly [number, number, ...number[]];
};

/**
 * How much of a surface a readability scrim covers.
 *
 * Weight rather than colour: a screen knows it needs the foot of an image dark
 * enough to carry a title, and has no business knowing whether "dark" means
 * near-black or near-paper. `soft` is a band at the very edge; `full` reaches
 * most of the way up.
 */
export type ScrimWeight = 'soft' | 'medium' | 'strong' | 'full';

/**
 * The gradients and washes a screen is allowed to ask for.
 *
 * Everything here exists because a screen previously wrote a literal
 * `rgba(8,7,14,…)` — which is chroma's ground, and meaningless under a paper
 * one. Roles are named for what they are *for*, so swiss can answer the same
 * question with a completely different shape: where chroma dissolves over half
 * a surface, swiss cuts at a hard stop, because a precise transition is the
 * Swiss answer to the same problem.
 *
 * Deliberately small. If a screen needs something outside these five roles, the
 * right move is to question the screen, not to add a sixth.
 */
export type SkinEffects = {
  /** Foot of a surface, so overlaid copy reads over arbitrary content. */
  scrimBottom: (weight: ScrimWeight) => GradientRole;
  /** Head of a surface, for chrome floating over content. */
  scrimTop: (weight: ScrimWeight) => GradientRole;
  /** Transparent to the page's own ground: bars, and heroes dissolving out. */
  fadeToGround: GradientRole;
  /** A whole screen's ground treatment. Flat in a skin that does not wash. */
  screenWash: GradientRole;
  /** A decorative plate behind a preview or a mock. */
  surfaceWash: GradientRole;
};

export type Skin = {
  id: SkinId;
  ui: Loosen<typeof ui>;
  tint: Loosen<typeof tint>;
  round: Loosen<typeof round>;
  elevation: Loosen<typeof elevation>;
  glass: Loosen<typeof glass>;
  shadow: Loosen<typeof uiShadow>;
  type: Loosen<typeof type & typeof typeExtra>;
  chrome: SkinChrome;
  effects: SkinEffects;
};

/* ------------------------------------------------------------------ chroma */

/**
 * Chroma's own values, lifted verbatim from the screens that held them.
 *
 * Four weights rather than three because four distinct scrims existed in the
 * app and collapsing them would have changed what those screens look like.
 * `medium` and `strong` are exact transcriptions of the ribbon's and the
 * palette hero's; `full` is the carousel's; `soft` is the one new value, for
 * the You signature, whose original started at 15% rather than transparent.
 */
const chromaScrim = (weight: ScrimWeight): GradientRole => {
  switch (weight) {
    case 'soft':
      return { colors: ['rgba(8,7,14,0)', 'rgba(8,7,14,.55)'], locations: [0.45, 1] };
    case 'medium':
      return { colors: ['rgba(8,7,14,0)', 'rgba(8,7,14,.78)'], locations: [0.42, 1] };
    case 'strong':
      return {
        colors: ['rgba(8,7,14,0)', 'rgba(8,7,14,.35)', 'rgba(8,7,14,.88)'],
        locations: [0, 0.45, 1],
      };
    case 'full':
      return {
        colors: ['rgba(8,7,14,0)', 'rgba(8,7,14,.58)', 'rgba(8,7,14,.92)'],
        locations: [0, 0.45, 1],
      };
  }
};

/** The same ramp read from the other end. */
const flip = (role: GradientRole): GradientRole => ({
  colors: [...role.colors].reverse() as unknown as GradientRole['colors'],
  ...(role.locations
    ? {
        locations: role.locations.map((stop) => 1 - stop).reverse() as unknown as NonNullable<
          GradientRole['locations']
        >,
      }
    : {}),
});

const chromaEffects: SkinEffects = {
  scrimBottom: chromaScrim,
  scrimTop: (weight) => flip(chromaScrim(weight)),
  fadeToGround: {
    colors: ['rgba(8,7,14,0)', 'rgba(18, 17, 25, 0.94)'],
    locations: [0, 0.4],
  },
  screenWash: { colors: ['#241C4A', ui.bg.base], locations: [0, 0.62] },
  surfaceWash: { colors: ['#2A2352', '#0C0B18'], locations: [0, 1] },
};

const chroma: Skin = {
  id: 'chroma',
  ui,
  tint,
  round,
  elevation,
  glass,
  shadow: uiShadow,
  type: { ...type, ...typeExtra },
  chrome: { backdrop: true, glass: true, depth: true, rules: false, shout: true },
  effects: chromaEffects,
};

/* ------------------------------------------------------------------- swiss */

/** Paper, never pure white — the same rule the dark ground follows in reverse. */
const PAPER = '#F2F1EE';
const INK = '#101010';
/** The one accent. Everything that is not ink or paper is this or a tint of it. */
const SIGNAL = '#E8320C';

const ink = (alpha: number) => `rgba(16,16,16,${alpha})`;
const paper = (alpha: number) => `rgba(242,241,238,${alpha})`;

/** Depth is not a Swiss idea. Every shadow in this skin is the absence of one. */
const NO_SHADOW = {
  shadowColor: 'transparent',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0,
  shadowRadius: 0,
  elevation: 0,
};

/**
 * Swiss answers the same questions with a different instrument.
 *
 * Not chroma's ramps with paper substituted for ink. A dark cinematic wash is
 * an argument about atmosphere; this skin's argument is about structure, so its
 * scrims are **short and decisive** — most of the surface is left alone and the
 * transition happens across a narrow band near the edge. `full` is the only one
 * that travels, and it still lands harder than its chroma counterpart.
 *
 * Reads toward paper rather than toward ink, which is what keeps overlaid copy
 * legible: `text.primary` is ink in this skin, so the ground beneath it has to
 * go light for the same reason chroma's goes dark.
 */
const swissScrim = (weight: ScrimWeight): GradientRole => {
  switch (weight) {
    case 'soft':
      return { colors: [paper(0), paper(0.82)], locations: [0.62, 1] };
    case 'medium':
      return { colors: [paper(0), paper(0.94)], locations: [0.58, 1] };
    case 'strong':
      // A hard edge rather than a fade: the transition is an event, not a haze.
      return { colors: [paper(0), paper(0.96), paper(0.98)], locations: [0.5, 0.62, 1] };
    case 'full':
      return { colors: [paper(0), paper(0.9), paper(0.99)], locations: [0.28, 0.66, 1] };
  }
};

const swissEffects: SkinEffects = {
  scrimBottom: swissScrim,
  scrimTop: (weight) => flip(swissScrim(weight)),
  // Cuts rather than dissolves: transparent until it is nearly at the bar, then
  // the page. The two-point gap is the hard rule this skin separates things with.
  fadeToGround: { colors: [paper(0), PAPER, PAPER], locations: [0.55, 0.62, 1] },
  // Flat. A screen-wide wash is a mood, and this skin does not do moods — the
  // API shape is kept so no screen has to ask which skin it is running under.
  screenWash: { colors: [PAPER, PAPER], locations: [0, 1] },
  // The one place a tone is allowed, and it is a paper-to-ink-tint step rather
  // than a colour: a plate that reads as a different sheet, not a gradient.
  surfaceWash: { colors: ['#E9E7E2', '#DEDCD6'], locations: [0, 1] },
};

const swiss: Skin = {
  id: 'swiss',
  ui: {
    bg: { base: PAPER, sheet: '#FFFFFF', raised: '#FFFFFF', media: '#DEDCD6' },
    action: {
      primary: SIGNAL,
      primaryHover: '#FF4A22',
      primaryActive: '#C7280A',
      primaryDisabled: 'rgba(232,50,12,.32)',
      onPrimary: '#FFFFFF',
      onPrimaryDisabled: 'rgba(255,255,255,.62)',
      // The inverse button is ink on paper rather than bone on ink.
      contrast: INK,
      contrastHover: '#000000',
      onContrast: PAPER,
      link: SIGNAL,
      linkHover: '#C7280A',
    },
    accent: {
      info: '#0B5FFF',
      infoText: '#0A45B8',
      signal: SIGNAL,
      signalText: '#B9250A',
      warm: '#A87500',
    },
    status: {
      success: '#0B7A3D',
      successText: '#08592C',
      danger: '#C7280A',
      dangerText: '#961D06',
    },
    text: {
      primary: INK,
      secondary: ink(0.64),
      tertiary: ink(0.46),
      quaternary: ink(0.32),
      onLight: INK,
    },
    // Rules carry the structure here, so they are drawn to be seen rather than
    // to be felt — roughly twice the weight of their counterparts on ink.
    border: {
      hairline: ink(0.16),
      hairlineStrong: ink(0.28),
      control: ink(0.42),
      dashed: ink(0.34),
    },
    fill: {
      card: ink(0.03),
      chip: ink(0.05),
      chipGhost: ink(0.02),
      track: ink(0.14),
      toggleOff: ink(0.2),
    },
    overlay: ink(0.42),
    // Over a live camera feed, which is the one place a light skin still needs
    // to hold its own against arbitrary content.
    scrim: { control: paper(0.84), panel: paper(0.9), strong: paper(0.95) },
    tabBar: 'rgba(255,255,255,.94)',
  },
  tint: {
    pro: {
      backgroundColor: 'rgba(232,50,12,.1)',
      borderColor: 'rgba(232,50,12,.4)',
      color: SIGNAL,
    },
    info: {
      backgroundColor: 'rgba(11,95,255,.1)',
      borderColor: 'rgba(11,95,255,.4)',
      color: '#0A45B8',
    },
    infoSubtle: {
      backgroundColor: 'rgba(11,95,255,.06)',
      borderColor: 'rgba(11,95,255,.24)',
      color: '#0A45B8',
    },
    danger: {
      backgroundColor: 'rgba(199,40,10,.1)',
      borderColor: 'rgba(199,40,10,.4)',
      color: '#961D06',
    },
    signal: {
      backgroundColor: 'rgba(232,50,12,.1)',
      borderColor: 'rgba(232,50,12,.4)',
      color: '#B9250A',
    },
  },
  // Square. The one exception is `full`, which draws circles rather than
  // rounding rectangles — a slider thumb is a dot in any design language.
  round: {
    chip: 0,
    swatch: 0,
    control: 0,
    card: 0,
    media: 0,
    sheet: 0,
    pill: 0,
    iconTileRatio: 0,
    full: 999,
  },
  elevation: {
    flat: { borderColor: ink(0.16), highlightColor: 'transparent', ...NO_SHADOW },
    raised: { borderColor: ink(0.22), highlightColor: 'transparent', ...NO_SHADOW },
    floating: { borderColor: ink(0.34), highlightColor: 'transparent', ...NO_SHADOW },
  },
  glass: {
    card: { intensity: 0, tint: '#FFFFFF' },
    shell: { intensity: 0, tint: paper(0.96) },
    control: { intensity: 0, tint: ink(0.04) },
  },
  shadow: {
    thumb: NO_SHADOW,
    mark: NO_SHADOW,
    tabBar: NO_SHADOW,
    tabActive: NO_SHADOW,
    sheet: NO_SHADOW,
  },
  /**
   * Denser and more spoken than chroma's.
   *
   * Every label, number and unit is mono, because this skin's argument is that
   * the app is an instrument and an instrument shows its readings. The
   * grotesque is kept for headlines and body only.
   */
  type: {
    hero: { fontFamily: type.hero.fontFamily, fontSize: 40, lineHeight: 38, letterSpacing: -1.2 },
    display: {
      fontFamily: type.display.fontFamily,
      fontSize: 28,
      lineHeight: 30,
      letterSpacing: -0.5,
    },
    title: { fontFamily: type.title.fontFamily, fontSize: 22, lineHeight: 26, letterSpacing: -0.3 },
    section: {
      fontFamily: typeExtra.chip.fontFamily,
      fontSize: 12,
      lineHeight: 16,
      letterSpacing: 1.4,
    },
    rowTitle: {
      fontFamily: type.rowTitle.fontFamily,
      fontSize: 13,
      lineHeight: 17,
      letterSpacing: 0,
    },
    body: { fontFamily: type.body.fontFamily, fontSize: 13, lineHeight: 19, letterSpacing: 0 },
    meta: { fontFamily: type.meta.fontFamily, fontSize: 9, lineHeight: 14, letterSpacing: 1.6 },
    headline: {
      fontFamily: typeExtra.headline.fontFamily,
      fontSize: 24,
      lineHeight: 28,
      letterSpacing: -0.4,
    },
    cardTitle: {
      fontFamily: typeExtra.cardTitle.fontFamily,
      fontSize: 12,
      lineHeight: 15,
      letterSpacing: 0,
    },
    button: {
      fontFamily: typeExtra.chip.fontFamily,
      fontSize: 12,
      lineHeight: 15,
      letterSpacing: 1.2,
    },
    buttonLarge: {
      fontFamily: typeExtra.chip.fontFamily,
      fontSize: 13,
      lineHeight: 16,
      letterSpacing: 1.2,
    },
    chip: {
      fontFamily: typeExtra.chip.fontFamily,
      fontSize: 9,
      lineHeight: 12,
      letterSpacing: 1.2,
    },
    mono: {
      fontFamily: typeExtra.mono.fontFamily,
      fontSize: 10,
      lineHeight: 14,
      letterSpacing: 0.4,
    },
    monoSmall: {
      fontFamily: typeExtra.monoSmall.fontFamily,
      fontSize: 8,
      lineHeight: 12,
      letterSpacing: 0.4,
    },
    eyebrow: {
      fontFamily: typeExtra.eyebrow.fontFamily,
      fontSize: 9,
      lineHeight: 12,
      letterSpacing: 1.6,
    },
  },
  chrome: { backdrop: false, glass: false, depth: false, rules: true, shout: true },
  effects: swissEffects,
};

export const skins: Record<SkinId, Skin> = { chroma, swiss };
export const skinIds = ['chroma', 'swiss'] as const;
export const defaultSkinId: SkinId = 'chroma';
