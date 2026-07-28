import type { Memory } from '@chromawave/domain';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { memoryRepository } from '@/infrastructure/dependencies';

export type LibraryStatus = 'loading' | 'ready' | 'error';

export function useMemoryLibrary() {
  const [memories, setMemories] = useState<readonly Memory[]>([]);
  const [status, setStatus] = useState<LibraryStatus>('loading');

  const load = useCallback(() => {
    let active = true;
    setStatus('loading');
    memoryRepository
      .list()
      .then((items) => {
        if (!active) return;
        setMemories(items);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });

    return () => {
      active = false;
    };
  }, []);

  useFocusEffect(load);

  const setFavorite = useCallback(async (memory: Memory, isFavorite: boolean) => {
    const updated = await memoryRepository.setFavorite(memory.id, isFavorite);
    if (updated === null) return null;
    setMemories((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    return updated;
  }, []);

  return { memories, status, reload: load, setFavorite };
}
