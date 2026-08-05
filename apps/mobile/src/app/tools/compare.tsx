import { hexDeltaE00, makeColor, type Color, type Palette } from '@chromawave/domain';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { CompareScreen } from '@/features/tools/CompareScreen';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { useComparePair } from '@/hooks/usePaletteParam';
import { usePalettes } from '@/hooks/usePalettes';
import { usePreferences } from '@/providers/PreferencesProvider';

/** Colours closer than this count as the same colour when merging. */
const SAME_COLOUR = 5;

/**
 * Unions two palettes, dropping the near-duplicates.
 *
 * Concatenating would give ten colours of which several pairs are
 * indistinguishable, so ΔE00 decides what is genuinely distinct — the same
 * measure the matrix on screen reports. Weights are renormalised afterwards
 * because dropping colours leaves them summing to less than one.
 */
function merge(first: Palette, second: Palette): readonly Color[] {
  const kept: Color[] = [];
  for (const color of [...first.colors, ...second.colors]) {
    if (kept.some((existing) => hexDeltaE00(existing.hex, color.hex) < SAME_COLOUR)) continue;
    kept.push(color);
  }

  const top = [...kept].sort((a, b) => b.weight - a.weight).slice(0, 5);
  const total = top.reduce((sum, color) => sum + color.weight, 0) || 1;
  const roles = ['dominant', 'support', 'signal'] as const;
  const rebalanced = top.map((color, index) =>
    makeColor(color.hex, Math.round((color.weight / total) * 1000) / 1000, roles[index] ?? 'extra'),
  );

  // Rounding leaves a remainder; push it onto the dominant so weights sum to one.
  const drift = 1 - rebalanced.reduce((sum, color) => sum + color.weight, 0);
  const dominant = rebalanced[0];
  if (dominant) {
    rebalanced[0] = { ...dominant, weight: Math.round((dominant.weight + drift) * 1000) / 1000 };
  }
  return rebalanced;
}

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
      colors: [...merge(first, second)],
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
