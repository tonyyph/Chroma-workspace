import {
  elevation,
  glass,
  round,
  size,
  space,
  ui,
  type ElevationLevel,
} from '@chromawave/design-tokens';
import { BlurView } from 'expo-blur';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreferences } from '@/providers/PreferencesProvider';
import { reportBackdropScroll } from './backdropMotion';
import { Pressable } from './Pressable';
import { BandRefreshControl } from './Sequences';
import { UnderScreenCanvas } from './UnderScreenCanvas';

/**
 * A card over the ground.
 *
 * Depth comes from three things at once, which is why they travel together as
 * one `elevation` token: a soft shadow beneath, a hairline border, and a
 * brighter hairline along the *top* edge only. On a near-black ground the
 * shadow alone is close to invisible — the top highlight is what actually reads
 * as a surface catching light from above.
 *
 * `glass` makes the fill translucent and blurs what is behind it, so the moving
 * field shows through. It costs a blur pass per card, so it is opt-in: list
 * rows stay on the cheap translucent fill, and panels that want the backdrop
 * visible ask for it.
 */
export function Card({
  style,
  onPress,
  padded = true,
  level = 'raised',
  glass: useGlass = false,
  children,
  ...props
}: ViewProps & {
  onPress?: () => void;
  padded?: boolean;
  level?: ElevationLevel;
  glass?: boolean;
}) {
  const depth = elevation[level];
  const { outer: outerStyle, inner: innerStyle } = splitCardStyle(style);
  // The shadow and the clip cannot live on one view: iOS drops a shadow
  // entirely when `overflow: hidden` is set on the same node, and the clip is
  // what keeps the blur and the top highlight inside the corner radius. So the
  // outer view casts, the inner view clips.
  const box = [styles.cardShadow, shadowOf(depth), outerStyle];

  const inner = (
    <View
      style={[
        styles.cardClip,
        padded && styles.cardPadded,
        { borderColor: depth.borderColor },
        useGlass ? styles.cardGlass : styles.cardSolid,
        innerStyle,
      ]}
    >
      {useGlass ? (
        <BlurView intensity={glass.card.intensity} style={StyleSheet.absoluteFill} tint="dark" />
      ) : null}
      {children}
    </View>
  );

  if (!onPress) {
    return (
      <View {...props} style={box}>
        {inner}
      </View>
    );
  }
  return <PressableCard box={box} inner={inner} onPress={onPress} {...props} />;
}

/** The shadow half of an elevation, for the view that casts rather than clips. */
function shadowOf(depth: (typeof elevation)[ElevationLevel]): ViewStyle {
  return {
    shadowColor: depth.shadowColor,
    shadowOffset: depth.shadowOffset,
    shadowOpacity: depth.shadowOpacity,
    shadowRadius: depth.shadowRadius,
    elevation: depth.elevation,
  };
}

const OUTER_CARD_STYLE_KEYS = new Set<keyof ViewStyle>([
  'alignSelf',
  'bottom',
  'end',
  'flex',
  'flexBasis',
  'flexGrow',
  'flexShrink',
  'height',
  'left',
  'margin',
  'marginBottom',
  'marginEnd',
  'marginHorizontal',
  'marginLeft',
  'marginRight',
  'marginStart',
  'marginTop',
  'marginVertical',
  'maxHeight',
  'maxWidth',
  'minHeight',
  'minWidth',
  'position',
  'right',
  'start',
  'top',
  'width',
  'zIndex',
]);

function splitCardStyle(style: StyleProp<ViewStyle> | undefined): {
  outer: ViewStyle | undefined;
  inner: ViewStyle | undefined;
} {
  const flat = StyleSheet.flatten(style);
  if (!flat) return { outer: undefined, inner: undefined };

  const outer: ViewStyle = {};
  const inner: ViewStyle = {};

  const outerRecord = outer as Record<string, ViewStyle[keyof ViewStyle]>;
  const innerRecord = inner as Record<string, ViewStyle[keyof ViewStyle]>;

  for (const [key, value] of Object.entries(flat) as [
    keyof ViewStyle,
    ViewStyle[keyof ViewStyle],
  ][]) {
    if (OUTER_CARD_STYLE_KEYS.has(key)) {
      outerRecord[key] = value;
    } else {
      innerRecord[key] = value;
    }
  }

  return {
    outer: Object.keys(outer).length ? outer : undefined,
    inner: Object.keys(inner).length ? inner : undefined,
  };
}

/**
 * The pressable form. Split out because it needs hooks, and `Card` renders a
 * plain view when there is no handler.
 *
 * Press is a spring on scale rather than a step change in opacity. Opacity
 * fading a translucent surface makes it look like it is being erased; a card
 * that dips towards the ground and comes back reads as something physical being
 * pushed.
 */
