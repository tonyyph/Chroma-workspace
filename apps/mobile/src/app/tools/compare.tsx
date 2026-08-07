import { mergePalettes, type Palette } from '@chromawave/domain';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { CompareScreen } from '@/features/tools/CompareScreen';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { useComparePair, usePalettes } from '@/hooks';
import { usePreferences } from '@/providers';

/**
 * Merging two palettes here and merging a whole set on C3 are the same
 * operation, so it lives in the domain rather than being written twice — see
 * `mergePalettes`. This route just names the result and saves it.
 */
export default function CompareRoute() {
  const router = useRouter();
  const { t } = usePreferences();
  const { first, second, loading } = useComparePair();
  const { palettes, save } = usePalettes();

  if (!first || !second) {
    return (
      <ToolFallback body={t('compare.needTwo')} loading={loading} title={t('compare.title')} />
    );
  }

  const commitMerge = async () => {
    const now = new Date().toISOString();
    const merged: Palette = {
      schemaVersion: 1,
      id: Crypto.randomUUID(),
      name: t('compare.mergedName', { first: first.name, second: second.name }),
      createdAt: now,
      capturedAt: now,
      // A merge is derived from two saved palettes rather than captured, and the
      // schema has no source for that; both inputs came off photos.
      source: 'photo',
      colors: mergePalettes([first, second]),
      tags: [],
      location: null,
      photoUri: null,
      deltaE: 0,
      confidence: 1,
      space: first.space,
      tuned: true,
      setIds: [],
      isPinned: false,
    };
    try {
      await save(merged);
      router.replace(`/palette/${merged.id}`);
    } catch {
      // Nothing was written, so staying put is the truthful outcome — navigating
      // would land on a palette that does not exist.
    }
  };

  return (
    <CompareScreen
      candidates={palettes.filter((palette) => palette.id !== first.id && palette.id !== second.id)}
      first={first}
      onMerge={() => void commitMerge()}
      onPick={(id) => router.setParams({ id: first.id, vs: id })}
      onSwap={() => router.setParams({ id: second.id, vs: first.id })}
      second={second}
    />
  );
}
