import { elevation, glass, round, space, tint, ui } from '@chromawave/design-tokens';
import {
  exportTargetSchema,
  shortAge,
  type ColorMood,
  type ExportTarget,
  type Palette,
  type VisualStyle,
} from '@chromawave/domain';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { unreadActivityCount } from '@/features/tools/activity';
import { usePalettes } from '@/hooks/usePalettes';
import { useSets } from '@/hooks/useSets';
import { usePreferences } from '@/providers/PreferencesProvider';
import {
  BandCanvas,
  Card,
  CardGroup,
  Chip,
  Gutter,
  Icon,
  Meta,
  Pressable,
  Screen,
  SectionHead,
  SwatchStrip,
  Text,
  Toggle,
} from '@/ui';
import {
  byRecency,
  capturedThisMonth,
  moodTaste,
  signatureColors,
  styleTaste,
  totalColors,
} from './youInsights';

const EXPORT_TARGETS = exportTargetSchema.options;

/**
 * D2 · YOU — rebuilt as a portrait of a library rather than a settings list.
 *
 * **What changed and why.** The previous screen was an avatar, three equal stat
 * tiles and two stacked groups of preference rows. Everything on it was the same
 * size and the same shape, so it read as a form: nothing said what this person's
 * colour actually looks like, and the only thing you could do from it was change
 * a setting.
 *
 * The rebuild is organised by what is *theirs*, in descending order of how
 * personal it is:
 *
 *  1. a signature drawn from their own dominant bands, full-bleed, with the
 *     identity card floating over its lower edge;
 *  2. an asymmetric stat mosaic — one number is the headline, the others are not
 *     — where every tile is a way into the library rather than a read-out;
 *  3. what they keep coming back to, derived from the palettes themselves and
 *     tappable straight through to the library filtered by it;
 *  4. their recent captures;
 *  5. and only then the controls, which have not changed behaviour at all.
 *
 * Depth is doing the hierarchy: the hero is behind, the identity card is glass
 * over it, the mosaic sits on the ground, and the control deck is a single
 * grouped surface. Nothing is a card just because the thing above it was.
 */
