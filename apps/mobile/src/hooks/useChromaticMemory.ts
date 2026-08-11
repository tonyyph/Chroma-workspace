import {
  withSelectedTrack,
  type ChromaticMemory,
  type MusicFeedback,
  type MusicPairing,
  type MusicTrackReference,
} from '@chromawave/domain';
import { useCallback, useEffect, useState } from 'react';
import { memoryRepository } from '@/infrastructure/dependencies';
import { useLibraryStore } from '@/store/libraryStore';

/**
 * One Chromatic Memory, by id.
 *
 * Reads the aggregate directly rather than going through the palette
 * projection, because the music lives on parts of the record a `Palette` cannot
 * express. The projection stays the right door for anything colour-shaped; this
 * is the door for everything else.
 *
 * Refreshing the library store after a write is what keeps the archive's paired
 * marks and counts honest — the store is the one copy every screen subscribes
 * to, and a memory written behind its back would show as stale until remount.
 */
export function useChromaticMemory(id: string | undefined) {
  const [memory, setMemory] = useState<ChromaticMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const refreshLibrary = useLibraryStore((store) => store.refresh);

  const load = useCallback(async () => {
    if (!id) {
      setMemory(null);
      setLoading(false);
      return;
    }
    try {
      setMemory(await memoryRepository.get(id));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Attaches the chosen track, and the session's feedback along with it.
   *
   * The feedback rides on the same write rather than being persisted separately:
   * it is only meaningful next to the choice it explains, and two writes would
   * mean a crash between them could record a rejection for a pairing that never
   * happened.
   */
  const pairTrack = useCallback(
    async (track: MusicTrackReference, pairing: MusicPairing): Promise<boolean> => {
      if (!memory) return false;
      setSaving(true);
      try {
        const paired = withSelectedTrack(memory, track);
        const next: ChromaticMemory = {
          ...paired,
          musicPairing: {
            ...paired.musicPairing,
            recommendations: pairing.recommendations,
            recommendationVersion: pairing.recommendationVersion,
            feedback: mergeFeedback(paired.musicPairing.feedback, pairing.feedback),
          },
        };
        await memoryRepository.save(next);
        setMemory(next);
        await refreshLibrary();
        return true;
      } catch {
        setError(true);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [memory, refreshLibrary],
  );

  return { memory, loading, saving, error, reload: load, pairTrack };
}

/** Newest last, capped at the schema's limit of 50. */
function mergeFeedback(
  existing: readonly MusicFeedback[],
  incoming: readonly MusicFeedback[],
): MusicFeedback[] {
  return [...existing, ...incoming].slice(-50);
}
