import { render } from '@testing-library/react-native';
import Entry from '@/app/index';

let mockOnboardingCompleted = false;

jest.mock('expo-router', () => {
  // Jest factories are hoisted, so these imports must be resolved lazily.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(View, { accessibilityLabel: href, testID: 'redirect' }),
  };
});

jest.mock('@/providers/PreferencesProvider', () => ({
  usePreferences: () => ({ preferences: { onboardingCompleted: mockOnboardingCompleted } }),
}));

describe('first route', () => {
  it('sends a fresh install to onboarding', () => {
    mockOnboardingCompleted = false;
    expect(render(<Entry />).getByTestId('redirect')).toHaveProp(
      'accessibilityLabel',
      '/onboarding',
    );
  });

  it('sends a returning install to the library', () => {
    mockOnboardingCompleted = true;
    expect(render(<Entry />).getByTestId('redirect')).toHaveProp('accessibilityLabel', '/(tabs)');
  });
});
