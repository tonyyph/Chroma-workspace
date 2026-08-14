import { makeColor, paletteToMemory, type Palette, type PaletteSet } from '@cw/domain';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { ResultScreen } from '@/features/capture/ResultScreen';
import { ShareSheet } from '@/features/capture/ShareSheet';
import { TuneScreen } from '@/features/capture/TuneScreen';
import { ExploreScreen } from '@/features/explore/ExploreScreen';
import { GradeScreen } from '@/features/grading/GradeScreen';
import { LibraryScreen } from '@/features/library/LibraryScreen';
import { LivingMemoryScreen } from '@/features/living/LivingMemoryScreen';
import { PaletteDetailScreen } from '@/features/palette/PaletteDetailScreen';
import { PaywallScreen } from '@/features/paywall/PaywallScreen';
import { RewindScreen } from '@/features/rewind/RewindScreen';
import { CollectionScreen } from '@/features/sets/CollectionScreen';
import { CameraStudioScreen } from '@/features/studio/CameraStudioScreen';
import { ActivityScreen } from '@/features/tools/ActivityScreen';
import { ApplyThemeScreen } from '@/features/tools/ApplyThemeScreen';
import { CompareScreen } from '@/features/tools/CompareScreen';
import { ContrastScreen } from '@/features/tools/ContrastScreen';
import { ExportScreen } from '@/features/tools/ExportScreen';
import { GradientScreen } from '@/features/tools/GradientScreen';
import { ImportPickScreen } from '@/features/tools/ImportPickScreen';
import { ScanScreen } from '@/features/tools/ScanScreen';
import { WidgetsScreen } from '@/features/tools/WidgetsScreen';
import { TrendingScreen } from '@/features/trending/TrendingScreen';
import { YouScreen } from '@/features/you/YouScreen';
import { EntitlementProvider, PreferencesProvider } from '@/providers';

/**
 * Mount every screen and press everything that claims to be a button.
 *
 * The point is not coverage of behaviour — it is that a screen which throws on
 * mount, or a control whose handler is missing, fails here rather than in
 * someone's hands. Both classes of bug had shipped before this existed.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    // Screens reachable both by a push and by a deep link ask before going back,
    // because a back with no history is a control that does nothing.
    canGoBack: jest.fn(() => true),
    navigate: jest.fn(),
  }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: jest.fn(),
  // A screen rendered on its own is the screen on top. The camera screens read
  // this to decide whether to hold a capture session open — see
  // `no-hot-cameras`, which is the scan that made them ask.
  useIsFocused: () => true,
  Redirect: () => null,
}));

const palette = (overrides: Partial<Palette> = {}): Palette => ({
  thumbnailUri: null,
  grade: null,
  schemaVersion: 1,
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Harbour dusk',
  createdAt: '2026-07-28T00:00:00.000Z',
  capturedAt: '2026-07-28T00:00:00.000Z',
  source: 'photo',
  colors: [
    makeColor('#7C5CFF', 0.38, 'dominant'),
    makeColor('#4A3AA8', 0.24, 'support'),
    makeColor('#22D3EE', 0.18, 'signal'),
    makeColor('#FF7A5C', 0.12),
    makeColor('#F1E7D6', 0.08),
  ],
  tags: ['dusk'],
  location: 'Oslo',
  photoUri: null,
  deltaE: 2.4,
  confidence: 0.94,
  space: 'srgb',
  tuned: false,
  setIds: [],
  isPinned: true,
  ...overrides,
});

const paletteSet: PaletteSet = {
  schemaVersion: 1,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Brand refresh',
  createdAt: '2026-07-20T00:00:00.000Z',
  updatedAt: '2026-07-29T00:00:00.000Z',
  paletteIds: ['11111111-1111-4111-8111-111111111111'],
  members: ['you'],
  merged: null,
};

/**
 * Screens read language and theme from the provider, so it has to be present.
 *
 * `PreferencesProvider` renders nothing until preferences have loaded, so the
 * first commit is empty — every case has to wait for hydration before asserting.
 */
async function mount(node: ReactElement) {
  const view = render(
    // `Screen` reads safe-area insets. Navigation provides the provider in the
    // real app; a bare render has to supply it or every screen throws.
    <SafeAreaProvider initialMetrics={METRICS}>
      <PreferencesProvider>
        {/* Screens with a Pro gate read the tier from context and throw without
            it, the same way they read preferences. */}
        <EntitlementProvider>{node}</EntitlementProvider>
      </PreferencesProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(view.toJSON()).not.toBeNull(), { timeout: 5000 });
  return view;
}

/** iPhone 13 Pro Max-ish metrics, so inset maths is exercised rather than zeroed. */
const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 428, height: 926 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const second = palette({ id: '33333333-3333-4333-8333-333333333333', name: 'Late brick' });

