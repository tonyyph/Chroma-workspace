import { space, ui, uiMotion } from '@chromawave/design-tokens';
import { Pressable, StyleSheet, View } from 'react-native';

import { Meta, Text } from './Text';

/**
 * The modal nav bar — Cancel · Title · Apply. Used by B3 Tune, G2 Import,
 * G5 Gradient studio and G7 Export, always with the confirming action in link
 * violet on the right.
 */
export function NavBar({
  title,
  leading,
  trailing,
  onLeading,
  onTrailing,
}: {
  title?: string | undefined;
  leading?: string | undefined;
  trailing?: string | undefined;
  onLeading?: (() => void) | undefined;
  onTrailing?: (() => void) | undefined;
}) {
  return (
    <View style={styles.nav}>
      <View style={styles.navSide}>
        {leading ? (
          <Pressable
            accessibilityLabel={leading}
            accessibilityRole="button"
            hitSlop={12}
            onPress={onLeading}
            style={({ pressed }) => pressed && { opacity: uiMotion.listPress.opacity }}
          >
            <Text style={styles.navLeading} tone="secondary">
              {leading}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {title ? (
        <Text accessibilityRole="header" variant="rowTitle">
          {title}
        </Text>
      ) : null}
      <View style={[styles.navSide, styles.navSideEnd]}>
        {trailing ? (
          <Pressable
            accessibilityLabel={trailing}
            accessibilityRole="button"
            hitSlop={12}
            onPress={onTrailing}
            style={({ pressed }) => pressed && { opacity: uiMotion.listPress.opacity }}
          >
            <Text style={styles.navTrailing} tone="link">
              {trailing}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** A screen header: Title 28/32 with an optional mono metadata line beneath. */
export function ScreenHeader({
  title,
  meta,
  trailing,
}: {
  title: string;
  meta?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text accessibilityRole="header" variant="title">
          {title}
        </Text>
        {meta ? <Meta style={styles.headerMeta}>{meta}</Meta> : null}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
    minHeight: 44,
  },
  navSide: {
    flex: 1,
  },
  navSideEnd: {
    alignItems: 'flex-end',
  },
  navLeading: {
    fontSize: 14,
  },
  navTrailing: {
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerCopy: {
    flex: 1,
  },
  headerMeta: {
    marginTop: 4,
    color: ui.text.tertiary,
  },
});
