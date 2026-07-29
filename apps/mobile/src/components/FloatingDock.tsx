import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { radius, shadow, spacing, touchTarget } from '@chromawave/design-tokens';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { AppText } from './AppText';
import { BrandMark } from './BrandMark';
import { usePreferences } from '@/providers/PreferencesProvider';

const dockRoutes = ['index', 'archive', 'capture', 'atelier', 'settings'] as const;

function DockGlyph({ route, active }: { route: string; active: boolean }) {
  const { colors } = usePreferences();
  const ink = active ? colors.accent : colors.textSubtle;

  if (route === 'capture') return <BrandMark size={54} />;
  if (route === 'index') {
    return (
      <View style={[styles.orbit, { borderColor: ink }]}>
        <View style={[styles.orbitCore, { backgroundColor: ink }]} />
      </View>
    );
  }
  if (route === 'archive') {
    return (
      <View style={styles.stack}>
        <View style={[styles.stackLine, { backgroundColor: ink }]} />
        <View style={[styles.stackLine, styles.stackLineShort, { backgroundColor: ink }]} />
      </View>
    );
  }
  if (route === 'atelier') {
    return (
      <View style={[styles.diamond, { borderColor: ink }]}>
        <View style={[styles.diamondCore, { backgroundColor: ink }]} />
      </View>
    );
  }
  return (
    <View style={[styles.settingRing, { borderColor: ink }]}>
      <View style={[styles.settingCore, { borderColor: ink }]} />
    </View>
  );
}

export function FloatingDock({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors, t } = usePreferences();
  const reducedMotion = useReducedMotion();
  const activeRoute = state.routes[state.index]?.name;
  const localizedLabels: Record<(typeof dockRoutes)[number], string> = {
    index: t('tabs.today'),
    archive: t('tabs.archive'),
    capture: t('tabs.capture'),
    atelier: t('tabs.atelier'),
    settings: t('tabs.settings'),
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.layer, { height: 106 + Math.max(insets.bottom, spacing.sm) }]}
    >
      <View pointerEvents="none" style={[styles.backdrop, { backgroundColor: colors.canvas }]} />
      <Animated.View
        {...(!reducedMotion ? { entering: FadeInDown.duration(320) } : {})}
        style={[
          styles.frame,
          shadow.dock,
          {
            bottom: Math.max(insets.bottom, spacing.sm),
            backgroundColor: colors.canvasElevated,
            borderColor: colors.border,
          },
        ]}
      >
        {dockRoutes.map((routeName) => {
          const route = state.routes.find((candidate) => candidate.name === routeName);
          const options = route ? descriptors[route.key]?.options : undefined;
          const active = activeRoute === routeName;
          const isCapture = routeName === 'capture';
          const label = localizedLabels[routeName];
          return (
            <Pressable
              accessibilityLabel={options?.tabBarAccessibilityLabel ?? label}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={routeName}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route?.key ?? routeName,
                  canPreventDefault: true,
                });
                if (!active && !event.defaultPrevented) navigation.navigate(routeName);
              }}
              onLongPress={() =>
                navigation.emit({ type: 'tabLongPress', target: route?.key ?? routeName })
              }
              style={({ pressed }) => [
                styles.item,
                isCapture && [
                  styles.capture,
                  shadow.raised,
                  {
                    backgroundColor: colors.surfaceRaised,
                    borderColor: active ? colors.accent : colors.border,
                  },
                ],
                pressed && styles.pressed,
              ]}
            >
              <DockGlyph active={active} route={routeName} />
              {!isCapture ? (
                <AppText
                  numberOfLines={1}
                  style={styles.label}
                  tone={active ? 'accent' : 'subtle'}
                  variant="caption"
                >
                  {label.toLocaleUpperCase()}
                </AppText>
              ) : null}
              {active && !isCapture ? (
                <View style={[styles.activeMark, { backgroundColor: colors.accent }]} />
              ) : null}
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.96,
  },
  frame: {
    position: 'absolute',
    right: spacing.md,
    left: spacing.md,
    minHeight: 78,
    paddingHorizontal: spacing.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flex: 1,
    minWidth: touchTarget.minimum,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
  capture: {
    flex: 0,
    width: 72,
    height: 72,
    marginHorizontal: spacing.xs,
    marginTop: -26,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: {
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.7,
  },
  activeMark: {
    position: 'absolute',
    bottom: 3,
    width: 12,
    height: 2,
    borderRadius: radius.pill,
  },
  orbit: {
    width: 23,
    height: 23,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitCore: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
  },
  stack: {
    width: 24,
    height: 22,
    justifyContent: 'center',
    gap: 6,
  },
  stackLine: {
    height: 2,
    width: 24,
    borderRadius: radius.pill,
  },
  stackLineShort: {
    width: 16,
    alignSelf: 'flex-end',
  },
  diamond: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondCore: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
  },
  settingRing: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCore: {
    width: 8,
    height: 8,
    borderWidth: 1.5,
    borderRadius: radius.pill,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
});
