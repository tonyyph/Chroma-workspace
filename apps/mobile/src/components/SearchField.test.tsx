import { fireEvent, render } from '@testing-library/react-native';

import { SearchField } from './SearchField';

describe('SearchField', () => {
  it('supports text entry and explicit search submission', () => {
    const onChangeText = jest.fn();
    const onSubmit = jest.fn();
    const screen = render(<SearchField onChangeText={onChangeText} onSubmit={onSubmit} value="" />);
    const field = screen.getByLabelText('Search notes, moods, sound');

    fireEvent.changeText(field, 'warm');
    fireEvent(field, 'submitEditing');

    expect(onChangeText).toHaveBeenCalledWith('warm');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
