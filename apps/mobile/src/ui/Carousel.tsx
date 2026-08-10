import { space } from '@chromawave/design-tokens';
import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSkin } from '@/providers';
import { Pressable } from './Pressable';

/**
 * A paged horizontal carousel.
 *
 * **Why this is hand-built.** The behaviour that makes a carousel feel expensive
 * is not paging — `pagingEnabled` gives that for free. It is that the slide
 * *coming* is already visible and already moving: a peeking neighbour, scaled
 * back and dimmed, that resolves as it arrives. That needs the scroll offset as
 * a shared value driving each slide's transform on the UI thread, which is what
 * this does. A `FlatList` with `snapToInterval` cannot, because the transform
 * would be a state update per frame on the JS thread.
 *
 * **Autoplay.** Off unless asked for, and it stops permanently the moment the
 * user touches the track — an auto-advance that fights a finger is the single
 * most common way a carousel becomes hostile. It also never runs when the OS
 * reports reduce-motion, where an unrequested animation is a stated harm rather
 * than a preference.
 */
export type CarouselProps<Item> = {
  data: readonly Item[];
  keyExtractor: (item: Item, index: number) => string;
  renderItem: (item: Item, index: number) => React.ReactNode;
  /** Points of the neighbouring slides left visible either side. */
  peek?: number;
  gap?: number;
  height: number;
  /** Milliseconds between auto-advances. Omit for a carousel that never moves itself. */
  autoPlayMs?: number;
  /** Announced as the group's name, e.g. "Featured". */
  accessibilityLabel: string;
  onIndexChange?: (index: number) => void;
  style?: ViewStyle;
};

export function Carousel<Item>({
  data,
  keyExtractor,
  renderItem,
  peek = 22,
  gap = space.sm,
  height,
  autoPlayMs,
  accessibilityLabel,
  onIndexChange,
  style,
}: CarouselProps<Item>) {
  const { width: windowWidth } = useWindowDimensions();
  // Measured rather than assumed: the carousel is laid out inside whatever
  // padding its parent has, and a slide sized from the window width overflows
  // by exactly that padding on every device.
  const [trackWidth, setTrackWidth] = useState(windowWidth);
  const slideWidth = Math.max(1, trackWidth - peek * 2);
  const stride = slideWidth + gap;

  const scroll = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const listRef = useAnimatedRef<Animated.ScrollView>();
  // Autoplay is abandoned, not paused: once someone has driven it themselves,
  // the carousel is theirs.
  const [autoPlay, setAutoPlay] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scroll.value = event.contentOffset.x;
    },
  });

  const onMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / stride);
      setIndex(next);
      onIndexChange?.(next);
    },
    [onIndexChange, stride],
  );

  const goTo = useCallback(
    (next: number, animated = true) => {
      listRef.current?.scrollTo({ x: next * stride, animated });
      setIndex(next);
      onIndexChange?.(next);
    },
    [listRef, onIndexChange, stride],
  );

  useEffect(() => {
    if (!autoPlayMs || !autoPlay || reduceMotion || data.length < 2) return;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % data.length;
        listRef.current?.scrollTo({ x: next * stride, animated: true });
        onIndexChange?.(next);
        return next;
      });
    }, autoPlayMs);
    return () => clearInterval(timer);
  }, [autoPlay, autoPlayMs, data.length, listRef, onIndexChange, reduceMotion, stride]);

  // A slide removed under the cursor — a filter narrowing the set — would leave
  // the track scrolled past its own end.
  useEffect(() => {
    if (index <= data.length - 1) return;
    goTo(Math.max(0, data.length - 1), false);
  }, [data.length, goTo, index]);

  const onLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  if (data.length === 0) return null;

  return (
    <View onLayout={onLayout} style={style}>
      <Animated.ScrollView
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="list"
        contentContainerStyle={{ paddingHorizontal: peek, gap }}
        decelerationRate="fast"
        horizontal
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={onMomentumEnd}
        onScroll={onScroll}
        onScrollBeginDrag={() => setAutoPlay(false)}
        ref={listRef}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        snapToInterval={stride}
        snapToAlignment="start"
        style={{ height }}
      >
        {data.map((item, itemIndex) => (
          <Slide
            index={itemIndex}
            key={keyExtractor(item, itemIndex)}
            reduceMotion={reduceMotion}
            scroll={scroll}
            stride={stride}
            width={slideWidth}
          >
            {renderItem(item, itemIndex)}
          </Slide>
        ))}
      </Animated.ScrollView>

      {data.length > 1 ? (
        <Pagination
          count={data.length}
          index={index}
          onSelect={goTo}
          scroll={scroll}
          stride={stride}
        />
      ) : null}
    </View>
  );
}

/**
 * One slide, transformed against its distance from the viewport centre.
 *
 * Scale and opacity only — no rotation, no translateZ. The design system's
 * motion rule is "light travels, glass stays": the container is allowed to
 * recede, not to tumble.
 */
function Slide({
  children,
  index,
  reduceMotion,
  scroll,
  stride,
  width,
}: {
  children: React.ReactNode;
  index: number;
  reduceMotion: boolean;
  scroll: SharedValue<number>;
  stride: number;
  width: number;
}) {
  const animated = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 1, transform: [{ scale: 1 }] };
    const inputRange = [(index - 1) * stride, index * stride, (index + 1) * stride];
    return {
      opacity: interpolate(scroll.value, inputRange, [0.55, 1, 0.55], Extrapolation.CLAMP),
      transform: [
        {
          scale: interpolate(scroll.value, inputRange, [0.93, 1, 0.93], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return <Animated.View style={[{ width }, animated]}>{children}</Animated.View>;
}

/**
 * The page indicator. Each dot is a real control — a carousel whose indicator
 * cannot be tapped is showing the user where they are and refusing to take them
 * there — and the active one stretches to a bar so position is legible without
 * relying on a colour difference alone.
 */
function Pagination({
  count,
  index,
  onSelect,
  scroll,
  stride,
}: {
  count: number;
  index: number;
  onSelect: (index: number) => void;
  scroll: SharedValue<number>;
  stride: number;
}) {
  return (
    <View style={styles.pagination}>
      {Array.from({ length: count }, (_, dot) => (
        <Dot
          active={dot === index}
          index={dot}
          key={dot}
          onPress={() => onSelect(dot)}
          scroll={scroll}
          stride={stride}
          total={count}
        />
      ))}
    </View>
  );
}

function Dot({
  active,
  index,
  onPress,
  scroll,
  stride,
  total,
}: {
  active: boolean;
  index: number;
  onPress: () => void;
  scroll: SharedValue<number>;
  stride: number;
  total: number;
}) {
  const animated = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * stride, index * stride, (index + 1) * stride];
    return {
      width: interpolate(scroll.value, inputRange, [DOT, DOT_ACTIVE, DOT], Extrapolation.CLAMP),
      opacity: interpolate(scroll.value, inputRange, [0.3, 1, 0.3], Extrapolation.CLAMP),
    };
  });

  const skin = useSkin();
  return (
    <Pressable
      accessibilityLabel={`Slide ${index + 1} of ${total}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={10}
      onPress={onPress}
    >
      <Animated.View style={[styles.dot, { backgroundColor: skin.ui.text.primary }, animated]} />
    </Pressable>
  );
}

const DOT = 6;
const DOT_ACTIVE = 22;

const styles = StyleSheet.create({
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: space.sm,
  },
  dot: {
    height: DOT,
    borderRadius: DOT / 2,
  },
});
