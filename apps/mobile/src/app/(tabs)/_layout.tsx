import { ui } from '@chromawave/design-tokens';
import { Tabs, useRouter } from 'expo-router';

import { TabBar, type TabKey } from '@/ui';

const routeForTab: Record<TabKey, string> = {
  library: 'index',
  explore: 'explore',
  sets: 'sets',
  you: 'you',
};

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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: ui.bg.base },
      }}
      tabBar={({ state, navigation }) => (
        <TabBar
          active={tabForRoute[state.routes[state.index]?.name ?? 'index'] ?? 'library'}
          onCapture={() => router.push('/capture')}
          onSelect={(key) => navigation.navigate(routeForTab[key] as never)}
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
