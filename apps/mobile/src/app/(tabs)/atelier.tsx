import { deriveMonthlyRecaps, derivePaletteSignature } from '@chromawave/domain';
import { radius, shadow, spacing } from '@chromawave/design-tokens';
import { useEffect, useMemo, useState } from 'react';
import { Share, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EditorialSection } from '@/components/EditorialSection';
import { PageHeader } from '@/components/PageHeader';
import { Screen } from '@/components/Screen';
import { StateView } from '@/components/StateView';
import { useCollections } from '@/hooks/useCollections';
import { useMemoryLibrary } from '@/hooks/useMemoryLibrary';
import { analytics } from '@/infrastructure/dependencies';
import { usePreferences } from '@/providers/PreferencesProvider';

export default function AtelierScreen() {
  const { memories, status: memoryStatus, reload } = useMemoryLibrary();
  const {
    collections,
    status: collectionStatus,
    create,
    toggleMemory,
    reload: reloadCollections,
  } = useCollections();
  const { colors, feedback, preferences, t } = usePreferences();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const recaps = useMemo(() => deriveMonthlyRecaps(memories), [memories]);
  const signature = useMemo(() => derivePaletteSignature(memories), [memories]);
  const recap = recaps[0] ?? null;
  const latest = memories[0] ?? null;

  useEffect(() => {
    if (memoryStatus !== 'ready') return;
    analytics.track('atelier_opened', { memoryCount: memories.length });
    analytics.track('palette_lab_viewed', { memoryCount: memories.length });
    if (recap) analytics.track('recap_viewed', { monthKey: recap.key });
  }, [memories.length, memoryStatus, recap]);

  const createCollection = async () => {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      await create(name);
      setName('');
      await feedback.success();
    } finally {
      setCreating(false);
    }
  };

  const shareLatest = async () => {
    if (!latest) return;
    const colorsText = latest.palette.colors.map((color) => color.hex).join(' · ');
    await Share.share({
      message: t('atelier.shareMessage', {
        mood: latest.palette.mood,
        colors: colorsText,
        track: latest.musicPairing?.track.title ?? '—',
      }),
      title: t('atelier.shareTitle'),
    });
    analytics.track('memory_shared', { memoryId: latest.id, format: 'text-board' });
  };

  if (memoryStatus === 'loading' || collectionStatus === 'loading') {
    return (
      <Screen scroll={false}>
        <StateView body={t('atelier.loadingBody')} busy title={t('atelier.loading')} />
      </Screen>
    );
  }

  if (memoryStatus === 'error' || collectionStatus === 'error') {
    return (
      <Screen scroll={false}>
        <StateView
          actionLabel={t('common.tryAgain')}
          body={t('atelier.errorBody')}
          onAction={() => {
            reload();
            reloadCollections();
          }}
          title={t('atelier.error')}
        />
      </Screen>
    );
  }

  const monthLabel = recap
    ? new Intl.DateTimeFormat(preferences.language === 'vi' ? 'vi-VN' : 'en-US', {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(Date.UTC(recap.year, recap.month - 1, 1)))
    : '';

  return (
    <Screen>
      <PageHeader
        body={t('atelier.body')}
        eyebrow={t('atelier.eyebrow')}
        title={t('atelier.title')}
      />

      <View
        accessible
        accessibilityLabel={t('atelier.signatureLabel')}
        style={[
          styles.signature,
          shadow.hero,
          { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        ]}
      >
        <View style={styles.signatureTopline}>
          <AppText tone="accent" variant="caption">
            {t('atelier.livingIndex')}
          </AppText>
          <AppText tone="subtle" variant="caption">
            {String(memories.length).padStart(2, '0')} / CHROMAWAVE
          </AppText>
        </View>
        <View style={styles.spectrum}>
          {(signature?.signatureColors.length
            ? signature.signatureColors
            : [colors.brandCoral, colors.brandViolet, colors.brandChartreuse, colors.accent]
          ).map((backgroundColor, index) => (
            <View
              key={`${backgroundColor}-${index}`}
              style={[
                styles.spectrumBand,
                { backgroundColor, transform: [{ translateY: index % 2 === 0 ? -8 : 8 }] },
              ]}
            />
          ))}
        </View>
        <AppText italic variant="title">
          {signature ? t(`atelier.harmony.${signature.harmony}`) : t('atelier.emptySignature')}
        </AppText>
        <AppText tone="muted">
          {signature
            ? t('atelier.signatureBody', {
                brightness: signature.averageBrightness,
                warmth: t(`atelier.warmth.${signature.warmth}`),
              })
            : t('atelier.emptySignatureBody')}
        </AppText>
      </View>

      <View style={styles.section}>
        <EditorialSection index="01" title={t('atelier.recap')} />
        {recap ? (
          <View style={styles.recap}>
            <View style={styles.recapCopy}>
              <AppText tone="accent" variant="caption">
                {monthLabel.toLocaleUpperCase()}
              </AppText>
              <AppText italic variant="heading">
                {t('atelier.recapHeadline', { mood: recap.dominantMood ?? '—' })}
              </AppText>
              <AppText tone="muted">
                {t('atelier.recapBody', {
                  total: recap.total,
                  favorites: recap.favoriteCount,
                })}
              </AppText>
            </View>
            <View style={styles.recapColors}>
              {recap.signatureColors.map((backgroundColor) => (
                <View key={backgroundColor} style={[styles.recapColor, { backgroundColor }]} />
              ))}
            </View>
          </View>
        ) : (
          <AppText tone="muted">{t('atelier.recapEmpty')}</AppText>
        )}
      </View>

      <View style={styles.section}>
        <EditorialSection index="02" title={t('atelier.collections')} />
        <AppText tone="muted">{t('atelier.collectionsBody')}</AppText>
        <View style={[styles.creator, { borderBottomColor: colors.border }]}>
          <TextInput
            accessibilityLabel={t('atelier.collectionName')}
            maxLength={60}
            onChangeText={setName}
            placeholder={t('atelier.collectionPlaceholder')}
            placeholderTextColor={colors.textSubtle}
            returnKeyType="done"
            style={[styles.input, { color: colors.text }]}
            value={name}
          />
          <Button
            disabled={!name.trim()}
            label={t('atelier.create')}
            loading={creating}
            onPress={() => void createCollection()}
            variant="secondary"
          />
        </View>
        {collections.length === 0 ? (
          <AppText tone="subtle" variant="caption">
            {t('atelier.collectionsEmpty')}
          </AppText>
        ) : (
          <View>
            {collections.map((collection) => {
              const included = latest ? collection.memoryIds.includes(latest.id) : false;
              return (
                <View
                  key={collection.id}
                  style={[styles.collectionRow, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.collectionCopy}>
                    <AppText variant="heading">{collection.name}</AppText>
                    <AppText tone="subtle" variant="caption">
                      {t('atelier.memoryCount', { count: collection.memoryIds.length })}
                    </AppText>
                  </View>
                  {latest ? (
                    <Button
                      label={included ? t('atelier.removeLatest') : t('atelier.addLatest')}
                      onPress={() => void toggleMemory(collection, latest.id)}
                      variant={included ? 'ghost' : 'secondary'}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <EditorialSection index="03" title={t('atelier.shareTitle')} />
        <View
          style={[
            styles.share,
            shadow.raised,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.shareCopy}>
            <AppText italic variant="heading">
              {t('atelier.shareHeadline')}
            </AppText>
            <AppText tone="muted">{t('atelier.shareBody')}</AppText>
          </View>
          <Button
            disabled={!latest}
            label={t('atelier.shareAction')}
            onPress={() => void shareLatest()}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  signature: {
    minHeight: 360,
    padding: spacing.lg,
    marginBottom: spacing.xxxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    justifyContent: 'flex-end',
    gap: spacing.md,
    overflow: 'hidden',
  },
  signatureTopline: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    left: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  spectrum: {
    height: 138,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
  },
  spectrumBand: {
    flex: 1,
    height: 112,
    borderRadius: radius.pill,
  },
  section: {
    gap: spacing.lg,
    marginBottom: spacing.xxxl,
  },
  recap: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'stretch',
  },
  recapCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  recapColors: {
    width: 74,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  recapColor: {
    flex: 1,
    minHeight: 26,
  },
  creator: {
    paddingBottom: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  input: {
    minHeight: 52,
    fontFamily: 'PlayfairDisplay_500Medium',
    fontSize: 24,
    lineHeight: 30,
  },
  collectionRow: {
    minHeight: 96,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  collectionCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  share: {
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    gap: spacing.xl,
  },
  shareCopy: {
    gap: spacing.sm,
  },
});
