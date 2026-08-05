import { space, ui, uiMotion } from '@chromawave/design-tokens';
import { StyleSheet, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
import { Meta, Text } from './Text';

/**
 * The modal nav bar — Cancel · Title · Apply. Used by B3 Tune, G2 Import,
 * G5 Gradient studio and G7 Export, always with the confirming action in link
 * violet on the right.
 */
export function NavBar({
  title,
  leading,
  /** Drawn before the leading label — `back` for a pop, `close` for a dismiss. */
  leadingIcon,
  trailing,
  onLeading,
  onTrailing,
}: {
  title?: string | undefined;
  leading?: string | undefined;
  leadingIcon?: IconName | undefined;
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
            onPress={onLeading ?? null}
            style={({ pressed }) => [
              styles.navLeadingRow,
              pressed && { opacity: uiMotion.listPress.opacity },
            ]}
          >
            {leadingIcon ? (
              <Icon color={ui.text.secondary} name={leadingIcon} scale="inline" />
            ) : null}
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
            onPress={onTrailing ?? null}
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

/**
 * A section head inside a scrolling screen: a row title, an optional count, and
 * an optional action on the right.
 *
 * The action is a label *and* a chevron rather than a bare word, because "SEE
 * ALL" on its own reads as a caption until someone happens to tap it. It is only
 * rendered when a handler exists — a section head that shows an action it cannot
 * perform is the exact defect the dead-controls scan exists to catch.
 */
export function SectionHead({
  title,
  meta,
  action,
  onAction,
}: {
  title: string;
  meta?: string | undefined;
  action?: string | undefined;
  onAction?: (() => void) | undefined;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionCopy}>
        <Text variant="rowTitle">{title}</Text>
        {meta ? <Meta style={styles.sectionMeta}>{meta}</Meta> : null}
      </View>
      {action && onAction ? (
        <Pressable
          accessibilityLabel={action}
          accessibilityRole="button"
          hitSlop={10}
          onPress={onAction}
          style={({ pressed }) => [
            styles.sectionAction,
            pressed && { opacity: uiMotion.listPress.opacity },
          ]}
        >
          <Text tone="tertiary" variant="chip">
            {action}
          </Text>
          <Icon color={ui.text.tertiary} name="forward" scale="inline" />
        </Pressable>
      ) : null}
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
  navLeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  sectionCopy: {
    flex: 1,
    gap: 3,
  },
  sectionMeta: {
    color: ui.text.quaternary,
  },
  sectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
