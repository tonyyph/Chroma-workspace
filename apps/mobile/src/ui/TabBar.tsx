import { brandBands, round, size, space, ui, uiMotion, uiShadow } from '@chromawave/design-tokens';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type TabKey = 'library' | 'explore' | 'sets' | 'you';

/**
 * The four tabs either side of the capture button.
 *
 * The design shows LIB active in violet (C1) and EXPLORE active in cyan (C2),
 * so the accent is per-tab rather than global. SETS continues the band order
 * into coral; YOU falls back to action/primary because it is the account
 * surface rather than a content one.
 */
const tabs: readonly {
  key: TabKey;
  label: string;
  accessibilityLabel: string;
  accent: string;
  icon: IconName;
}[] = [
  {
    key: 'library',
    label: 'LIB',
    accessibilityLabel: 'Library',
    accent: brandBands[3],
    icon: 'library',
  },
  {
    key: 'explore',
    label: 'EXPLORE',
    accessibilityLabel: 'Explore',
    accent: brandBands[1],
    icon: 'explore',
  },
  {
    key: 'sets',
    label: 'SETS',
    accessibilityLabel: 'Sets',
    accent: brandBands[2],
    icon: 'sets',
  },
  {
    key: 'you',
    label: 'YOU',
    accessibilityLabel: 'You',
    accent: ui.action.primary,
    icon: 'profile',
  },
];

/**
 * FLOW C · "capture button is the mark, centred in the bar". A floating 66pt
 * pill over a gradient scrim, so list content fades out beneath it rather than
 * being cut by a hard edge.
 */
export function TabBar({
  active,
  onSelect,
  onCapture,
}: {
  active: TabKey;
  onSelect: (key: TabKey) => void;
  onCapture: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [left, right] = [tabs.slice(0, 2), tabs.slice(2)];

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      <LinearGradient
        colors={['rgba(8,7,14,0)', 'rgba(8,7,14,.94)']}
        locations={[0, 0.4]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.barShell, uiShadow.tabBar]}>
        <View style={styles.bar}>
          <BlurView intensity={26} style={StyleSheet.absoluteFill} tint="dark" />
          <View style={styles.barInner}>
            {left.map((tab) => (
              <TabItem
                active={active === tab.key}
                key={tab.key}
                onPress={() => onSelect(tab.key)}
                tab={tab}
              />
            ))}
            <Pressable
              accessibilityLabel="Capture a colour"
              accessibilityRole="button"
              hitSlop={6}
              onPress={onCapture}
              style={({ pressed }) => [
                styles.capture,
                uiShadow.mark,
                pressed && styles.capturePressed,
              ]}
            >
              <BrandMark size={size.tabMark} />
            </Pressable>
            {right.map((tab) => (
              <TabItem
                active={active === tab.key}
                key={tab.key}
                onPress={() => onSelect(tab.key)}
                tab={tab}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function TabItem({
  tab,
  active,
  onPress,
}: {
  tab: (typeof tabs)[number];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={tab.accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
    >
      <View
        style={[
          styles.iconSurface,
          active && styles.iconSurfaceActive,
          active && uiShadow.tabActive,
          active && { backgroundColor: tab.accent, shadowColor: tab.accent },
        ]}
      >
        <Icon
          color={active ? ui.text.primary : ui.text.secondary}
          name={tab.icon}
          scale="navigation"
        />
      </View>
      <Text style={{ color: active ? ui.text.primary : ui.text.tertiary }} variant="chip">
        {tab.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.gutter,
    paddingTop: space.sectionGap,
  },
  barShell: {
    height: size.tabBar * 1.15,
    borderRadius: size.tabBar,
    backgroundColor: ui.tabBar,
  },
  bar: {
    flex: 1,
    borderRadius: size.tabBar,
    backgroundColor: ui.tabBar,
    borderWidth: 1,
    borderColor: ui.border.control,
    overflow: 'hidden',
  },
  barInner: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: space.xs,
  },
  item: {
    flex: 1,
    minHeight: size.tabItem,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xxs,
  },
  itemPressed: {
    opacity: uiMotion.listPress.opacity,
  },
  iconSurface: {
    width: size.tabIconSurfaceWidth,
    height: size.tabIconSurfaceHeight,
    borderRadius: round.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSurfaceActive: {
    transform: [{ translateY: -2 }],
  },
  capture: {
    width: size.tabMark,
    height: size.tabMark,
    borderRadius: round.full,
  },
  capturePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
