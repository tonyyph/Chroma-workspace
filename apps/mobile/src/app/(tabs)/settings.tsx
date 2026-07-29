import type { BrandIdentityId, Language, ReminderTime, ThemeId } from '@chromawave/domain';
import {
  brandIdentities,
  brandIdentityIds,
  radius,
  shadow,
  spacing,
  themePalettes,
  touchTarget,
} from '@chromawave/design-tokens';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ICON_CORNER_RATIO, identityIcons } from '@/brand/identityAssets';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EditorialSection } from '@/components/EditorialSection';
import { PageHeader } from '@/components/PageHeader';
import { Screen } from '@/components/Screen';
import { usePreferences } from '@/providers/PreferencesProvider';

const themes: ThemeId[] = ['obsidian', 'ivory', 'oxblood', 'cobalt', 'moss', 'aubergine'];
const reminderTimes: ReminderTime[] = ['18:00', '20:00', '21:30'];

function PreferenceSwitch({
  title,
  body,
  value,
  disabled,
  onValueChange,
}: {
  title: string;
  body: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = usePreferences();
  return (
    <View style={[styles.preferenceRow, { borderBottomColor: colors.border }]}>
      <View style={styles.preferenceCopy}>
        <AppText variant="label">{title}</AppText>
        <AppText tone="muted" variant="caption">
          {body}
        </AppText>
      </View>
      <Switch
        accessibilityLabel={title}
        disabled={disabled}
        ios_backgroundColor={colors.surfaceRaised}
        onValueChange={onValueChange}
        thumbColor={value ? colors.accentInk : colors.textMuted}
        trackColor={{ false: colors.surfaceRaised, true: colors.accent }}
        value={value}
      />
    </View>
  );
}

function Choice({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = usePreferences();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.surfaceRaised : colors.surface,
        },
        pressed && styles.pressed,
      ]}
    >
      <AppText tone={selected ? 'accent' : 'muted'} variant="label">
        {label}
      </AppText>
    </Pressable>
  );
}

function ThemeCard({
  theme,
  selected,
  disabled,
  onPress,
}: {
  theme: ThemeId;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, t } = usePreferences();
  const preview = themePalettes[theme];
  return (
    <Pressable
      accessibilityLabel={t(`settings.theme.${theme}`)}
      accessibilityRole="radio"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.themeCard,
        {
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: colors.surface,
        },
        selected && { backgroundColor: colors.surfaceRaised },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.swatches} accessibilityElementsHidden>
        {[preview.canvas, preview.brandCoral, preview.brandViolet, preview.brandChartreuse].map(
          (backgroundColor) => (
            <View key={backgroundColor} style={[styles.swatch, { backgroundColor }]} />
          ),
        )}
      </View>
      <AppText variant="label">{t(`settings.theme.${theme}`)}</AppText>
      <AppText tone={selected ? 'accent' : 'subtle'} variant="caption">
        {selected ? t('settings.theme.selected').toLocaleUpperCase() : 'CHROMAWAVE ATELIER'}
      </AppText>
    </Pressable>
  );
}

