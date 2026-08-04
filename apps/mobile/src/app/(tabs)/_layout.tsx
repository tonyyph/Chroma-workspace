import { ui } from '@chromawave/design-tokens';
import { Tabs, useRouter } from 'expo-router';

import { usePreferences } from '@/providers/PreferencesProvider';
import { TabBar, type TabKey } from '@/ui';

/**
 * Tab key to route name. Typed as the literal names so `navigate` accepts it
 * without a cast — a cast here would hide a renamed route until someone tapped
 * the tab and nothing happened.
 */
const routeForTab = {
  library: 'index',
  explore: 'explore',
  sets: 'sets',
  you: 'you',
} as const satisfies Record<TabKey, string>;

const tabForRoute: Record<string, TabKey> = {
  index: 'library',
  explore: 'explore',
  sets: 'sets',
  you: 'you',
};

/**
 * FLOW C · the floating bar with the mark centred as the capture button.
 * `expo-router`'s Tabs owns the routes; the bar is ours because the design puts
 * a raised 56pt action in the middle of the row, which the stock tab bar has no
 * slot for.
 */
export default function TabLayout() {
  const router = useRouter();
  const { preferences } = usePreferences();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Transparent so the app-wide backdrop shows through the tabs too; the
        // canvas behind the navigator is what supplies the ground.
        sceneStyle: { backgroundColor: preferences.ambientBackdrop ? 'transparent' : ui.bg.base },
      }}
      tabBar={({ state, navigation }) => (
        <TabBar
          active={tabForRoute[state.routes[state.index]?.name ?? 'index'] ?? 'library'}
          onCapture={() => router.push('/capture')}
          onSelect={(key) => navigation.navigate(routeForTab[key])}
        />
      )}
    >
      <Tabs.Screen name="index" options={{ title: 'Library' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explore' }} />
      <Tabs.Screen name="sets" options={{ title: 'Sets' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
  );
}