function PressableCard({
  box,
  inner,
  onPress,
  ...props
}: ViewProps & { box: StyleProp<ViewStyle>; inner: React.ReactNode; onPress: () => void }) {
  const pressed = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.022 }],
  }));
  const pressableProps = props as ViewProps;

  return (
    <Animated.View style={[box, animated]}>
      <Pressable
        {...pressableProps}
        accessibilityRole={props.accessibilityRole ?? 'button'}
        onPress={onPress}
        onPressIn={() => {
          pressed.value = withSpring(1, PRESS_IN);
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, PRESS_OUT);
        }}
      >
        {inner}
      </Pressable>
    </Animated.View>
  );
}

/** Quick to take the press, slower and softer to release it. */
const PRESS_IN = { damping: 26, stiffness: 420, mass: 0.6 } as const;
const PRESS_OUT = { damping: 18, stiffness: 260, mass: 0.7 } as const;

/**
 * A grouped list: rows separated by hairlines with no gap, clipped to the card
 * radius. Used by the profile settings groups and the hex list in B4.
 */
export function CardGroup({
  children,
  style,
  glass: useGlass = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  glass?: boolean;
}) {
  const rows = Array.isArray(children) ? children.filter(Boolean) : [children];
  const depth = elevation.raised;
  return (
    <View style={[styles.cardShadow, shadowOf(depth), style]}>
      <View
        style={[
          styles.cardClip,
          useGlass ? styles.cardGlass : styles.cardSolid,
          { borderColor: depth.borderColor },
        ]}
      >
        {/* Settings groups are the largest flat surfaces in the app, so they
            are where the moving field behind is most worth seeing through. */}
        {useGlass ? (
          <BlurView intensity={glass.card.intensity} style={StyleSheet.absoluteFill} tint="dark" />
        ) : null}
        {rows.map((row, index) => (
          <View
            key={index}
            style={[styles.groupRow, index < rows.length - 1 && styles.groupDivider]}
          >
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

/** The base screen ground, with the status bar and home indicator respected. */
export function Screen({
  children,
  scroll = true,
  topInset = true,
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
  topInset?: boolean;
  tabBarInset?: boolean;
  refreshing?: boolean;
  onRefresh?: (() => void) | undefined;
  style?: ViewStyle;
}) {
  const insets = useSafeAreaInsets();
  const { preferences } = usePreferences();
  const paddingBottom = tabBarInset ? size.tabBar + space.sectionGap * 2 : space.xl;
  const paddingTop = topInset ? insets.top : 0;

  // Feeds the backdrop. Runs on the UI thread, so the field parallaxes with the
  // finger rather than a frame or two behind it.
  const onScroll = useAnimatedScrollHandler((event) => {
    reportBackdropScroll(event.contentOffset.y);
  });

  /**
   * Every screen owns its ground, and it is always opaque.
   *
   * A screen that let a shared backdrop show through from behind the navigator
   * is see-through during a push: the outgoing screen stays visible underneath
   * for the whole transition and the two read as one double-exposed frame. The
   * field is drawn here instead, from clock values shared by every instance, so
   * each screen is both opaque and showing the same continuous ground.
   */
  const content = !scroll ? (
    <View style={[styles.screen, { paddingTop }, style]}>{children}</View>
  ) : (
    <View style={[styles.screen, { paddingTop }]}>
      <Animated.ScrollView
        contentContainerStyle={[{ paddingBottom: paddingBottom + insets.bottom }, style]}
        // A scroll view eats the tap that dismisses the keyboard by default, so
        // every control on a screen with a field open takes two taps: one to
        // close the keyboard, one to actually press it. `handled` gives the tap
        // to the control and lets the control decide.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScroll={onScroll}
        refreshControl={
          onRefresh ? (
            <BandRefreshControl onRefresh={onRefresh} refreshing={refreshing ?? false} />
          ) : undefined
        }
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Animated.ScrollView>
    </View>
  );

  return (
    <View style={[styles.screen, styles.ground]}>
      {preferences.ambientBackdrop ? <UnderScreenCanvas /> : null}
      {content}
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
  gutter: {
    paddingHorizontal: space.gutter,
  },
  /** Casts the shadow. Must not clip, or iOS drops the shadow. */
  cardShadow: {
    borderRadius: round.card,
  },
  /** Clips the blur and the highlight to the radius. Must not cast. */
  cardClip: {
    borderWidth: 1,
    borderRadius: round.card,
    overflow: 'hidden',
  },
  cardSolid: { backgroundColor: ui.fill.card },
  cardGlass: { backgroundColor: glass.card.tint },
  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
  },
  cardPadded: {
    padding: space.md,
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