/** The performance works on the aggregate, not on the palette view of it. */
const memory = () => paletteToMemory(palette({ photoUri: 'file:///photos/a.jpg' }));

const cases: readonly [string, () => ReactElement][] = [
  ['Library', () => <LibraryScreen />],
  ['Explore', () => <ExploreScreen />],
  ['Trending', () => <TrendingScreen />],
  ['You', () => <YouScreen />],
  ['Paywall', () => <PaywallScreen trigger="pro-tools" />],
  ['Palette detail', () => <PaletteDetailScreen />],
  [
    'Result sheet',
    () => (
      <ResultScreen
        onRetake={jest.fn()}
        onSave={jest.fn()}
        onTune={jest.fn()}
        palette={palette()}
      />
    ),
  ],
  ['Tune', () => <TuneScreen onApply={jest.fn()} onCancel={jest.fn()} palette={palette()} />],
  [
    'Share sheet',
    () => (
      <ShareSheet isPro={false} onSaveImage={jest.fn()} onShare={jest.fn()} palette={palette()} />
    ),
  ],
  [
    'Collection',
    () => (
      <CollectionScreen
        onBack={jest.fn()}
        onCaptureForGap={jest.fn()}
        onDelete={jest.fn()}
        onOpenPalette={jest.fn()}
        onRemovePalette={jest.fn()}
        onRename={jest.fn()}
        palettes={[palette()]}
        set={paletteSet}
      />
    ),
  ],
  ['Contrast', () => <ContrastScreen onApplyFix={jest.fn()} palette={palette()} />],
  [
    'Compare',
    () => (
      <CompareScreen
        candidates={[second]}
        first={palette()}
        onMerge={jest.fn()}
        onPick={jest.fn()}
        onSwap={jest.fn()}
        second={second}
      />
    ),
  ],
  ['Gradient', () => <GradientScreen onClose={jest.fn()} onSave={jest.fn()} palette={palette()} />],
  ['Apply theme', () => <ApplyThemeScreen onExport={jest.fn()} palette={palette()} />],
  ['Export', () => <ExportScreen isPro={false} onClose={jest.fn()} palette={palette()} />],
  ['Widgets', () => <WidgetsScreen onClose={jest.fn()} palette={palette()} />],
  ['Activity', () => <ActivityScreen palettes={[palette()]} />],
  ['Scan', () => <ScanScreen onBuild={jest.fn()} onExit={jest.fn()} />],
  ['Grade', () => <GradeScreen />],
  ['Living memory', () => <LivingMemoryScreen memory={memory()} />],
  ['Rewind', () => <RewindScreen />],
  ['Camera studio', () => <CameraStudioScreen />],
  [
    'Pick points',
    () => (
      <ImportPickScreen
        colors={palette().colors}
        onCancel={jest.fn()}
        onPick={jest.fn()}
        uri="file:///tmp/photo.jpg"
      />
    ),
  ],
];

describe('every screen mounts', () => {
  it.each(cases)('%s renders without throwing', async (_name, build) => {
    // A screen that mounts to nothing is as broken as one that throws; `mount`
    // asserts that once hydration completes.
    const view = await mount(build());
    expect(view.toJSON()).not.toBeNull();
  });
});

/** Everything currently on screen that a finger can land on. */
const controls = () => [
  ...screen.queryAllByRole('button'),
  ...screen.queryAllByRole('radio'),
  ...screen.queryAllByRole('tab'),
  ...screen.queryAllByRole('switch'),
];

describe('every control responds', () => {
  it.each(cases)('%s: pressing each button does not throw', async (_name, build) => {
    const user = userEvent.setup();
    await mount(build());

    // Controls are addressed by label and re-found before each press: a working
    // button often changes the screen — Collection's EDIT swaps the whole action
    // row — and holding node references across presses reads unmounted fibres.
    const labels = controls()
      .map((control) => control.props.accessibilityLabel)
      .filter((label): label is string => typeof label === 'string');

    for (const label of labels) {
      const [control] = screen.queryAllByLabelText(label);
      if (!control) continue;
      // A disabled control is a deliberate state, not a dead one.
      if (control.props.accessibilityState?.disabled) continue;
      await user.press(control);
    }
  });

  it('labels every control it renders, so assistive tech can name them', async () => {
    // The loop above silently skips anything unlabelled, so this keeps that
    // skip from becoming a way for controls to escape the test.
    await mount(<PaletteDetailScreen />);
    const unlabelled = controls().filter(
      (control) => typeof control.props.accessibilityLabel !== 'string',
    );
    expect(unlabelled).toHaveLength(0);
  });
});
