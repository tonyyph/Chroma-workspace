import type { Skin } from '@cw/tokens';
import { useMemo } from 'react';
import { useSkin } from '@/providers';

/**
 * A stylesheet built from the active skin.
 *
 * Screens keep their styles in one block at the foot of the file, which is the
 * right place for them — but that block runs at module scope, and a skin is not
 * known until render. The block becomes `makeStyles(skin)` and this memoises it
 * per skin, so switching appearance rebuilds it once rather than every frame,
 * and nothing has to be hoisted into JSX to become skin-aware.
 *
 * `make` is expected to be defined at module scope. A closure defined inside a
 * component would change identity every render and defeat the memo.
 */
export function useStyles<Styles>(make: (skin: Skin) => Styles): Styles {
  const skin = useSkin();
  return useMemo(() => make(skin), [make, skin]);
}
