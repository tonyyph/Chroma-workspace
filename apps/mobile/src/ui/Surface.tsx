import { round, size, space, ui, uiMotion } from '@chromawave/design-tokens';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePreferences } from '@/providers/PreferencesProvider';

import { BandRefreshControl } from './Sequences';

/**
 * A card: `fill/card` over the ground with a hairline border. The recurring
 * container behind list rows, stat tiles and panels.
 */
export function Card({
  style,
  onPress,
  padded = true,
  children,
  ...props
}: ViewProps & { onPress?: () => void; padded?: boolean }) {
  const box = [styles.card, padded && styles.cardPadded, style];
  if (!onPress) {
    return (
      <View {...props} style={box}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      // Spreading here is not cosmetic: callers pass `accessibilityRole="radio"`
      // and a label through `props`, and dropping them left the pressable card
      // with no role at all — invisible to a screen reader and to any test that
      // looks for controls by role.
      {...props}
      accessibilityRole={props.accessibilityRole ?? 'button'}
      onPress={onPress}
      style={({ pressed }) => [...box, pressed && { opacity: uiMotion.listPress.opacity }]}
    >
      {children}
    </Pressable>
  );
}

/**
 * A grouped list: rows separated by hairlines with no gap, clipped to the card
 * radius. Used by the profile settings groups and the hex list in B4.
 */
export function CardGroup({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={[styles.card, styles.group, style]}>
      {rows.map((row, index) => (
        <View key={index} style={[styles.groupRow, index < rows.length - 1 && styles.groupDivider]}>
          {row}
        </View>
      ))}
    </View>
  );
}

/** The base screen ground, with the status bar and home indicator respected. */
export function Screen({
  children,
  scroll = true,
  /** Extra bottom padding so content clears the floating tab bar. */
  tabBarInset = false,
  /**
   * Pull-to-refresh. Supply both and the screen becomes refreshable; a screen
   * with nothing to re-read leaves them off rather than showing a gesture that
   * does nothing.
   */
  refreshing,
  onRefresh,
  style,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  tabBarInset?: boolean;
  refreshing?: boolean;
  onRefresh?: (() => void) | undefined;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const { preferences } = usePreferences();
  const paddingBottom = tabBarInset ? size.tabBar + space.sectionGap * 2 : space.xl;
  // The backdrop lives behind the navigator and supplies the ground itself, so
  // a screen that painted its own would hide it completely.
  const ground = preferences.ambientBackdrop ? styles.transparent : styles.ground;

  if (!scroll) {
    return (
      <View style={[styles.screen, ground, { paddingTop: insets.top }, style]}>{children}</View>
    );
  }
  return (
    <View style={[styles.screen, ground, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[{ paddingBottom: paddingBottom + insets.bottom }, style]}
        refreshControl={
          onRefresh ? (
            <BandRefreshControl onRefresh={onRefresh} refreshing={refreshing ?? false} />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Standard 20pt horizontal gutter. */
export function Gutter({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.gutter, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  ground: { backgroundColor: ui.bg.base },
  transparent: { backgroundColor: 'transparent' },
  gutter: {
    paddingHorizontal: space.gutter,
  },
  card: {
    backgroundColor: ui.fill.card,
    borderWidth: 1,
    borderColor: ui.border.hairline,
    borderRadius: round.card,
  },
  cardPadded: {
    padding: space.md,
  },
  group: {
    overflow: 'hidden',
  },
  groupRow: {
    paddingHorizontal: space.cardGap,
    paddingVertical: space.cardGap,
  },
  groupDivider: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(237,234,227,.07)',
  },
});
