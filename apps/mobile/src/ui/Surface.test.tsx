import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { PreferencesProvider } from '@/providers';
import { Pressable } from './Pressable';
import { CardGroup, Screen } from './Surface';
import { Text } from './Text';

/**
 * A grouped list whose membership changes.
 *
 * `CardGroup` wraps each child in a divider view of its own, and those wrappers
 * used to be keyed by position. When a conditional row disappeared, every later
 * row moved up an index and React reused each wrapper for a different row — the
 * rendered label updated while the press handler did not, so a row could say
 * "All photos" and open the camera when tapped.
 *
 * This is the worst shape a UI bug can take: nothing throws, nothing looks
 * wrong, and the control does something the user did not ask for. It is also
 * invisible to the source scans and to `screens.test.tsx`, which presses every
 * control but only asserts that pressing does not throw.
 */

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Rows({ onSecond }: { onSecond: () => void }) {
  /**
   * The first row is withdrawn from an effect, not from a press.
   *
   * This is how it happens in the source sheet: the row offering to show recent
   * photos exists until the permission answer arrives, and that answer resolves
   * a tick after mount. Removing it from a press instead does not reproduce the
   * bug — the reconciliation lands differently — so the test has to remove it
   * the way the real screen does.
   */
  const [showFirst, setShowFirst] = useState(true);
  useEffect(() => {
    void Promise.resolve().then(() => setShowFirst(false));
  }, []);

  return (
    <CardGroup>
      {showFirst ? (
        <Pressable
          accessibilityLabel="First"
          accessibilityRole="button"
          key="first"
          onPress={jest.fn()}
        >
          <Text>First</Text>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityLabel="Second"
        accessibilityRole="button"
        key="second"
        onPress={onSecond}
      >
        <Text>Second</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Third"
        accessibilityRole="button"
        key="third"
        onPress={jest.fn()}
      >
        <Text>Third</Text>
      </Pressable>
    </CardGroup>
  );
}

it('keeps a row bound to its own handler when an earlier row disappears', async () => {
  const user = userEvent.setup();
  const onSecond = jest.fn();

  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PreferencesProvider>
        <Rows onSecond={onSecond} />
      </PreferencesProvider>
    </SafeAreaProvider>,
  );

  // Withdrawing the first row shifts the other two up one position.
  await waitFor(() => expect(screen.queryByLabelText('First')).toBeNull());

  await user.press(screen.getByLabelText('Second'));

  expect(onSecond).toHaveBeenCalledTimes(1);
});

it('makes the scroll gesture area fill the whole screen', async () => {
  const view = render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PreferencesProvider>
        <Screen>
          <Text>Top</Text>
        </Screen>
      </PreferencesProvider>
    </SafeAreaProvider>,
  );

  await waitFor(() => expect(screen.getByText('Top')).toBeTruthy());

  const scrollView = view.UNSAFE_getByProps({ keyboardShouldPersistTaps: 'handled' });
  expect(StyleSheet.flatten(scrollView.props.style)).toMatchObject({ flex: 1 });
});
