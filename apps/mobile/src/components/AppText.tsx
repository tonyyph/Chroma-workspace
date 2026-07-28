import { typography } from '@chromawave/design-tokens';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { usePreferences } from '@/providers/PreferencesProvider';

type TextVariant = keyof typeof typography;

type AppTextProps = TextProps & {
  variant?: TextVariant;
  tone?: 'default' | 'muted' | 'subtle' | 'accent' | 'danger';
  italic?: boolean;
};

export function AppText({
  variant = 'body',
  tone = 'default',
  italic = false,
  style,
  ...props
}: AppTextProps) {
  const { colors } = usePreferences();
  const toneColor: Record<NonNullable<AppTextProps['tone']>, string> = {
    default: colors.text,
    muted: colors.textMuted,
    subtle: colors.textSubtle,
    accent: colors.accent,
    danger: colors.danger,
  };

  return (
    <Text
      allowFontScaling
      maxFontSizeMultiplier={2}
      style={[
        typography[variant] as TextStyle,
        { color: toneColor[tone] },
        italic && styles.italic,
        style,
      ]}
      {...props}
    />
  );
}

const styles = {
  italic: {
    fontFamily: 'PlayfairDisplay_400Regular_Italic',
  } satisfies TextStyle,
};
