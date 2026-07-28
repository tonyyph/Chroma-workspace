import { fireEvent, render } from '@testing-library/react-native';

import { TrackOption } from './TrackOption';

const recommendation = {
  track: {
    id: 'mock-soft-orbit',
    provider: 'mock' as const,
    title: 'Soft Orbit',
    artist: 'CHROMAWAVE Sessions',
    artworkUrl: null,
    previewUrl: null,
    externalUrl: null,
    audioFeatures: { valence: 0.6, energy: 0.2, acousticness: 0.8, tempo: 76 },
  },
  explanation: 'Quiet color variation paired with restorative texture.',
  score: 0.94,
};

describe('TrackOption', () => {
  it('communicates selection without relying on color', () => {
    const onPress = jest.fn();
    const screen = render(
      <TrackOption onPress={onPress} recommendation={recommendation} selected />,
    );

    const option = screen.getByRole('radio', { name: /Soft Orbit/ });
    expect(option.props.accessibilityState).toEqual({ selected: true });
    fireEvent.press(option);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