export function YouScreen() {
  const { palettes } = usePalettes();
  const { sets } = useSets();
  const router = useRouter();
  const {
    preferences,
    setHapticsEnabled,
    setLanguage,
    setNotificationsEnabled,
    setColorSpace,
    setDefaultExport,
    setSoundEnabled,
    setAmbientBackdrop,
    busyAction,
    t,
  } = usePreferences();

  const pinned = useMemo(() => palettes.filter((palette) => palette.isPinned).length, [palettes]);
  const thisMonth = useMemo(() => capturedThisMonth(palettes), [palettes]);
  const unread = useMemo(
    () => unreadActivityCount(palettes, preferences.activityReadAt),
    [palettes, preferences.activityReadAt],
  );
  const recent = useMemo(() => byRecency(palettes).slice(0, 3), [palettes]);

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

  const openLibrary = (params?: { mood?: ColorMood; style?: VisualStyle }) => {
    router.push({ pathname: '/(tabs)', params: params ?? {} });
  };

  return (
    <Screen tabBarInset topInset={false}>
      <SignatureHero palettes={palettes} />

      <Gutter style={styles.mosaic}>
        <StatTile
          label={t('you.stat.palettes')}
          onPress={() => openLibrary()}
          size="hero"
          value={String(palettes.length)}
        />
        <View style={styles.mosaicColumn}>
          <StatTile
            label={t('you.stat.pinned')}
            onPress={() => openLibrary()}
            value={String(pinned)}
          />
          <StatTile label={t('you.stat.colours')} value={String(totalColors(palettes))} />
        </View>
      </Gutter>

      <Gutter style={styles.thinRow}>
        <MiniStat label={t('you.stat.thisMonth')} value={String(thisMonth)} />
        <MiniStat label={t('you.stat.collections')} value={String(sets.length)} />
      </Gutter>

      <TasteSection onPick={openLibrary} palettes={palettes} />

      <Gutter style={styles.sectionHead}>
        <SectionHead
          action={recent.length ? t('you.seeAll') : undefined}
          onAction={recent.length ? () => openLibrary() : undefined}
          title={t('you.recent.title')}
        />
      </Gutter>
      <Gutter style={styles.recent}>
        {recent.length ? (
          recent.map((palette) => (
            <Card
              accessibilityLabel={palette.name}
              key={palette.id}
              onPress={() => router.push(`/palette/${palette.id}`)}
              style={styles.recentRow}
            >
              <SwatchStrip
                colors={palette.colors}
                height={38}
                radius={round.swatch}
                style={styles.recentStrip}
              />
              <View style={styles.recentCopy}>
                <Text numberOfLines={1} variant="cardTitle">
                  {palette.name}
                </Text>
                <Meta style={styles.setMeta}>
                  {t('library.card.meta', {
                    count: palette.colors.length,
                    age: shortAge(palette.capturedAt),
                  })}
                </Meta>
              </View>
              <Icon color={ui.text.tertiary} name="forward" scale="inline" />
            </Card>
          ))
        ) : (
          <Text tone="secondary" variant="body">
            {t('you.recent.empty')}
          </Text>
        )}
      </Gutter>

      <Gutter style={styles.sectionHead}>
        <SectionHead meta={t('you.controls.meta')} title={t('you.controls.title')} />
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
          <Row
            icon="activity"
            label={t('activity.title')}
            onPress={() => router.push('/tools/activity')}
            value={unread > 0 ? t('you.unread', { count: unread }) : t('you.open')}
          />
          <Row
            icon="palette"
            label={t('paywall.title').replace('\n', ' ')}
            onPress={() => router.push('/paywall?trigger=palette-limit')}
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

      <Gutter style={styles.footer}>
        <Meta tone="tertiary">{t('you.version', { version: '1.0.0' })}</Meta>
      </Gutter>
    </Screen>
  );
}

/**
 * The hero: the user's own dominant bands, full-bleed, with the identity card
 * floating over the join.
 *
 * Full-bleed and overlapping is the whole point — a signature inset into the
 * gutter like everything else would be one more card. The card below overlaps it
 * by its own corner radius so the two read as one object with a lit edge rather
 * than as a picture with a caption.
 */
function SignatureHero({ palettes }: { palettes: readonly Palette[] }) {
  const { t } = usePreferences();
  const { width } = useWindowDimensions();
  const signature = useMemo(() => signatureColors(palettes), [palettes]);
  // An empty library still gets a hero — in the brand's own bands, and saying so.
  const colors = signature.length ? signature : BRAND_FALLBACK;

  return (
    <View style={styles.hero}>
      <View style={styles.heroArt}>
        <BandCanvas colors={colors} height={HERO_HEIGHT} width={width} />
        <LinearGradient
          colors={['rgba(8,7,14,.15)', 'rgba(8,7,14,.9)']}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.identity}>
        <View style={styles.identityGlass}>
          <BlurView intensity={glass.shell.intensity} style={StyleSheet.absoluteFill} tint="dark" />
          <View style={styles.identityRow}>
            <View accessibilityLabel={t('you.signature.label')} style={styles.avatar}>
              {colors.slice(0, 3).map((hex, index) => (
                <View key={`${index}:${hex}`} style={{ flex: 1, backgroundColor: hex }} />
              ))}
            </View>
            <View style={styles.identityCopy}>
              <Text variant="section">{t('you.title')}</Text>
              <Meta style={styles.identityMeta}>{t('you.meta')}</Meta>
            </View>
          </View>
          <Text style={styles.identityBody} tone="secondary" variant="body">
            {signature.length ? t('you.signature.body') : t('you.signature.empty')}
          </Text>
          <View style={styles.signatureStrip}>
            {colors.map((hex, index) => (
              <View
                key={`${index}:${hex}`}
                style={[styles.signatureChip, { backgroundColor: hex }]}
              />
            ))}
          </View>
          <Meta style={styles.identityEyebrow}>{t('you.signature.eyebrow')}</Meta>
        </View>
      </View>
    </View>
  );
}

