import type { Collection } from '@chromawave/domain';
import * as Crypto from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { analytics, collectionRepository } from '@/infrastructure/dependencies';

export function useCollections() {
  const [collections, setCollections] = useState<readonly Collection[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = useCallback(() => {
    let active = true;
    setStatus('loading');
    collectionRepository
      .list()
      .then((items) => {
        if (!active) return;
        setCollections(items);
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

  const create = useCallback(async (name: string) => {
    const now = new Date().toISOString();
    const collection: Collection = {
      schemaVersion: 1,
      id: Crypto.randomUUID(),
      name: name.trim(),
      createdAt: now,
      updatedAt: now,
      memoryIds: [],
    };
    await collectionRepository.save(collection);
    setCollections((current) => [collection, ...current]);
    analytics.track('collection_created', { collectionId: collection.id });
    return collection;
  }, []);

  const toggleMemory = useCallback(async (collection: Collection, memoryId: string) => {
    const included = collection.memoryIds.includes(memoryId);
    const updated: Collection = {
      ...collection,
      updatedAt: new Date().toISOString(),
      memoryIds: included
        ? collection.memoryIds.filter((id) => id !== memoryId)
        : [...collection.memoryIds, memoryId],
    };
    await collectionRepository.save(updated);
    setCollections((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    analytics.track('collection_memory_changed', {
      collectionId: collection.id,
      included: !included,
    });
  }, []);

  return { collections, status, reload: load, create, toggleMemory };
}
