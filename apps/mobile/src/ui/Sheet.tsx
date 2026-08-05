import { elevation, glass, round, size, space, ui } from '@chromawave/design-tokens';
import { BlurView } from 'expo-blur';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The 44×5 grabber that marks a sheet as draggable. */
export function SheetGrabber() {
  return <View accessibilityElementsHidden style={styles.grabber} />;
}

/**
 * A bottom sheet surface: 28pt top corners, `bg/sheet` ground, hairline top
 * border and a grabber. Presentation (drag, backdrop) belongs to the caller —
 * B2 rides the sheet up over the capture, C4 presents it modally.
 */
export function Sheet({
  children,
  grabber = true,
  style,
  /** Pull the sheet up over the content above it, as B2's result sheet does. */
  overlap = 0,
}: {
  children: React.ReactNode;
  grabber?: boolean;
  style?: ViewStyle;
  overlap?: number;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.sheet,
        { marginTop: -overlap, paddingBottom: Math.max(insets.bottom, space.lg) },
        style,
      ]}
    >
      {/* Sheets overlap content, so they blur harder than a card and carry the
          floating elevation's highlight. */}
      <BlurView intensity={glass.shell.intensity} style={StyleSheet.absoluteFill} tint="dark" />
      <View
        pointerEvents="none"
        style={[styles.highlight, { backgroundColor: elevation.floating.highlightColor }]}
      />
      {grabber ? <SheetGrabber /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: glass.shell.tint,
    shadowColor: elevation.floating.shadowColor,
    shadowOffset: elevation.floating.shadowOffset,
    shadowOpacity: elevation.floating.shadowOpacity,
    shadowRadius: elevation.floating.shadowRadius,
    borderTopLeftRadius: round.sheet,
    borderTopRightRadius: round.sheet,
    borderTopWidth: 1,
    borderTopColor: ui.border.hairlineStrong,
    paddingTop: space.cardGap,
    paddingHorizontal: space.sectionGap,
    gap: space.md,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
  },
  grabber: {
    width: size.grabberWidth,
    height: size.grabberHeight,
    borderRadius: 3,
    backgroundColor: 'rgba(237,234,227,.25)',
    alignSelf: 'center',
  },
});
