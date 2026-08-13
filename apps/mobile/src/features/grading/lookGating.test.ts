import { hasEntitlement, LOOKS, look, lookCollectionIds, looksIn } from '@cw/domain';

/**
 * Which looks a free account can actually use.
 *
 * The catalogue carries `free` and both screens read it through the same
 * expression; this asserts the two agree on the shape of the offer, so "one
 * taster per collection" cannot quietly become none — the failure mode that
 * turns the grid into a wall and tells someone the app is not for them.
 */

/** The expression `GradeScreen` and `CameraStudioScreen` both pass to the grid. */
const lockedFor = (tier: 'free' | 'pro', id: string) =>
  !hasEntitlement(tier, 'advanced_grading') && !(look(id)?.free ?? false);

it('leaves exactly one look open per collection on the free tier', () => {
  for (const collection of lookCollectionIds) {
    const open = looksIn(collection).filter((entry) => !lockedFor('free', entry.id));
    expect(open).toHaveLength(1);
  }
});

it('locks nothing at all on pro', () => {
  expect(LOOKS.filter((entry) => lockedFor('pro', entry.id))).toEqual([]);
});

it('treats an unknown id as locked rather than as free', () => {
  // `look()` returning null must not fall open — a typo in a look id would
  // otherwise hand out whatever it names for nothing.
  expect(lockedFor('free', 'no-such-look')).toBe(true);
});
