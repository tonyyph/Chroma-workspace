import { fireEvent, render } from '@testing-library/react-native';

import { StateView } from './StateView';

describe('StateView', () => {
  it('exposes recovery copy and action by accessible name', () => {
    const onAction = jest.fn();
    const screen = render(
      <StateView
        actionLabel="Try again"
        body="The local image could not be decoded."
        onAction={onAction}
        title="Palette extraction failed"
      />,
    );

    expect(screen.getByText('Palette extraction failed')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
