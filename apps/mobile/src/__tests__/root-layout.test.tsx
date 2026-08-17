import { act, render, within } from '@testing-library/react-native';
import RootLayout from '@/app/_layout';

jest.mock('@expo-google-fonts/ibm-plex-mono', () => ({
  IBMPlexMono_400Regular: 'IBMPlexMono_400Regular',
  IBMPlexMono_500Medium: 'IBMPlexMono_500Medium',
  IBMPlexMono_600SemiBold: 'IBMPlexMono_600SemiBold',
}));
jest.mock('@expo-google-fonts/space-grotesk', () => ({
  SpaceGrotesk_400Regular: 'SpaceGrotesk_400Regular',
  SpaceGrotesk_500Medium: 'SpaceGrotesk_500Medium',
  SpaceGrotesk_600SemiBold: 'SpaceGrotesk_600SemiBold',
  SpaceGrotesk_700Bold: 'SpaceGrotesk_700Bold',
}));
jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(async () => undefined),
  preventAutoHideAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stack = Object.assign(
    ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, { testID: 'app-navigator' }, children),
    { Screen: () => null },
  );
  // The navigator reads the router so a tapped notification can be routed.
  return { Stack, useRouter: () => ({ push: jest.fn() }) };
});
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GestureHandlerRootView: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) => React.createElement(View, { style, testID: 'gesture-handler-root' }, children),
    // `ui/Pressable` wraps React Native's Pressable in a gesture-handler native
    // wrapper at module scope, and the layout reaches it through the error
    // boundary's imports. A mock missing this throws at import time, before any
    // assertion here runs.
    createNativeWrapper: (Component: unknown) => Component,
  };
});
/**
 * The real provider renders nothing until it has measured, and nothing lays out
 * in a test renderer — this assertion is about where the navigator sits in the
 * tree, not about insets.
 */
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    initialWindowMetrics: null,
    useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 428, height: 926 }),
  };
});

jest.mock('@/providers/PreferencesProvider', () => {
  const React = require('react');
  return {
    PreferencesProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    // The layout reads preferences to decide whether the ambient backdrop is on.
    // Without this the hook is undefined, the layout throws, and the error
    // boundary renders instead — which looks like a safe-area failure rather
    // than an incomplete mock.
    usePreferences: () => ({ preferences: { ambientBackdrop: false } }),
  };
});

describe('RootLayout', () => {
  it('keeps the navigator inside GestureHandlerRootView', async () => {
    const view = render(<RootLayout />);
    const gestureRoot = view.getByTestId('gesture-handler-root');

    expect(within(gestureRoot).getByTestId('app-navigator')).toBeTruthy();

    // `RootLayout` mounts `EntitlementProvider`, which reads the tier from
    // storage and sets state once it lands — after this synchronous assertion.
    // Flushing inside `act` keeps that update from arriving after the test has
    // finished, which is what React was warning about.
    await act(async () => {});
  });
});
