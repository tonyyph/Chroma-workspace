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
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePreferences } from '@/providers/PreferencesProvider';

import { Pressable } from './Pressable';
import { reportBackdropScroll } from './backdropMotion';
import { BandRefreshControl } from './Sequences';

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
      {/* The lit top edge. A separate absolutely-positioned hairline rather than
          a border, because a border applies to all four sides and the effect
          depends on it being only the one facing the light. */}
      <View
        pointerEvents="none"
        style={[styles.topHighlight, { backgroundColor: depth.highlightColor }]}
      />
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

  for (const [key, value] of Object.entries(flat) as [keyof ViewStyle, ViewStyle[keyof ViewStyle]][]) {
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
        <View
          pointerEvents="none"
          style={[styles.topHighlight, { backgroundColor: depth.highlightColor }]}
        />
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

  // Feeds the backdrop. Runs on the UI thread, so the field parallaxes with the
  // finger rather than a frame or two behind it.
  const onScroll = useAnimatedScrollHandler((event) => {
    reportBackdropScroll(event.contentOffset.y);
  });

  if (!scroll) {
    return (
      <View style={[styles.screen, ground, { paddingTop: insets.top }, style]}>{children}</View>
    );
  }
  return (
    <View style={[styles.screen, ground, { paddingTop: insets.top }]}>
      <Animated.ScrollView
        contentContainerStyle={[{ paddingBottom: paddingBottom + insets.bottom }, style]}
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
