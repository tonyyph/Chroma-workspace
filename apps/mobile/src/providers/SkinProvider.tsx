import { skins, type Skin } from '@cw/tokens';
import { createContext, useContext, useMemo } from 'react';
import { usePreferences } from './PreferencesProvider';

/**
 * The look the app is currently wearing.
 *
 * Read by primitives rather than by screens. A screen that reached for skin
 * values directly would be deciding what a card looks like, which is the
 * primitive's job — and would be the thing that makes a second skin drift out
 * of alignment with the first.
 *
 * Derived from preferences rather than holding its own state, so there is one
 * place a choice is stored and one place it is persisted.
 */
const SkinContext = createContext<Skin | null>(null);

export function SkinProvider({ children }: { children: React.ReactNode }) {
  const { preferences } = usePreferences();
  const skin = useMemo(() => skins[preferences.skin] ?? skins.chroma, [preferences.skin]);
  return <SkinContext.Provider value={skin}>{children}</SkinContext.Provider>;
}

/**
 * Falls back to `chroma` rather than throwing.
 *
 * Unlike preferences or entitlements, a missing skin is not a programming error
 * worth taking the screen down for — every primitive calls this, including
 * inside error boundaries and test renders, and an appearance is the one thing
 * the app can always assume a default for.
 */
export function useSkin(): Skin {
  return useContext(SkinContext) ?? skins.chroma;
}
