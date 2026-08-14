import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { entitlements } from '@/infrastructure/dependencies';
import { EntitlementProvider, PreferencesProvider, useEntitlements } from '@/providers';
import { Text } from '@/ui';
import { ControlDeck } from './ControlDeck';

/**
 * The switch that stands in for a purchase until there is one to make.
 *
 * There is no billing provider in this build, so every Pro surface is
 * unreachable on a device: nothing can move the tier off `free`. This grants it
 * locally instead — and the reason it is worth a test rather than a hand-check
 * is the second case, that it leaves no trace in a build someone could ship.
 */

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

const DEV_TOGGLE = 'Pro unlocked (dev)';

/** Reads the same context every gate in the app reads. */
function TierProbe() {
  const { tier, has, ready } = useEntitlements();
  return (
    <>
      {/* Storage answers a beat after the first commit. Mounting waits for this
          rather than for the first frame, so the tier a case asserts on is one
          the provider has actually settled. */}
      <Text>{ready ? 'settled' : 'reading'}</Text>
      <Text>{`${tier}/${has('advanced_grading') ? 'graded' : 'locked'}`}</Text>
    </>
  );
}

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 428, height: 926 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

/** `PreferencesProvider` renders nothing until it has hydrated. */
async function mount(node: ReactElement) {
  const view = render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <PreferencesProvider>
        <EntitlementProvider>
          {node}
          <TierProbe />
        </EntitlementProvider>
      </PreferencesProvider>
    </SafeAreaProvider>,
  );
  await waitFor(() => expect(screen.getByText('settled')).toBeTruthy(), { timeout: 5000 });
  return view;
}

// The provider is a module singleton over one mocked MMKV instance, so a tier
// granted by one case is still there for the next one.
beforeEach(async () => {
  await entitlements.grant('free');
});

it('unlocks the Pro entitlements from the You screen', async () => {
  await mount(<ControlDeck unread={0} />);
  expect(screen.getByText('free/locked')).toBeTruthy();

  await userEvent.press(screen.getByLabelText(DEV_TOGGLE));

  await waitFor(() => expect(screen.getByText('pro/graded')).toBeTruthy());
});

it('locks them again when switched off', async () => {
  await entitlements.grant('pro');
  await mount(<ControlDeck unread={0} />);
  await waitFor(() => expect(screen.getByText('pro/graded')).toBeTruthy());

  await userEvent.press(screen.getByLabelText(DEV_TOGGLE));

  await waitFor(() => expect(screen.getByText('free/locked')).toBeTruthy());
});

it('survives a relaunch, so a granted tier is still there next reload', async () => {
  await mount(<ControlDeck unread={0} />);
  await userEvent.press(screen.getByLabelText(DEV_TOGGLE));
  await waitFor(() => expect(screen.getByText('pro/graded')).toBeTruthy());

  screen.unmount();
  await mount(<ControlDeck unread={0} />);

  await waitFor(() => expect(screen.getByText('pro/graded')).toBeTruthy());
});

it('is not in the tree at all outside a dev build', async () => {
  const dev = __DEV__;
  // @ts-expect-error -- Metro defines this global; a test is the only place it moves.
  global.__DEV__ = false;
  try {
    await mount(<ControlDeck unread={0} />);
    expect(screen.queryByLabelText(DEV_TOGGLE)).toBeNull();
  } finally {
    // @ts-expect-error -- see above.
    global.__DEV__ = dev;
  }
});
