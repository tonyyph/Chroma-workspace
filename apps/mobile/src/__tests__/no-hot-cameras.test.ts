import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { SOURCE_ROOT, openingTags, sources } from './jsxScan';

/**
 * A source scan for cameras that never stop.
 *
 * Vision Camera's `isActive` is what holds the capture session open. Written as
 * a bare attribute — `<Camera isActive .../>` — the session runs for as long as
 * the component is mounted, and a screen pushed on top of another does not
 * unmount it. Three screens in this app own a camera; navigating between them
 * left the one underneath running, so the app held two sessions, drained the
 * battery for a preview nobody could see, and contended for the sensor on
 * device.
 *
 * A runtime test cannot see this. `isActive` renders identically either way
 * under Jest — there is no session to observe — and the cost only appears on
 * hardware, in a screen the test is no longer looking at.
 *
 * The rule: bind it to focus. `useIsFocused()` is false for a screen that is
 * mounted but covered, which is exactly the case that was leaking.
 */

/** `isActive`, `isActive={true}`, `isActive = {true}` — all the same bug. */
const HARD_CODED = /(^|\s)isActive(\s*=\s*\{\s*true\s*\})?(\s|$|\/)/;

it('binds every camera session to whether its screen is on top', () => {
  const offenders = sources().flatMap((path) => {
    const source = readFileSync(path, 'utf8');
    return openingTags(source, 'Camera')
      .filter((attributes) => HARD_CODED.test(attributes))
      .map(() => relative(SOURCE_ROOT, path));
  });

  expect(offenders).toEqual([]);
});
