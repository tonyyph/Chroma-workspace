import { fireEvent, render } from '@testing-library/react-native';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { ConfirmSheet, PromptSheet } from './Menu';

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const safeRender = (node: React.ReactNode) =>
  render(<SafeAreaProvider initialMetrics={METRICS}>{node}</SafeAreaProvider>);

describe('custom modal sheets', () => {
  it('keeps the edit prompt above the keyboard and submits trimmed content', () => {
    const onConfirm = jest.fn();
    const view = safeRender(
      <PromptSheet
        cancelLabel="Cancel"
        confirmLabel="Save"
        initialValue="Old name"
        onConfirm={onConfirm}
        onDismiss={jest.fn()}
        placeholder="Palette name"
        title="Rename"
        visible
      />,
    );

    expect(view.UNSAFE_getByType(KeyboardAvoidingView).props.behavior).toBe(
      Platform.OS === 'ios' ? 'padding' : 'height',
    );
    fireEvent.changeText(view.getByLabelText('Rename'), '  New name  ');
    fireEvent.press(view.getByRole('button', { name: 'Save' }));

    expect(onConfirm).toHaveBeenCalledWith('New name');
  });

  it('uses the branded confirmation sheet for destructive actions', () => {
    const onConfirm = jest.fn();
    const view = safeRender(
      <ConfirmSheet
        body="This cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        onConfirm={onConfirm}
        onDismiss={jest.fn()}
        title="Delete palette?"
        visible
      />,
    );

    expect(view.getByText('This cannot be undone.')).toBeTruthy();
    fireEvent.press(view.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
