export * from './brand';

export const color = {
  canvas: '#090806',
  canvasElevated: '#100E0B',
  surface: '#18140F',
  surfaceRaised: '#282117',
  surfaceSubtle: '#12100C',
  text: '#FFF9ED',
  textMuted: '#C8BCAF',
  textSubtle: '#93877A',
  border: '#43382B',
  focus: '#F2CF91',
  accent: '#D9AE68',
  accentInk: '#1C1207',
  success: '#79C7A3',
  warning: '#E7B96D',
  danger: '#EA817B',
  brandCoral: '#C46A57',
  brandViolet: '#7671A8',
  brandChartreuse: '#A8AF72',
  champagneSoft: '#F0D8A7',
  scrim: 'rgba(9, 8, 6, 0.82)',
} as const;

export type ThemePalette = { readonly [Key in keyof typeof color]: string };

export const themePalettes = {
  obsidian: color,
  ivory: {
    canvas: '#F5F0E7',
    canvasElevated: '#EEE6D9',
    surface: '#FFFDF8',
    surfaceRaised: '#E7DAC5',
    surfaceSubtle: '#F0E8DC',
    text: '#17130F',
    textMuted: '#5F554B',
    textSubtle: '#796E62',
    border: '#CDBDA7',
    focus: '#744819',
    accent: '#8A5A20',
    accentInk: '#FFF9EF',
    success: '#397A60',
    warning: '#A46528',
    danger: '#A34640',
    brandCoral: '#B95745',
    brandViolet: '#5D5A8F',
    brandChartreuse: '#808A4B',
    champagneSoft: '#B98B46',
    scrim: 'rgba(25, 20, 15, 0.72)',
  },
  oxblood: {
    canvas: '#120607',
    canvasElevated: '#1B0A0C',
    surface: '#2A1014',
    surfaceRaised: '#3C181D',
    surfaceSubtle: '#200C0F',
    text: '#FFF4EC',
    textMuted: '#D2B5AE',
    textSubtle: '#A17E79',
    border: '#583037',
    focus: '#E7C89B',
    accent: '#E0B16C',
    accentInk: '#1B0B0D',
    success: '#77C09E',
    warning: '#D8A764',
    danger: '#E27976',
    brandCoral: '#A9433F',
    brandViolet: '#76506E',
    brandChartreuse: '#9D9660',
    champagneSoft: '#E7D0A8',
    scrim: 'rgba(17, 8, 9, 0.78)',
  },
  cobalt: {
    canvas: '#050914',
    canvasElevated: '#0A1020',
    surface: '#111A2E',
    surfaceRaised: '#1B2945',
    surfaceSubtle: '#0C1425',
    text: '#F8F5EE',
    textMuted: '#BBC3D5',
    textSubtle: '#8490A8',
    border: '#304463',
    focus: '#C9D6F2',
    accent: '#D8B873',
    accentInk: '#0B1020',
    success: '#6FC1A5',
    warning: '#D6AE70',
    danger: '#DF777F',
    brandCoral: '#A95E62',
    brandViolet: '#5D6EA5',
    brandChartreuse: '#98A577',
    champagneSoft: '#D3DDF2',
    scrim: 'rgba(7, 10, 18, 0.78)',
  },
  moss: {
    canvas: '#07100C',
    canvasElevated: '#0C1711',
    surface: '#142218',
    surfaceRaised: '#203325',
    surfaceSubtle: '#0E1A13',
    text: '#F7F3E8',
    textMuted: '#BBC5AE',
    textSubtle: '#84917B',
    border: '#364A3A',
    focus: '#D8D1A3',
    accent: '#D4B778',
    accentInk: '#10130B',
    success: '#73BE8D',
    warning: '#D4AD68',
    danger: '#D87972',
    brandCoral: '#9C5C4A',
    brandViolet: '#67647E',
    brandChartreuse: '#89945A',
    champagneSoft: '#DFD9B1',
    scrim: 'rgba(9, 12, 8, 0.78)',
  },
  aubergine: {
    canvas: '#100710',
    canvasElevated: '#180B19',
    surface: '#261229',
    surfaceRaised: '#381C3C',
    surfaceSubtle: '#1B0D1D',
    text: '#FFF4F8',
    textMuted: '#D0B5CA',
    textSubtle: '#967C93',
    border: '#513052',
    focus: '#E5C8DE',
    accent: '#D6A96D',
    accentInk: '#170C19',
    success: '#74C09A',
    warning: '#D6A968',
    danger: '#E07A82',
    brandCoral: '#A85462',
    brandViolet: '#73588D',
    brandChartreuse: '#969765',
    champagneSoft: '#E5CFE0',
    scrim: 'rgba(14, 9, 16, 0.78)',
  },
} as const satisfies Record<string, ThemePalette>;

export type ThemePaletteId = keyof typeof themePalettes;

export const themeModes: Record<ThemePaletteId, 'light' | 'dark'> = {
  obsidian: 'dark',
  ivory: 'light',
  oxblood: 'dark',
  cobalt: 'dark',
  moss: 'dark',
  aubergine: 'dark',
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 26,
  xl: 36,
  pill: 999,
} as const;

export const typography = {
  display: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 52,
    lineHeight: 57,
    letterSpacing: -1.6,
  },
  title: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 38,
    lineHeight: 43,
    letterSpacing: -0.9,
  },
  heading: {
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 25,
    lineHeight: 31,
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: 'SourceSerif4_400Regular',
    fontSize: 17,
    lineHeight: 25,
    letterSpacing: 0,
  },
  label: {
    fontFamily: 'SourceSerif4_600SemiBold',
    fontSize: 14,
    lineHeight: 19,
    letterSpacing: 0.8,
  },
  caption: {
    fontFamily: 'SourceSerif4_500Medium',
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.45,
  },
} as const;

export const motion = {
  duration: {
    instant: 80,
    feedback: 120,
    direct: 220,
    screen: 260,
    immersive: 420,
  },
  easing: {
    standard: [0.2, 0, 0, 1] as const,
    emphasized: [0.2, 0.8, 0.2, 1] as const,
  },
  spring: {
    responsive: { damping: 18, stiffness: 240, mass: 0.75 },
    gentle: { damping: 20, stiffness: 145, mass: 0.9 },
  },
} as const;

export const iconSize = { sm: 16, md: 20, lg: 24, xl: 32 } as const;
export const touchTarget = { minimum: 44, comfortable: 52 } as const;
export const opacity = { disabled: 0.42, secondary: 0.68, pressed: 0.78 } as const;
export const layer = { base: 0, content: 10, navigation: 20, overlay: 30, toast: 40 } as const;

export const shadow = {
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  hero: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 36,
    elevation: 14,
  },
  dock: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.38,
    shadowRadius: 28,
    elevation: 18,
  },
  floating: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.34,
    shadowRadius: 30,
    elevation: 12,
  },
} as const;