const HERO_HEIGHT = 210;
/** The brand bands, for a library with nothing in it yet. */
const BRAND_FALLBACK = ['#7C5CFF', '#22D3EE', '#FF7A5C'] as const;

/**
 * Taste, read off the library.
 *
 * Each chip is a real query — tapping one lands on the library with that filter
 * already applied, which is the only reason a profile should show a preference
 * at all. A chip that merely states a fact about you is decoration.
 */
function TasteSection({
  palettes,
  onPick,
}: {
  palettes: readonly Palette[];
  onPick: (params: { mood?: ColorMood; style?: VisualStyle }) => void;
}) {
  const { t } = usePreferences();
  const moods = useMemo(() => moodTaste(palettes).slice(0, 3), [palettes]);
  const styleRanks = useMemo(() => styleTaste(palettes).slice(0, 3), [palettes]);
  const leader = moods[0];

  return (
    <>
      <Gutter style={styles.sectionHead}>
        <SectionHead meta={t('you.taste.meta')} title={t('you.taste.title')} />
      </Gutter>

      <Gutter style={styles.taste}>
        {leader ? (
          <>
            {/* The bar is drawn within the ranked set rather than against the
                whole library: a palette counts towards every mood it matches, so
                these shares deliberately do not sum to one. */}
            <View style={styles.tasteBar}>
              {moods.map((entry) => (
                <View
                  key={entry.value}
                  style={{
                    flex: entry.count,
                    backgroundColor: MOOD_INK[entry.value],
                  }}
                />
              ))}
            </View>

            <View style={styles.tasteChips}>
              {moods.map((entry) => (
                <Chip
                  key={entry.value}
                  label={`${t(`library.mood.${entry.value}`)} ${entry.count}`}
                  onPress={() => onPick({ mood: entry.value })}
                  tone={entry.value === leader.value ? 'info' : 'default'}
                />
              ))}
              {styleRanks.map((entry) => (
                <Chip
                  key={entry.value}
                  label={`${t(`library.style.${entry.value}`)} ${entry.count}`}
                  onPress={() => onPick({ style: entry.value })}
                />
              ))}
            </View>
          </>
        ) : (
          <Text tone="secondary" variant="body">
            {t('you.taste.empty')}
          </Text>
        )}
      </Gutter>
    </>
  );
}

/**
 * A colour per mood, so the taste bar is legible without reading its labels.
 * They are the system's own accents rather than new values — warm is the warm
 * accent, cool is info, vibrant is the signal, and so on.
 */
const MOOD_INK: Record<ColorMood, string> = {
  warm: ui.accent.warm,
  cool: ui.accent.info,
  pastel: '#F1E7D6',
  monochrome: 'rgba(237,234,227,.45)',
  vibrant: ui.accent.signal,
};

/**
 * A stat that goes somewhere. The hero size carries the number the screen is
 * about; the others are deliberately smaller, because three identical tiles is
 * what made the old screen a form.
 */
