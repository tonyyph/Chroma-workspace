
// @expo/vector-icons resolves its glyph fonts through expo-font at import time.
// The icon set is a plain component here so screens render and their labels can
// still be asserted on.
jest.mock('@expo/vector-icons/Feather', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ name }: { name: string }) => React.createElement('FeatherIcon', { name }),
  };
});
