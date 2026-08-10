import { Tabs, useRouter } from 'expo-router';
import { useSkin } from '@/providers';
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
  const skin = useSkin();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Opaque, like the stack: each tab's own `Screen` paints the backdrop,
        // so a scene never needs to see the one it is replacing.
        sceneStyle: { backgroundColor: skin.ui.bg.base },
        // Four tabs stay mounted once visited, each with a backdrop of its own.
        // Frozen, the three in the background cost nothing per frame.
        freezeOnBlur: true,
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
