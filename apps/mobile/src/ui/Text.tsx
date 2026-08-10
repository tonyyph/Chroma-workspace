import type { Skin } from '@chromawave/design-tokens';
import { Text as RNText, type TextProps, type TextStyle } from 'react-native';
import { useSkin } from '@/providers';

/**
 * Both skins declare every variant, so this reads them from the active one
 * rather than importing a scale. `swiss` sets `section` in mono at 12/16 with
 * wide tracking where `chroma` sets it in the grotesque at 20/26 — the same
 * role, a different voice.
 */
const variantsOf = (skin: Skin) => skin.type;

const tonesOf = (skin: Skin) =>
  ({
    primary: skin.ui.text.primary,
    secondary: skin.ui.text.secondary,
    tertiary: skin.ui.text.tertiary,
    quaternary: skin.ui.text.quaternary,
    link: skin.ui.action.link,
    info: skin.ui.accent.infoText,
    danger: skin.ui.status.dangerText,
    onLight: skin.ui.text.onLight,
    onPrimary: skin.ui.action.onPrimary,
  }) as const;

export type TextVariant = keyof Skin['type'];
export type TextTone = keyof ReturnType<typeof tonesOf>;

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
  const skin = useSkin();
  return (
    <RNText {...props} style={[variantsOf(skin)[variant], { color: tonesOf(skin)[tone] }, style]} />
  );
}

/** Mono metadata, upper-cased at render so callers keep readable source strings. */
export function Meta({
  children,
  tone = 'tertiary',
  style,
  ...props
}: TextProps & { tone?: TextTone }) {
  const skin = useSkin();
  return (
    <RNText {...props} style={[skin.type.meta, { color: tonesOf(skin)[tone] }, style as TextStyle]}>
      {typeof children === 'string' ? children.toLocaleUpperCase() : children}
    </RNText>
  );
}
