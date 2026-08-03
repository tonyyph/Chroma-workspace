import type { PaletteSet } from '@chromawave/domain';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { CollectionScreen } from '@/features/sets/CollectionScreen';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { usePalettes } from '@/hooks/usePalettes';
import { setRepository } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';

export default function SetRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = usePreferences();
  const { palettes } = usePalettes();
  const [set, setSet] = useState<PaletteSet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void setRepository
      .get(id)
      .then(setSet)
      .finally(() => setLoading(false));
  }, [id]);

  /**
   * Edits persist through the repository and then re-read, rather than mutating
   * the local copy — the Sets list reads from the same store and would otherwise
   * keep showing the old name until relaunch.
   */
  const update = useCallback(async (next: PaletteSet) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    try {
      await setRepository.save(stamped);
      setSet(stamped);
    } catch {
      // What is on screen is still what is on disk, so nothing untrue is shown;
      // the edit simply did not take.
    }
  }, []);

  if (!set) return <ToolFallback loading={loading} title={t('sets.title')} />;

  return (
    <CollectionScreen
      isPro={false}
      onBack={router.back}
      onDelete={() => {
        void setRepository
          .remove(set.id)
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
