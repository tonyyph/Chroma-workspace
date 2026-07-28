import { canSaveMemory, memorySchema } from '@chromawave/domain';
import { radius, spacing } from '@chromawave/design-tokens';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PageHeader } from '@/components/PageHeader';
import { PaletteStrip } from '@/components/PaletteStrip';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { analytics, assetStore, memoryRepository } from '@/infrastructure/dependencies';
import { useCaptureStore } from '@/store/captureStore';
import { usePreferences } from '@/providers/PreferencesProvider';

export default function ComposeScreen() {
  const photo = useCaptureStore((state) => state.photo);
  const palette = useCaptureStore((state) => state.palette);
  const selected = useCaptureStore((state) => state.selectedRecommendation);
  const note = useCaptureStore((state) => state.note);
  const setNote = useCaptureStore((state) => state.setNote);
  const reset = useCaptureStore((state) => state.reset);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error' | 'limit'>('idle');
  const { colors, feedback, t } = usePreferences();

  if (!photo || !palette || !selected) {
    return (
      <Screen>
        <StateView
          actionLabel={t('compose.restart')}
          body={t('compose.incompleteBody')}
          onAction={() => router.replace('/(tabs)/capture')}
          title={t('compose.incomplete')}
        />
      </Screen>
    );
  }

  const save = async () => {
    setStatus('saving');
    try {
      const current = await memoryRepository.list();
      if (!canSaveMemory('free', current.length)) {
        setStatus('limit');
        return;
      }

      const memoryId = Crypto.randomUUID();
      const assetUri = await assetStore.persist({
        sourceUri: photo.uri,
        memoryId,
        extension: photo.extension,
      });
      const now = new Date().toISOString();
      const memory = memorySchema.parse({
        schemaVersion: 1,
        id: memoryId,
        createdAt: now,
        capturedAt: now,
        visibility: 'private',
        note: note.trim() || null,
        isFavorite: false,
        asset: {
          id: Crypto.randomUUID(),
          kind: 'original',
          localUri: assetUri,
          mediaType: photo.mediaType,
          width: photo.width,
          height: photo.height,
        },
        palette,
        musicPairing: {
          track: selected.track,
          explanation: selected.explanation,
          pairedAt: now,
        },
        syncStatus: 'local',
      });

      await memoryRepository.save(memory);
      analytics.track('memory_saved', {
        memoryId,
        mood: palette.mood,
        hasNote: memory.note !== null,
      });
      await feedback.success();
      reset();
      router.replace({ pathname: '/memory/[id]', params: { id: memoryId, saved: '1' } });
    } catch {
      setStatus('error');
    }
  };

  if (status === 'limit') {
    return (
      <Screen>
        <StateView
          actionLabel={t('compose.limitAction')}
          body={t('compose.limitBody')}
          onAction={() => router.replace('/(tabs)')}
          title={t('compose.limit')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <Button
          accessibilityHint={t('compose.saveHint')}
          label={t('compose.save')}
          loading={status === 'saving'}
          onPress={() => void save()}
        />
      }
    >
      <PageHeader
        body={t('compose.body')}
        eyebrow={t('compose.eyebrow')}
        title={t('compose.title')}
      />
      <View style={[styles.preview, { backgroundColor: colors.surface }]}>
        <Image
          accessibilityLabel={t('compose.imageLabel')}
          contentFit="cover"
          source={{ uri: photo.uri }}
          style={[styles.image, { backgroundColor: colors.surfaceRaised }]}
        />
        <View style={styles.previewMeta}>
          <PaletteStrip animated={false} height={44} palette={palette} />
          <AppText variant="label">{selected.track.title}</AppText>
          <AppText tone="muted" variant="caption">
            {selected.track.artist} · mock pairing
          </AppText>
        </View>
      </View>

      <AppText style={styles.label} variant="label">
        {t('compose.privateNote')}
      </AppText>
      <TextInput
        accessibilityLabel={t('compose.noteLabel')}
        maxLength={500}
        multiline
        onChangeText={setNote}
        placeholder={t('compose.placeholder')}
        placeholderTextColor={colors.textSubtle}
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        value={note}
      />
      <AppText style={styles.count} tone="subtle" variant="caption">
        {note.length}/500
      </AppText>

      {status === 'error' ? (
        <View style={styles.error}>
          <AppText tone="danger" variant="caption">
            {t('compose.error')}
          </AppText>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  preview: {
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 1.6,
  },
  previewMeta: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  label: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 132,
    padding: spacing.md,
    borderRadius: radius.lg,
    fontSize: 16,
    lineHeight: 23,
    textAlignVertical: 'top',
    borderWidth: 1,
  },
  count: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  error: {
    marginTop: spacing.md,
  },
});
