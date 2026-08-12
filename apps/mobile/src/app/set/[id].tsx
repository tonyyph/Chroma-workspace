import type { PaletteSet } from '@cw/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { CollectionScreen } from '@/features/sets/CollectionScreen';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { usePalettes, useSets } from '@/hooks';
import { usePreferences } from '@/providers';

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
      onBack={router.back}
      // The capture is scoped to this set, so saving it writes membership and
      // comes back here rather than stranding the user on a palette detail.
      onCaptureForGap={() => router.push(`/capture?setId=${set.id}`)}
      onDelete={() => {
        void removeSet(set.id)
          .then(() => router.back())
          .catch(() => undefined);
      }}
      onOpenPalette={(paletteId) => router.push(`/palette/${paletteId}`)}
      onRemovePalette={(paletteId) => {
        void update({ ...set, paletteIds: set.paletteIds.filter((entry) => entry !== paletteId) });
      }}
      onRename={(name) => void update({ ...set, name })}
      palettes={palettes.filter((palette) => set.paletteIds.includes(palette.id))}
      set={set}
    />
  );
}
