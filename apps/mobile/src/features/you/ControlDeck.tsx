import { exportTargetSchema, type ExportTarget } from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import { useRouter } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useEntitlements, usePreferences, useSkin } from '@/providers';
import {
  CardGroup,
  Gutter,
  Icon,
  Meta,
  Pressable,
  SectionHead,
  Text,
  Toggle,
  useStyles,
} from '@/ui';

const EXPORT_TARGETS = exportTargetSchema.options;

/** The row and its switch share a label, so the switch reads as the row. */
const DEV_PRO_LABEL = 'Pro unlocked (dev)';

/**
 * The controls, and the places to go from here.
 *
 * Last on the screen on purpose: the folds above are what is *theirs*, and a
 * settings list first would make this a form again. Behaviour is unchanged from
 * when these rows lived in the screen itself.
 */
export function ControlDeck({ unread }: { unread: number }) {
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const {
    preferences,
    setHapticsEnabled,
    setLanguage,
    setNotificationsEnabled,
    setColorSpace,
    setSkin,
    setDefaultExport,
    setSoundEnabled,
    setAmbientBackdrop,
    busyAction,
    t,
  } = usePreferences();
  const { tier, devSetTier } = useEntitlements();

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
    <>
      <Gutter style={styles.sectionHead}>
        <SectionHead meta={t('you.controls.meta')} title={t('you.controls.title')} />
      </Gutter>
      <Gutter style={styles.group}>
        <CardGroup>
          {/* The one preference that changes everything on every screen, so it
              leads the group rather than sitting under the export defaults. */}
          <Row
            label={t('you.appearance')}
            onPress={() => void setSkin(preferences.skin === 'chroma' ? 'swiss' : 'chroma')}
            value={t(`you.appearance.${preferences.skin}`)}
          />
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
            label={t('you.language')}
            trailing={
              <View style={styles.languageSwitch}>
                <Text tone={preferences.language === 'en' ? 'primary' : 'tertiary'} variant="mono">
                  EN
                </Text>
                <Toggle
                  disabled={busyAction !== null}
                  label={t('you.languageSwitch')}
                  onValueChange={(vietnamese) => void setLanguage(vietnamese ? 'vi' : 'en')}
                  value={preferences.language === 'vi'}
                />
                <Text tone={preferences.language === 'vi' ? 'primary' : 'tertiary'} variant="mono">
                  VI
                </Text>
              </View>
            }
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
            label={t('you.backdrop')}
            trailing={
              <Toggle
                disabled={busyAction !== null}
                label={t('you.backdrop')}
                onValueChange={(value) => void setAmbientBackdrop(value)}
                value={preferences.ambientBackdrop}
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

      <Gutter style={styles.sectionHead}>
        <SectionHead title={t('you.more.title')} />
      </Gutter>
      <Gutter style={styles.group}>
        <CardGroup>
          {/* Rewind leads the group: it is the only row here that is about
              what the library has become rather than about the app. */}
          <Row
            icon="palette"
            label={t('rewind.title')}
            onPress={() => router.push('/tools/rewind')}
            value={t('you.open')}
          />
          {/* The way into Story Studio.
              One entry point, deliberately. The brief names four — memory
              detail, collection, studio, remix — but three of those hand the
              editor a starting selection it cannot use yet, and a row that
              opens an empty project from a memory the user just chose would
              look like it lost their choice. The others arrive with the phases
              that give them something to carry. */}
          <Row
            icon="photos"
            label={t('story.title')}
            onPress={() => router.push('/story/new')}
            value={t('you.open')}
          />
          <Row
            icon="activity"
            label={t('activity.title')}
            onPress={() => router.push('/tools/activity')}
            value={unread > 0 ? t('you.unread', { count: unread }) : t('you.open')}
          />
          <Row
            icon="palette"
            label={t('paywall.title').replace('\n', ' ')}
            onPress={() => router.push('/paywall?trigger=pro-tools')}
            value={t('common.pro')}
          />
          <Row
            icon="settings"
            label={t('onboarding.how.title').replace('\n', ' ')}
            onPress={() => router.push('/onboarding')}
            value={t('you.open')}
          />
        </CardGroup>
      </Gutter>

      {/* Untranslated on purpose: this is a workbench control, and dev-only
          copy in the locale tables is copy someone has to translate and keep in
          step for a row no user will ever see. Its absence in a shipped build is
          `devSetTier` being null there, not this condition. */}
      {devSetTier ? (
        <>
          <Gutter style={styles.sectionHead}>
            <SectionHead meta="Not in release builds" title="Developer" />
          </Gutter>
          <Gutter style={styles.group}>
            <CardGroup>
              <Row
                label={DEV_PRO_LABEL}
                trailing={
                  <Toggle
                    label={DEV_PRO_LABEL}
                    onValueChange={(value) => void devSetTier(value ? 'pro' : 'free')}
                    value={tier === 'pro'}
                  />
                }
              />
            </CardGroup>
          </Gutter>
        </>
      ) : null}

      <Gutter style={styles.footer}>
        <Meta tone="tertiary">{t('you.version', { version: '1.0.0' })}</Meta>
      </Gutter>
    </>
  );
}

function Row({
  label,
  value,
  trailing,
  onPress,
  icon,
}: {
  label: string;
  value?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  icon?: ComponentProps<typeof Icon>['name'];
}) {
  const skin = useSkin();
  const styles = useStyles(makeStyles);
  const body = (
    <View style={styles.row}>
      {icon ? <Icon color={skin.ui.text.tertiary} name={icon} scale="control" /> : null}
      <Text style={styles.rowLabel}>{label}</Text>
      {trailing ?? (
        <View style={styles.rowValue}>
          <Text tone="secondary" variant="mono">
            {value}
          </Text>
          {/* The chevron belongs to rows that go somewhere, so it is drawn from
              the handler rather than concatenated into every value string. */}
          {onPress ? <Icon color={skin.ui.text.tertiary} name="forward" scale="inline" /> : null}
        </View>
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

const makeStyles = (_skin: Skin) =>
  StyleSheet.create({
    sectionHead: {
      paddingTop: space.sectionGap,
    },
    group: {
      paddingTop: space.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: space.sm,
      minHeight: 24,
    },
    rowLabel: {
      flex: 1,
      fontSize: 14,
    },
    rowValue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    languageSwitch: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
    },
    footer: {
      paddingTop: space.gutter,
    },
  });
