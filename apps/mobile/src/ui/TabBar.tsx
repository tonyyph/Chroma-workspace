import { brandBands, size, space, uiMotion } from '@chromawave/design-tokens';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandMark } from '@/components';
import { useSkin } from '@/providers';
import { reportBackdropTouch } from './backdropMotion';
import { Icon, type IconName } from './Icon';
import { Pressable } from './Pressable';
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
  /** Null takes the skin's own primary, which is violet in one and red in the
   *  other — the brand bands beside it are content colours and do not move. */
  accent: string | null;
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
    accent: null,
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
  const skin = useSkin();
  const [left, right] = [tabs.slice(0, 2), tabs.slice(2)];

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      <LinearGradient
        colors={
          skin.chrome.depth
            ? ['rgba(8,7,14,0)', 'rgba(18, 17, 25, 0.94)']
            : ['rgba(242,241,238,0)', skin.ui.bg.base]
        }
        locations={[0, 0.4]}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.barShell, { borderRadius: skin.round.pill }, skin.shadow.tabBar]}>
        <View
          style={[
            styles.bar,
            {
              borderRadius: skin.round.pill,
              backgroundColor: skin.ui.tabBar,
              borderColor: skin.ui.border.control,
            },
          ]}
        >
          {skin.chrome.glass ? (
            <BlurView
              intensity={skin.glass.shell.intensity}
              style={StyleSheet.absoluteFill}
              tint="dark"
            />
          ) : null}
          <View style={styles.barInner}>
            {left.map((tab) => (
              <TabItem
                active={active === tab.key}
                key={tab.key}
                onPress={() => {
                  reportBackdropTouch(0.2, 0.88);
                  onSelect(tab.key);
                }}
                tab={tab}
              />
            ))}
            <Pressable
              accessibilityLabel="Capture a colour"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => {
                reportBackdropTouch(0.5, 0.9);
                onCapture();
              }}
              style={({ pressed }) => [
                styles.capture,
                { borderRadius: skin.round.full },
                skin.shadow.mark,
                pressed && styles.capturePressed,
              ]}
            >
              <BrandMark size={size.tabMark} />
            </Pressable>
            {right.map((tab) => (
              <TabItem
                active={active === tab.key}
                key={tab.key}
                onPress={() => {
                  reportBackdropTouch(0.8, 0.88);
                  onSelect(tab.key);
                }}
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
  const skin = useSkin();
  const accent = tab.accent ?? skin.ui.action.primary;
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
          { borderRadius: skin.round.control },
          active && styles.iconSurfaceActive,
          active && skin.shadow.tabActive,
          active && { backgroundColor: accent, shadowColor: accent },
        ]}
      >
        <Icon
          color={active ? skin.ui.text.primary : skin.ui.text.secondary}
          name={tab.icon}
          scale="navigation"
        />
      </View>
      <Text style={{ color: active ? skin.ui.text.primary : skin.ui.text.tertiary }} variant="chip">
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
  },
  shellHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
  },
  bar: {
    flex: 1,
    borderRadius: size.tabBar,
    borderWidth: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSurfaceActive: {
    transform: [{ translateY: -2 }],
  },
  capture: {
    width: size.tabMark,
    height: size.tabMark,
  },
  capturePressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
