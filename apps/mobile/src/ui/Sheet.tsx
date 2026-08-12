import { size, space } from '@cw/tokens';
import { BlurView } from 'expo-blur';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSkin } from '@/providers';

/** The 44×5 grabber that marks a sheet as draggable. */
export function SheetGrabber() {
  const skin = useSkin();
  return (
    <View
      accessibilityElementsHidden
      style={[styles.grabber, { backgroundColor: skin.ui.border.control }]}
    />
  );
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
  const skin = useSkin();
  const depth = skin.elevation.floating;
  return (
    <View
      style={[
        styles.sheet,
        {
          marginTop: -overlap,
          paddingBottom: Math.max(insets.bottom, space.lg),
          backgroundColor: skin.glass.shell.tint,
          borderTopLeftRadius: skin.round.sheet,
          borderTopRightRadius: skin.round.sheet,
          borderTopColor: skin.ui.border.hairlineStrong,
          shadowColor: depth.shadowColor,
          shadowOffset: depth.shadowOffset,
          shadowOpacity: depth.shadowOpacity,
          shadowRadius: depth.shadowRadius,
        },
        style,
      ]}
    >
      {/* Sheets overlap content, so they blur harder than a card — where the
          skin has blur at all. Swiss paints the tint flat instead. */}
      {skin.chrome.glass ? (
        <BlurView
          intensity={skin.glass.shell.intensity}
          style={StyleSheet.absoluteFill}
          tint="dark"
        />
      ) : null}
      {grabber ? <SheetGrabber /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
    overflow: 'hidden',
    borderTopWidth: 1,
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
    alignSelf: 'center',
  },
});
