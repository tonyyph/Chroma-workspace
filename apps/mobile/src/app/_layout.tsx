import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components';
import { syncDrop } from '@/features/trending/trendingRepository';
import { useNotificationRoute, useWidgetSnapshot } from '@/hooks';
import { storage } from '@/infrastructure/dependencies';
import {
  EntitlementProvider,
  PreferencesProvider,
  SkinProvider,
  usePreferences,
  useSkin,
} from '@/providers';
import { BackdropDriver, HeroOverlay } from '@/ui';

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });
  const handlePreferencesReady = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Expo Router creates one of these *inside* the navigator, which is
          enough for screens and not enough for anything drawn beside them —
          the hero overlay is a sibling of the Stack and needs the insets too. */}
      {/* Seeded with the metrics the native side already knows at launch.
          Without them the provider renders nothing until its first layout pass,
          which is a blank frame between the splash and the first screen. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        {/* A last-resort boundary: without one, any render error unmounts the tree and
            leaves a blank screen with no way back. */}
        <ErrorBoundary>
          <PreferencesProvider onReady={handlePreferencesReady}>
            {/* Inside preferences, because entitlements gate features rather than
                configure them — nothing here blocks first paint. */}
            <EntitlementProvider>
              {/* Under preferences, which is where the choice is stored. */}
              <SkinProvider>
                <AppNavigator />
              </SkinProvider>
            </EntitlementProvider>
          </PreferencesProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function AppNavigator() {
  const { preferences } = usePreferences();
  const skin = useSkin();

  // Inside the navigator, because it navigates: a router call from above the
  // Stack has nothing mounted to act on.
  useNotificationRoute();

  // Publishes the library to the App Group the widget reads. Gated on the
  // content having changed, so a re-render costs a comparison and no reload.
  useWidgetSnapshot();

  /**
   * Pulls this week's field notes once per launch. Deliberately unawaited and
   * unguarded: the feed already has the bundled catalogue to show, so nothing on
   * screen is waiting on this and a failure changes nothing.
   */
  useEffect(() => {
    void syncDrop(storage);
  }, []);

  return (
    <>
      <StatusBar style="light" />
      {/* The field's clock, not the field itself: each screen draws its own copy
          from these values, so it survives every push and pop rather than
          restarting its loop on each screen. */}
      {preferences.ambientBackdrop ? <BackdropDriver /> : null}
      <Stack
        screenOptions={{
          headerShown: false,
          // Opaque. A transparent stack lets the outgoing screen show through
          // the incoming one for the whole transition — the backdrop is painted
          // inside each screen instead, so nothing here needs to see past it.
          contentStyle: { backgroundColor: skin.ui.bg.base },
          // The platform push: the new screen covers the old one, and iOS keeps
          // its interactive back-swipe, which a fade throws away.
          animation: 'default',
          // A covered screen renders nothing until it is on show again. Without
          // this, everything below the top of the stack keeps re-rendering
          // through the transition, competing with it for the same frames.
          freezeOnBlur: true,
        }}
      >
        {/* A redirect, and the roots it redirects to — nothing is being pushed
            over anything, so these cross-fade rather than slide in from a side
            the user never navigated from. */}
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="capture"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
        <Stack.Screen name="capture/result" options={{ animation: 'slide_from_bottom' }} />
        {/* Cross-fades rather than sliding: the hero flying in from the card is
            the motion here, and a screen sliding under it would be a second one
            going a different way. */}
        <Stack.Screen name="palette/[id]" options={{ animation: 'fade' }} />
        {/* Pushed from the library's trending rail, so it slides in over the
            tabs rather than replacing them the way a tab switch would. */}
        <Stack.Screen name="trending" options={{ animation: 'slide_from_right' }} />
      </Stack>
      {/* Over the navigator, so the strip is not clipped by the screen it is
          leaving or the one it is arriving at. */}
      <HeroOverlay />
    </>
  );
}
