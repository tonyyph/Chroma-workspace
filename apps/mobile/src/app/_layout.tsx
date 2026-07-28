import 'react-native-gesture-handler';

import {
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_500Medium,
} from '@expo-google-fonts/playfair-display';
import {
  SourceSerif4_400Regular,
  SourceSerif4_500Medium,
  SourceSerif4_600SemiBold,
} from '@expo-google-fonts/source-serif-4';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback } from 'react';

import { PreferencesProvider, usePreferences } from '@/providers/PreferencesProvider';

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: 'index',
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_500Medium,
    SourceSerif4_400Regular,
    SourceSerif4_500Medium,
    SourceSerif4_600SemiBold,
  });
  const handlePreferencesReady = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <PreferencesProvider onReady={handlePreferencesReady}>
      <AppNavigator />
    </PreferencesProvider>
  );
}

function AppNavigator() {
  const { colors, mode } = usePreferences();

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="capture/review" />
        <Stack.Screen name="capture/palette" />
        <Stack.Screen name="capture/pairing" />
        <Stack.Screen name="capture/compose" />
        <Stack.Screen name="memory/[id]" />
      </Stack>
    </>
  );
}
