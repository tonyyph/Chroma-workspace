import { readFileSync } from 'node:fs';
import { SOURCE_ROOT, openingTags, sources } from './jsxScan';

/**
 * A source scan for the two-tap bug.
 *
 * A scroll view's default `keyboardShouldPersistTaps` is `"never"`: while a
 * field has focus, the first tap anywhere inside the scroll view is spent
 * dismissing the keyboard and never reaches the control under the finger. Every
 * button, chip and nav action on a screen with an open keyboard then needs two
 * taps, which reads as the app ignoring the first one.
 *
 * It cannot be caught by pressing things in a test — `fireEvent.press` does not
 * go through the responder chain that swallows the tap — and it is invisible in
 * review, because the offending prop is the one that is *absent*. So it is
 * asserted here, on the source.
 *
 * `"handled"` is the setting that wants: a tap a control takes is delivered to
 * the control, and a tap on nothing still dismisses the keyboard.
 */

const CONTAINERS = ['ScrollView', 'Animated.ScrollView', 'FlatList', 'Animated.FlatList'];

const files = sources();

describe('no scroll container swallows the first tap', () => {
  it('finds sources to scan at all', () => {
    // A broken walk would make the assertion below vacuously pass.
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(CONTAINERS)('every <%s> sets keyboardShouldPersistTaps', (container) => {
    const offenders = files.flatMap((file) =>
      openingTags(readFileSync(file, 'utf8'), container)
        .filter((tag) => !tag.includes('keyboardShouldPersistTaps'))
        .map(() => file.replace(SOURCE_ROOT, 'src')),
    );
    expect(offenders).toEqual([]);
  });
});
