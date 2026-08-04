import type { PaletteSet } from '@chromawave/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { CollectionScreen } from '@/features/sets/CollectionScreen';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { usePalettes } from '@/hooks/usePalettes';
import { useSets } from '@/hooks/useSets';
import { usePreferences } from '@/providers/PreferencesProvider';

export default function SetRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = usePreferences();
  const { palettes } = usePalettes();
  // Read the set out of the shared store rather than fetching a private copy:
  // a rename made here has to be the same object the Sets list is rendering.
  const { sets, loading, save: saveSet, remove: removeSet } = useSets();
  const set = sets.find((entry) => entry.id === id) ?? null;

  const update = useCallback(
    async (next: PaletteSet) => {
      try {
        await saveSet({ ...next, updatedAt: new Date().toISOString() });
      } catch {
        // What is on screen is still what is on disk, so nothing untrue is
        // shown; the edit simply did not take.
      }
    },
    [saveSet],
  );

  if (!set) return <ToolFallback loading={loading} title={t('sets.title')} />;

  return (
    <CollectionScreen
      isPro={false}
      onBack={router.back}
      onDelete={() => {
        void removeSet(set.id)
          .then(() => router.back())
          .catch(() => undefined);
      }}
      onMerge={() => router.push('/paywall?trigger=merge-set')}
      onRemovePalette={(paletteId) => {
        void update({ ...set, paletteIds: set.paletteIds.filter((entry) => entry !== paletteId) });
      }}
      onRename={(name) => void update({ ...set, name })}
      palettes={palettes.filter((palette) => set.paletteIds.includes(palette.id))}
      set={set}
    />
  );
}
