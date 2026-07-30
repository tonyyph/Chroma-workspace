import { round, space, ui } from '@chromawave/design-tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { usePalettes } from '@/hooks/usePalettes';
import { usePreferences } from '@/providers/PreferencesProvider';
import { Card, CardGroup, Gutter, Meta, Screen, Text, Toggle } from '@/ui';

/** D2 · PROFILE — identity block, stat tiles, then two grouped settings cards. */
export function YouScreen() {
  const { palettes } = usePalettes();
  const { preferences, setHapticsEnabled, setNotificationsEnabled, busyAction, t } =
    usePreferences();
  const pinned = palettes.filter((palette) => palette.isPinned).length;

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
          <Row label={t('you.colourSpace')} value="sRGB" />
          <Row label={t('you.defaultExport')} value="CSS VARS" />
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
}: {
  label: string;
  value?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {trailing ?? (
        <Text tone="secondary" variant="mono">
          {`${value} ›`}
        </Text>
      )}
    </View>
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
