import { round, space, ui } from '@chromawave/design-tokens';
import { exportTargetSchema, type ExportTarget } from '@chromawave/domain';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { usePalettes } from '@/hooks/usePalettes';
import { unreadActivityCount } from '@/features/tools/activity';
import { usePreferences } from '@/providers/PreferencesProvider';
import { Card, CardGroup, Gutter, Meta, Screen, Text, Toggle } from '@/ui';

const EXPORT_TARGETS = exportTargetSchema.options;

/** D2 · PROFILE — identity block, stat tiles, then two grouped settings cards. */
export function YouScreen() {
  const { palettes } = usePalettes();
  const router = useRouter();
  const {
    preferences,
    setHapticsEnabled,
    setNotificationsEnabled,
    setColorSpace,
    setDefaultExport,
    setSoundEnabled,
    busyAction,
    t,
  } = usePreferences();
  const pinned = palettes.filter((palette) => palette.isPinned).length;
  const unread = useMemo(
    () => unreadActivityCount(palettes, preferences.activityReadAt),
    [palettes, preferences.activityReadAt],
  );

  /**
   * Both settings rows cycle rather than opening a picker: each has a handful of
   * values and no natural ordering problem, so a tap that advances one step is
   * fewer taps than a sheet for the same result.
   */
  const cycleExport = () => {
    const index = EXPORT_TARGETS.indexOf(preferences.defaultExport);
    const next = EXPORT_TARGETS[(index + 1) % EXPORT_TARGETS.length] as ExportTarget;
    void setDefaultExport(next);
  };

  return (
    <Screen tabBarInset>
      <Gutter style={styles.identity}>
        <LinearGradient
          colors={['#7C5CFF', '#22D3EE']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.avatar}
        />
        <View style={styles.identityCopy}>
          <Text variant="section">{t('you.title')}</Text>
          <Meta style={styles.identityMeta}>{t('you.meta')}</Meta>
        </View>
      </Gutter>

      <Gutter style={styles.stats}>
        <Stat label={t('you.stat.palettes')} value={String(palettes.length)} />
        <Stat label={t('you.stat.pinned')} value={String(pinned)} />
        <Stat
          label={t('you.stat.colours')}
          value={String(palettes.reduce((sum, p) => sum + p.colors.length, 0))}
        />
      </Gutter>

      <Gutter style={styles.group}>
        <CardGroup>
          <Row
            label={t('you.colourSpace')}
            onPress={() => void setColorSpace(preferences.colorSpace === 'srgb' ? 'p3' : 'srgb')}
            value={preferences.colorSpace === 'p3' ? 'DISPLAY P3' : 'sRGB'}
          />
          <Row
            label={t('you.defaultExport')}
            onPress={cycleExport}
            value={preferences.defaultExport.toLocaleUpperCase()}
          />
          <Row
            label={t('you.haptics')}
            trailing={
              <Toggle
                disabled={busyAction !== null}
                label={t('you.haptics')}
                onValueChange={(value) => void setHapticsEnabled(value)}
                value={preferences.hapticsEnabled}
              />
            }
          />
          <Row
            label={t('you.sound')}
            trailing={
              <Toggle
                disabled={busyAction !== null}
                label={t('you.sound')}
                onValueChange={(value) => void setSoundEnabled(value)}
                value={preferences.soundEnabled}
              />
            }
          />
          <Row
            label={t('you.reminder')}
            trailing={
              <Toggle
                disabled={busyAction !== null}
                label={t('you.reminder')}
                onValueChange={(value) => void setNotificationsEnabled(value)}
                value={preferences.notificationsEnabled}
              />
            }
          />
        </CardGroup>
      </Gutter>

      <Gutter style={styles.group}>
        <CardGroup>
          <Row
            label={t('activity.title')}
            onPress={() => router.push('/tools/activity')}
            value={unread > 0 ? t('you.unread', { count: unread }) : t('you.open')}
          />
          <Row
            label={t('paywall.title').replace('\n', ' ')}
            onPress={() => router.push('/paywall?trigger=palette-limit')}
            value={t('common.pro')}
          />
          <Row
            label={t('onboarding.how.title').replace('\n', ' ')}
            onPress={() => router.push('/onboarding')}
            value={t('you.open')}
          />
        </CardGroup>
      </Gutter>

      <Gutter style={styles.footer}>
        <Meta tone="tertiary">{t('you.version', { version: '1.0.0' })}</Meta>
      </Gutter>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.stat}>
      <Text variant="section">{value}</Text>
      <Meta style={styles.statLabel}>{label}</Meta>
    </Card>
  );
}

function Row({
  label,
  value,
  trailing,
  onPress,
}: {
  label: string;
  value?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {trailing ?? (
        <Text tone="secondary" variant="mono">
          {`${value} ›`}
        </Text>
      )}
    </View>
  );

  // A row that navigates has to be a button, or the chevron is a lie.
  if (!onPress) return body;
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: {
    paddingTop: space.cardGap,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cardGap,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: round.media,
  },
  identityCopy: {
    gap: 4,
  },
  identityMeta: {
    color: ui.text.tertiary,
  },
  stats: {
    paddingTop: space.gutter,
    flexDirection: 'row',
    gap: 10,
  },
  stat: {
    flex: 1,
    gap: 6,
  },
  statLabel: {
    fontSize: 9,
    letterSpacing: 1,
  },
  group: {
    paddingTop: space.gutter,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    minHeight: 24,
  },
  rowLabel: {
    fontSize: 14,
  },
  footer: {
    paddingTop: space.md,
  },
});