function IdentityCard({
  id,
  selected,
  disabled,
  onPress,
}: {
  id: BrandIdentityId;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, t } = usePreferences();
  const identity = brandIdentities[id];
  return (
    <Pressable
      accessibilityLabel={t(`settings.identity.${id}`)}
      accessibilityRole="radio"
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.identityCard,
        {
          borderColor: selected ? colors.accent : colors.border,
          backgroundColor: selected ? colors.surfaceRaised : colors.surface,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.identityHeader}>
        <Image
          contentFit="cover"
          source={identityIcons[id]}
          style={styles.identityPreview}
          transition={160}
        />
        <View style={styles.identityCopy}>
          <AppText tone="subtle" variant="caption">
            {t('settings.identity.concept', { number: identity.conceptNumber })}
          </AppText>
          <AppText variant="label">{t(`settings.identity.${id}`)}</AppText>
          <AppText tone={selected ? 'accent' : 'subtle'} variant="caption">
            {selected ? t('settings.theme.selected').toLocaleUpperCase() : identity.designation}
          </AppText>
        </View>
      </View>
      <AppText tone="muted" variant="caption">
        {t(`settings.identity.${id}Body`)}
      </AppText>
      <View style={styles.identityBands} accessibilityElementsHidden>
        {identity.bands.map((backgroundColor) => (
          <View key={backgroundColor} style={[styles.identityBand, { backgroundColor }]} />
        ))}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const {
    preferences,
    colors,
    appIconSupported,
    busyAction,
    error,
    notificationPermission,
    t,
    setHapticsEnabled,
    setLanguage,
    setTheme,
    setBrandIdentity,
    setNotificationsEnabled,
    setReminderTime,
    refreshNotificationPermission,
  } = usePreferences();
  const disabled = busyAction !== null;
  const notificationsActive =
    preferences.notificationsEnabled && notificationPermission === 'granted';

  useFocusEffect(
    useCallback(() => {
      void refreshNotificationPermission();
    }, [refreshNotificationPermission]),
  );

  return (
    <Screen>
      <PageHeader
        body={t('settings.body')}
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
      />

      <View
        style={[
          styles.atmosphere,
          shadow.hero,
          { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
        ]}
      >
        <View style={styles.atmosphereCopy}>
          <AppText tone="accent" variant="caption">
            {t('settings.currentAtmosphere')}
          </AppText>
          <AppText italic variant="title">
            {t(`settings.theme.${preferences.theme}`)}
          </AppText>
          <AppText tone="muted" variant="caption">
            {t('settings.currentAtmosphereBody')}
          </AppText>
        </View>
        <View style={styles.atmosphereSpectrum}>
          {[colors.brandCoral, colors.brandViolet, colors.brandChartreuse, colors.accent].map(
            (backgroundColor, index) => (
              <View
                key={backgroundColor}
                style={[
                  styles.atmosphereBand,
                  { backgroundColor, height: index % 2 === 0 ? 94 : 72 },
                ]}
              />
            ),
          )}
        </View>
      </View>

      <View style={styles.section}>
        <EditorialSection index="01" title={t('settings.experience')} />
        <PreferenceSwitch
          body={t('settings.hapticsBody')}
          disabled={disabled}
          onValueChange={(value) => void setHapticsEnabled(value)}
          title={t('settings.haptics')}
          value={preferences.hapticsEnabled}
        />
        <PreferenceSwitch
          body={t('settings.notificationsBody')}
          disabled={disabled}
          onValueChange={(value) => void setNotificationsEnabled(value)}
          title={t('settings.notifications')}
          value={notificationsActive}
        />
        {notificationPermission === 'denied' ? (
          <View style={[styles.notice, { borderColor: colors.warning }]}>
            <AppText tone="muted">{t('settings.permissionDenied')}</AppText>
            <Button
              label={t('common.openSettings')}
              onPress={() => void Linking.openSettings()}
              variant="ghost"
            />
          </View>
        ) : null}
        {notificationsActive ? (
          <View style={styles.subgroup}>
            <AppText tone="subtle" variant="caption">
              {t('settings.reminderTime').toLocaleUpperCase()}
            </AppText>
            <View accessibilityRole="radiogroup" style={styles.choices}>
              {reminderTimes.map((time) => (
                <Choice
                  disabled={disabled}
                  key={time}
                  label={time}
                  onPress={() => void setReminderTime(time)}
                  selected={preferences.reminderTime === time}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <EditorialSection index="02" title={t('settings.languageSection')} />
        <AppText tone="subtle" variant="caption">
          {t('settings.language').toLocaleUpperCase()}
        </AppText>
        <View accessibilityRole="radiogroup" style={styles.choices}>
          {(['en', 'vi'] as Language[]).map((language) => (
            <Choice
              disabled={disabled}
              key={language}
              label={language === 'en' ? t('settings.english') : t('settings.vietnamese')}
              onPress={() => void setLanguage(language)}
              selected={preferences.language === language}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <EditorialSection index="03" title={t('settings.appearance')} />
        <AppText tone="muted">{t('settings.appearanceBody')}</AppText>
        <ScrollView
          contentContainerStyle={styles.themeGrid}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <View accessibilityRole="radiogroup" style={styles.themeRow}>
            {themes.map((theme) => (
              <ThemeCard
                disabled={disabled}
                key={theme}
                onPress={() => void setTheme(theme)}
                selected={preferences.theme === theme}
                theme={theme}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.section}>
        <EditorialSection index="04" title={t('settings.identity')} />
        <AppText tone="muted">{t('settings.identityBody')}</AppText>
        <View accessibilityRole="radiogroup" style={styles.identityGroup}>
          {brandIdentityIds.map((id) => (
            <IdentityCard
              disabled={disabled}
              id={id}
              key={id}
              onPress={() => void setBrandIdentity(id)}
              selected={preferences.brandIdentity === id}
            />
          ))}
        </View>
        {appIconSupported ? null : (
          <AppText tone="subtle" variant="caption">
            {t('settings.identity.iconUnsupported')}
          </AppText>
        )}
      </View>

      <View style={styles.section}>
        <EditorialSection index="05" title={t('settings.privacy')} />
        <View style={[styles.privacyCard, { backgroundColor: colors.surfaceSubtle }]}>
          <AppText tone="muted">{t('settings.privacyBody')}</AppText>
          <AppText tone="accent" variant="caption">
            {t('settings.localOnly')}
          </AppText>
        </View>
      </View>

      {error ? (
        <View
          style={[
            styles.notice,
            { borderColor: error === 'appIcon' ? colors.warning : colors.danger },
          ]}
        >
          <AppText tone="muted">
            {error === 'notification'
              ? t('settings.notificationError')
              : error === 'appIcon'
                ? t('settings.appIconError')
                : t('settings.error')}
          </AppText>
        </View>
      ) : null}
      {busyAction ? (
        <AppText accessibilityLiveRegion="polite" tone="subtle" variant="caption">
          {t('settings.saving').toLocaleUpperCase()}…
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  atmosphere: {
    minHeight: 270,
    padding: spacing.lg,
    marginBottom: spacing.xxxl,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
    overflow: 'hidden',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  atmosphereCopy: {
    maxWidth: 420,
    gap: spacing.sm,
  },
  atmosphereSpectrum: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  atmosphereBand: {
    flex: 1,
    borderRadius: radius.pill,
  },
  section: {
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  preferenceRow: {
    minHeight: 78,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  preferenceCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  subgroup: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choice: {
    minWidth: 92,
    minHeight: touchTarget.comfortable,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeGrid: {
    paddingRight: spacing.lg,
  },
  themeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  themeCard: {
    width: 210,
    minHeight: 132,
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  swatches: {
    height: 38,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: radius.pill,
  },
  identityGroup: {
    gap: spacing.md,
  },
  identityCard: {
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
    gap: spacing.sm,
  },
  identityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  identityPreview: {
    width: 64,
    height: 64,
    borderRadius: 64 * ICON_CORNER_RATIO,
  },
  identityCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  identityBands: {
    height: 10,
    flexDirection: 'row',
    gap: spacing.xxs,
  },
  identityBand: {
    flex: 1,
    borderRadius: radius.pill,
  },
  swatch: {
    flex: 1,
  },
  notice: {
    padding: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  privacyCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.lg,
  },
  pressed: {
    opacity: 0.78,
  },
});
