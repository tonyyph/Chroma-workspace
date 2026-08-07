import { type PaletteSet } from '@chromawave/domain';
import * as Crypto from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { NewSetScreen } from '@/features/sets/NewSetScreen';
import { usePalettes, useSets } from '@/hooks';
import { analytics } from '@/infrastructure/dependencies';

/**
 * The set draft. `/set/new` is a static segment, so it wins over `/set/[id]`
 * and no record with that id is ever read.
 */
export default function NewSetRoute() {
  const router = useRouter();
  const { palettes } = usePalettes();
  const { save } = useSets();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  // A new set starts with whatever is pinned; an empty set has nothing to show.
  const seedPalettes = palettes.filter((palette) => palette.isPinned);

  const create = async (name: string) => {
    setSaving(true);
    setFailed(false);
    const now = new Date().toISOString();
    const set: PaletteSet = {
      schemaVersion: 1,
      id: Crypto.randomUUID(),
      name,
      createdAt: now,
      updatedAt: now,
      paletteIds: seedPalettes.map((palette) => palette.id),
      members: ['you'],
      merged: null,
    };
    try {
      await save(set);
    } catch {
      // Nothing was persisted, so navigating into the set would 404.
      setSaving(false);
      setFailed(true);
      return;
    }
    analytics.track('collection_created', { collectionId: set.id });
    // Replace, so Back from the set lands on the list rather than the draft.
    router.replace(`/set/${set.id}`);
  };

  return (
    <NewSetScreen
      failed={failed}
      onCancel={router.back}
      onSave={(name) => void create(name)}
      saving={saving}
      seedPalettes={seedPalettes}
    />
  );
}
