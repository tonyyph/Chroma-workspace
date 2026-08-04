import { ui } from '@chromawave/design-tokens';
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
import { useCallback } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PreferencesProvider, usePreferences } from '@/providers/PreferencesProvider';
import { UnderScreenCanvas } from '@/ui';

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
      {/* A last-resort boundary: without one, any render error unmounts the tree and
          leaves a blank screen with no way back. */}
      <ErrorBoundary>
        <PreferencesProvider onReady={handlePreferencesReady}>
          <AppNavigator />
        </PreferencesProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

function AppNavigator() {
  const { preferences } = usePreferences();

  return (
    <>
      <StatusBar style="light" />
      {/* Behind the whole navigator, so it survives every push and pop rather
          than restarting its loop on each screen. */}
      <UnderScreenCanvas enabled={true} />
      <Stack
        screenOptions={{
          headerShown: false,
          // Transparent, or each screen would paint an opaque ground over the
          // backdrop and there would be nothing to see.
          contentStyle: {
            backgroundColor: preferences.ambientBackdrop ? 'transparent' : ui.bg.base,
          },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="capture"
          options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
        />
        <Stack.Screen name="capture/result" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="palette/[id]" />
      </Stack>
    </>
  );
}
