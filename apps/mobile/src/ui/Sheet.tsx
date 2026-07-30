import { round, size, space, ui } from '@chromawave/design-tokens';
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
      {grabber ? <SheetGrabber /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    backgroundColor: ui.bg.sheet,
    borderTopLeftRadius: round.sheet,
    borderTopRightRadius: round.sheet,
    borderTopWidth: 1,
    borderTopColor: ui.border.hairlineStrong,
    paddingTop: space.cardGap,
    paddingHorizontal: space.sectionGap,
    gap: space.md,
  },
  grabber: {
    width: size.grabberWidth,
    height: size.grabberHeight,
    borderRadius: 3,
    backgroundColor: 'rgba(237,234,227,.25)',
    alignSelf: 'center',
  },
});
