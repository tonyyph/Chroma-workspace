import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { TabBar } from './TabBar';

jest.mock('expo-blur', () => {
  const React = require('react');
  return {
    BlurView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('BlurView', null, children),
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  return {
    LinearGradient: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('LinearGradient', null, children),
  };
});

jest.mock('@/components/BrandMark', () => {
  const React = require('react');
  return {
    BrandMark: () => React.createElement('BrandMark'),
  };
});

jest.mock('@expo/vector-icons/Feather', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ name }: { name: string }) => React.createElement('FeatherIcon', { name }),
  };
});

const METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderTabBar({
  active = 'library',
  onCapture = jest.fn(),
  onSelect = jest.fn(),
}: Partial<React.ComponentProps<typeof TabBar>> = {}) {
  return render(
    <SafeAreaProvider initialMetrics={METRICS}>
      <TabBar active={active} onCapture={onCapture} onSelect={onSelect} />
    </SafeAreaProvider>,
  );
}

describe('TabBar', () => {
  it('exposes recognizable tab names and selected state', () => {
    const view = renderTabBar({ active: 'explore' });

    expect(view.getByRole('tab', { name: 'Library' })).toHaveProp('accessibilityState', {
      selected: false,
    });
    expect(view.getByRole('tab', { name: 'Explore' })).toHaveProp('accessibilityState', {
      selected: true,
    });
    expect(view.getByRole('tab', { name: 'Sets' })).toBeTruthy();
    expect(view.getByRole('tab', { name: 'You' })).toBeTruthy();
  });

  it('routes tab and capture presses through their callbacks', () => {
    const onCapture = jest.fn();
    const onSelect = jest.fn();
    const view = renderTabBar({ onCapture, onSelect });

    fireEvent.press(view.getByRole('tab', { name: 'Sets' }));
    fireEvent.press(view.getByRole('button', { name: 'Capture a colour' }));

    expect(onSelect).toHaveBeenCalledWith('sets');
    expect(onCapture).toHaveBeenCalledTimes(1);
  });
});
