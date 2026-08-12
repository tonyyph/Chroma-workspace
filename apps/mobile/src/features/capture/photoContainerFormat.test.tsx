import { render, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { usePhotoOutput } from 'react-native-vision-camera';
import { ViewfinderScreen } from '@/features/capture/ViewfinderScreen';
import { ScanScreen } from '@/features/tools/ScanScreen';
import { EntitlementProvider, PreferencesProvider } from '@/providers';

/**
 * Every camera screen must shoot in a container Skia can decode.
 *
 * This is the guard on a bug that only appeared on hardware. Vision Camera's
 * `containerFormat` defaults to `'native'`, which on iOS is HEIC — and the Skia
 * binary that ships with `@shopify/react-native-skia` carries no HEIF codec
 * (`nm libskia.a` lists Jpeg, Png, Webp, Bmp, Ico, Wbmp, Raw and Wuffs, and
 * nothing else). So `MakeImageFromEncoded` returned null for every shot and the
 * read reported COULD NOT READ THAT FRAME. Simulators have no camera, so no test
 * and no amount of local use could have caught it.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    canGoBack: jest.fn(() => true),
    navigate: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
  Redirect: () => null,
}));

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** Preferences hydrate from storage before children render, so this waits. */
async function mount(element: ReactElement) {
  const view = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PreferencesProvider>
        <EntitlementProvider>{element}</EntitlementProvider>
      </PreferencesProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(view.toJSON()).not.toBeNull(), { timeout: 5000 });
  return view;
}

/** The formats present in the shipped Skia build. */
const DECODABLE = ['jpeg'];

const requested = () =>
  (usePhotoOutput as unknown as jest.Mock).mock.calls.map(
    (call) => (call[0] as { containerFormat?: string } | undefined)?.containerFormat,
  );

describe.each([
  ['Viewfinder', () => <ViewfinderScreen />],
  ['Scan', () => <ScanScreen onBuild={jest.fn()} onExit={jest.fn()} />],
])('%s', (_name, element) => {
  beforeEach(() => {
    (usePhotoOutput as unknown as jest.Mock).mockClear();
  });

  it('shoots in a container format Skia can decode', async () => {
    await mount(element());

    const formats = requested();
    expect(formats.length).toBeGreaterThan(0);
    for (const format of formats) expect(DECODABLE).toContain(format);
  });
});
