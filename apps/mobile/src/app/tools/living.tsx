import { useLocalSearchParams } from 'expo-router';
import { LivingMemoryScreen } from '@/features/living/LivingMemoryScreen';
import { ToolFallback } from '@/features/tools/ToolFallback';
import { useChromaticMemory } from '@/hooks';

/**
 * The performance reads the *memory*, not the palette view of it.
 *
 * Every other tool route works on a `Palette` because every other tool works on
 * colour. This one needs the track and the atmosphere too, and those live on the
 * aggregate rather than on the view — see `MemoryBackedPaletteRepository`.
 */
export default function LivingRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { memory, loading } = useChromaticMemory(id);

  if (!memory) return <ToolFallback loading={loading} title="Living memory" />;
  return <LivingMemoryScreen memory={memory} />;
}
