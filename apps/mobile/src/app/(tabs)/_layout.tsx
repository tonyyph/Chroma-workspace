import { spacing } from '@chromawave/design-tokens';
import { Tabs } from 'expo-router';

import { usePreferences } from '@/providers/PreferencesProvider';

export default function TabsLayout() {
  const { colors, t } = usePreferences();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: {
          fontFamily: 'SourceSerif4_600SemiBold',
          fontSize: 12,
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        },
        tabBarStyle: {
          position: 'absolute',
          height: 72,
          paddingTop: spacing.xs,
          paddingBottom: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.canvas,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.today'),
          tabBarAccessibilityLabel: t('tabs.today'),
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: t('tabs.archive'),
          tabBarAccessibilityLabel: t('tabs.archive'),
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: t('tabs.capture'),
          tabBarAccessibilityLabel: t('tabs.capture'),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarAccessibilityLabel: t('tabs.settings'),
        }}
      />
    </Tabs>
  );
}
