import { Tabs } from 'expo-router';

import { FloatingDock } from '@/components/FloatingDock';
import { usePreferences } from '@/providers/PreferencesProvider';

export default function TabsLayout() {
  const { colors, t } = usePreferences();
  return (
    <Tabs
      tabBar={(props) => <FloatingDock {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.canvas },
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
        name="atelier"
        options={{
          title: t('tabs.atelier'),
          tabBarAccessibilityLabel: t('tabs.atelier'),
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