function StatTile({
  label,
  value,
  size = 'default',
  onPress,
}: {
  label: string;
  value: string;
  size?: 'hero' | 'default';
  onPress?: () => void;
}) {
  const { t } = usePreferences();
  const body = (
    <View style={[styles.tile, size === 'hero' && styles.tileHero]}>
      <Text style={size === 'hero' ? styles.tileHeroValue : undefined} variant="display">
        {value}
      </Text>
      <Meta style={styles.tileLabel}>{label}</Meta>
    </View>
  );

  if (!onPress) {
    return <View style={size === 'hero' ? styles.tileHeroBox : styles.tileBox}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityHint={t('you.stat.hint')}
      accessibilityLabel={`${value} ${label}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        size === 'hero' ? styles.tileHeroBox : styles.tileBox,
        pressed && styles.tilePressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

/** A single line of number and label, for facts that do not need a tile. */
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <Text variant="section">{value}</Text>
      <Meta style={styles.tileLabel}>{label}</Meta>
    </View>
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
  trailing?: React.ReactNode;
  onPress?: () => void;
  icon?: React.ComponentProps<typeof Icon>['name'];
}) {
  const body = (
    <View style={styles.row}>
      {icon ? <Icon color={ui.text.tertiary} name={icon} scale="control" /> : null}
      <Text style={styles.rowLabel}>{label}</Text>
      {trailing ?? (
        <View style={styles.rowValue}>
          <Text tone="secondary" variant="mono">
            {value}
          </Text>
          {/* The chevron belongs to rows that go somewhere, so it is drawn from
              the handler rather than concatenated into every value string. */}
          {onPress ? <Icon color={ui.text.tertiary} name="forward" scale="inline" /> : null}
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

const styles = StyleSheet.create({
  hero: {
    marginBottom: space.md,
  },
  heroArt: {
    height: HERO_HEIGHT,
    backgroundColor: ui.bg.media,
    overflow: 'hidden',
  },
  identity: {
    paddingHorizontal: space.gutter,
    // The overlap is the layering: the card sits on the join rather than under it.
    marginTop: -round.sheet * 2,
  },
  identityGlass: {
    borderRadius: round.sheet,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: elevation.floating.borderColor,
    backgroundColor: glass.shell.tint,
    padding: space.md,
    gap: space.sm,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: round.media,
    overflow: 'hidden',
  },
  identityCopy: {
    flex: 1,
    gap: 3,
  },
  identityMeta: {
    color: ui.text.tertiary,
  },
  identityBody: {
    paddingTop: 2,
  },
  identityEyebrow: {
    color: ui.text.quaternary,
  },
  signatureStrip: {
    flexDirection: 'row',
    gap: 5,
  },
  signatureChip: {
    flex: 1,
    height: 10,
    borderRadius: 5,
  },

  mosaic: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: space.xs,
  },
  mosaicColumn: {
    flex: 1,
    gap: 10,
  },
  tileBox: {
    flex: 1,
    borderRadius: round.card,
    borderWidth: 1,
    borderColor: ui.border.hairline,
    backgroundColor: ui.fill.card,
    overflow: 'hidden',
  },
  tileHeroBox: {
    flex: 1.15,
    borderRadius: round.card,
    borderWidth: 1,
    borderColor: tint.pro.borderColor,
    backgroundColor: tint.pro.backgroundColor,
    overflow: 'hidden',
  },
  tilePressed: {
    opacity: 0.75,
  },
  tile: {
    padding: space.cardGap,
    gap: 4,
  },
  tileHero: {
    paddingVertical: space.md + 6,
    justifyContent: 'flex-end',
    flex: 1,
  },
  tileHeroValue: {
    color: ui.action.link,
  },
  tileLabel: {
    fontSize: 9,
    letterSpacing: 1,
  },
  mini: {
    flex: 1,
    gap: 2,
  },
  thinRow: {
    flexDirection: 'row',
    gap: space.md,
    paddingTop: space.sm,
  },

  sectionHead: {
    paddingTop: space.sectionGap,
  },
  taste: {
    paddingTop: space.sm,
    gap: space.sm,
  },
  tasteBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: ui.fill.track,
  },
  tasteChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },

  setMeta: {
    fontSize: 9,
    letterSpacing: 1,
  },

  recent: {
    paddingTop: space.sm,
    gap: 8,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  recentStrip: {
    width: 60,
  },
  recentCopy: {
    flex: 1,
    gap: 3,
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
