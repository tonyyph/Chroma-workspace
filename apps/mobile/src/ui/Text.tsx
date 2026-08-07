import { type, typeExtra, ui } from '@chromawave/design-tokens';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

const variants = {
  hero: type.hero,
  display: type.display,
  title: type.title,
  section: type.section,
  headline: typeExtra.headline,
  rowTitle: type.rowTitle,
  cardTitle: typeExtra.cardTitle,
  body: type.body,
  /** Mono, upper case, +14% track. Callers pass text already upper-cased. */
  meta: type.meta,
  eyebrow: typeExtra.eyebrow,
  chip: typeExtra.chip,
  mono: typeExtra.mono,
  monoSmall: typeExtra.monoSmall,
  button: typeExtra.button,
  buttonLarge: typeExtra.buttonLarge,
} as const;

const tones = {
  primary: ui.text.primary,
  secondary: ui.text.secondary,
  tertiary: ui.text.tertiary,
  quaternary: ui.text.quaternary,
  link: ui.action.link,
  info: ui.accent.infoText,
  danger: ui.status.dangerText,
  onLight: ui.text.onLight,
  onPrimary: ui.action.onPrimary,
} as const;

export type TextVariant = keyof typeof variants;
export type TextTone = keyof typeof tones;

/**
 * The single text primitive. Every size in the app comes from SYSTEM F's type
 * scale, so a screen never sets fontSize directly.
 */
export function Text({
  variant = 'body',
  tone = 'primary',
  style,
  ...props
}: TextProps & { variant?: TextVariant; tone?: TextTone }) {
  return <RNText {...props} style={[variants[variant], { color: tones[tone] }, style]} />;
}

/** Mono metadata, upper-cased at render so callers keep readable source strings. */
export function Meta({
  children,
  tone = 'tertiary',
  style,
  ...props
}: TextProps & { tone?: TextTone }) {
  return (
    <RNText {...props} style={[type.meta, { color: tones[tone] }, style as TextStyle]}>
      {typeof children === 'string' ? children.toLocaleUpperCase() : children}
    </RNText>
  );
}
