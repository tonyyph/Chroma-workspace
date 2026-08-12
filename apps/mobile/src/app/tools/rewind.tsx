import { RewindScreen } from '@/features/rewind/RewindScreen';

/**
 * Reads the whole library rather than one palette, so unlike the other tool
 * routes it takes no `?id=` and needs no fallback for a missing one.
 */
export default function RewindRoute() {
  return <RewindScreen />;
}
