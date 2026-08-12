import type { ChromaticMemory } from '@cw/domain';
import { useCallback, useEffect, useState } from 'react';
import { memoryRepository } from '@/infrastructure/dependencies';

/**
 * The whole library, as memories rather than as the palette view of them.
 *
 * `usePalettes` serves every colour tool and is the right shape for them.
 * Anything that reads the library *as a library* — what keeps coming back, what
 * happened a year ago today — needs the atmosphere and the music too, and those
 * live on the aggregate. See `MemoryBackedPaletteRepository`.
 */
export function useMemories(): {
  memories: readonly ChromaticMemory[];
  loading: boolean;
  failed: boolean;
  reload: () => void;
} {
  const [memories, setMemories] = useState<readonly ChromaticMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  useEffect(() => {
    let active = true;
    setFailed(false);
    void (async () => {
      try {
        const loaded = await memoryRepository.list();
        if (active) setMemories(loaded);
      } catch {
        // A library that cannot be read is worth saying out loud: every screen
        // above this one would otherwise render as though it were simply empty.
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  return { memories, loading, failed, reload };
}
