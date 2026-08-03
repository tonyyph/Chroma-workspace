import { brandBands, round, size, space, ui, uiShadow } from '@chromawave/design-tokens';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';

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
const tabs: readonly { key: TabKey; label: string; accent: string; circular?: boolean }[] = [
  { key: 'library', label: 'LIB', accent: brandBands[0] },
  { key: 'explore', label: 'EXPLORE', accent: brandBands[1] },
  { key: 'sets', label: 'SETS', accent: brandBands[2] },
  { key: 'you', label: 'YOU', accent: ui.action.primary, circular: true },
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
      <View style={styles.bar}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
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
      accessibilityLabel={tab.label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      hitSlop={10}
      onPress={onPress}
      style={styles.item}
    >
      <View
        style={[
          styles.glyph,
          tab.circular && styles.glyphCircular,
          active
            ? { backgroundColor: tab.accent }
            : { borderWidth: 1.5, borderColor: 'rgba(237,234,227,.4)' },
        ]}
      />
      <Text style={{ color: active ? ui.text.primary : 'rgba(237,234,227,.5)' }} variant="chip">
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
  bar: {
    height: size.tabBar * 1.15,
    borderRadius: size.tabBar,
    backgroundColor: ui.tabBar,
    borderWidth: 1,
    borderColor: ui.border.hairlineStrong,
    overflow: 'hidden',
  },
  barInner: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  item: {
    alignItems: 'center',
    gap: 7,
  },
  glyph: {
    width: 22,
    height: 22,
    borderRadius: 7,
  },
  glyphCircular: {
    borderRadius: 11,
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
