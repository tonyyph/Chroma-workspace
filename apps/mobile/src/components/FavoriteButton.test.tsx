import { fireEvent, render } from '@testing-library/react-native';

import { FavoriteButton } from './FavoriteButton';

describe('FavoriteButton', () => {
  it('announces its selected state and invokes the durable action', () => {
    const onPress = jest.fn();
    const screen = render(<FavoriteButton active onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Remove from favorites' });
    expect(button.props.accessibilityState).toEqual({ selected: true });

    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
