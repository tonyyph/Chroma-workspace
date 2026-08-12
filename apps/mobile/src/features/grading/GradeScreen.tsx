import {
  describeGrade,
  FILM_STOCKS,
  gradeForAtmosphere,
  NEUTRAL_GRADE,
  readAtmosphere,
  type Grade,
} from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import { usePaletteParam, usePalettes } from '@/hooks';
import { hapticsService } from '@/infrastructure/dependencies';
import { bakeGradedThumbnail } from '@/lib/grade/bakeGrade';
import { useEntitlement, usePreferences, useSkin } from '@/providers';
import {
  Button,
  Card,
  Chip,
  EmptyGlyph,
  Gutter,
  InlineError,
  Meta,
  NavBar,
  Pressable,
  Screen,
  Slider,
  Text,
  useStyles,
} from '@/ui';
import { GradePreview, useGradeImage } from './GradePreview';

/**
 * The grade this photograph asks for, and the room to disagree with it.
 *
 * **Nothing here is a filter menu.** The first thing on the screen is the grade
 * the photograph's own colour produced, already applied, with the reason written
 * underneath in words. Film looks and manual control are alternatives to that
 * starting point rather than the point of the screen.
 *
 * Everything runs on the device. There is no network state to draw because there
 * is no network call to make — which is the feature, not a shortcut.
 */
export function GradeScreen() {
  const styles = useStyles(makeStyles);
  const skin = useSkin();
  const router = useRouter();
  const { t } = usePreferences();
  const { width } = useWindowDimensions();
  const { palette, loading } = usePaletteParam();
  const { save } = usePalettes();
  const canAdjust = useEntitlement('advanced_grading');

  /** The grade the photograph asks for. Recomputed only when its colours move. */
  const automatic = useMemo(
    () =>
      palette ? gradeForAtmosphere(readAtmosphere(palette.colors, palette.deltaE)) : NEUTRAL_GRADE,
    [palette],
  );

  const [grade, setGrade] = useState<Grade | null>(null);
  const [comparing, setComparing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [baking, setBaking] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);

  const current = grade ?? palette?.grade ?? automatic;
  const shown = comparing ? NEUTRAL_GRADE : current;

  const { image, status } = useGradeImage(palette?.photoUri ?? null);

  const previewWidth = width - space.gutter * 2;
  const previewHeight = Math.round(previewWidth * 1.25);

  const choose = (next: Grade) => {
    setGrade(next);
    setSaved(false);
    void hapticsService.fire('colourPinned');
  };

  const apply = async () => {
    if (!palette) return;
    setWriteFailed(false);
    setBaking(true);
    try {
      // Baked before the write, so the record and the file it points at land
      // together — a palette claiming a thumbnail that does not exist yet would
      // draw the ungraded frame until the next launch.
      const baked = palette.photoUri
        ? await bakeGradedThumbnail(palette.photoUri, current, palette.id)
        : null;
      await save({ ...palette, grade: current, thumbnailUri: baked });
      setSaved(true);
      void hapticsService.fire('extractionComplete');
    } catch {
      setWriteFailed(true);
    } finally {
      setBaking(false);
    }
  };

  const clear = async () => {
    if (!palette) return;
    setWriteFailed(false);
    try {
      await save({ ...palette, grade: null, thumbnailUri: null });
      setGrade(NEUTRAL_GRADE);
      setSaved(false);
    } catch {
      setWriteFailed(true);
    }
  };

  if (loading) {
    return (
      <Screen>
        <NavBar
          leading={t('palette.back')}
          leadingIcon="back"
          onLeading={router.back}
          title={t('grade.title')}
        />
        <Gutter style={styles.centred}>
          <ActivityIndicator color={skin.ui.text.tertiary} />
          <Meta>{t('grade.loading')}</Meta>
        </Gutter>
      </Screen>
    );
  }

  return (
    <Screen>
      <NavBar
        leading={t('palette.back')}
        leadingIcon="back"
        onLeading={router.back}
        title={t('grade.title')}
      />
      <Gutter>
        <Meta>{t('grade.subtitle')}</Meta>
      </Gutter>

      {writeFailed ? (
        <Gutter style={styles.error}>
          <InlineError detail={t('palette.writeFailedDetail')} title={t('palette.writeFailed')} />
        </Gutter>
      ) : null}

      <Gutter>
        <View style={[styles.stage, { height: previewHeight }]}>
          {status === 'ready' && image ? (
            <Pressable
              accessibilityHint={t('grade.compare')}
              accessibilityLabel={t('grade.original')}
              accessibilityRole="button"
              onPressIn={() => setComparing(true)}
              onPressOut={() => setComparing(false)}
            >
              <GradePreview
                grade={shown}
                height={previewHeight}
                image={image}
                width={previewWidth}
              />
            </Pressable>
          ) : null}

          {status === 'loading' ? (
            <View style={styles.stageState}>
              <ActivityIndicator color={skin.ui.text.tertiary} />
              <Meta>{t('grade.loading')}</Meta>
            </View>
          ) : null}

          {status === 'failed' ? (
            <View style={styles.stageState}>
              <EmptyGlyph kind="no-results" />
              <Text style={styles.stateCopy} tone="secondary" variant="body">
                {t('grade.failed')}
              </Text>
              <Meta style={styles.stateCopy}>{t('grade.failedDetail')}</Meta>
            </View>
          ) : null}

          {status === 'absent' ? (
            <View style={styles.stageState}>
              <EmptyGlyph kind="no-results" />
              <Text style={styles.stateCopy} tone="secondary" variant="body">
                {t('grade.noPhoto')}
              </Text>
            </View>
          ) : null}

          {comparing ? (
            <View style={styles.compareBadge} pointerEvents="none">
              <Meta>{t('grade.original')}</Meta>
            </View>
          ) : null}
        </View>

        <View style={styles.reason}>
          <Meta accessibilityLabel={describeGrade(shown).join(', ')}>
            {describeGrade(shown).join(' · ')}
          </Meta>
        </View>
      </Gutter>

      <Gutter style={styles.rail}>
        <Chip
          label={t('grade.auto')}
          onPress={() => choose(automatic)}
          tone={sameGrade(current, automatic) ? 'selected' : 'default'}
        />
        <Chip
          label={t('grade.original')}
          onPress={() => choose(NEUTRAL_GRADE)}
          tone={sameGrade(current, NEUTRAL_GRADE) ? 'selected' : 'default'}
        />
      </Gutter>

      <Gutter style={styles.sectionHead}>
        <Text tone="tertiary" variant="eyebrow">
          {t('grade.stocks')}
        </Text>
      </Gutter>
      <Gutter style={styles.rail}>
        {FILM_STOCKS.map((stock) => (
          <Chip
            key={stock.id}
            label={stock.name}
            onPress={() =>
              canAdjust ? choose(stock.grade) : router.push('/paywall?trigger=advanced-grading')
            }
            tone={!canAdjust ? 'pro' : sameGrade(current, stock.grade) ? 'selected' : 'default'}
          />
        ))}
      </Gutter>

      <Gutter style={styles.sectionHead}>
        <Text tone="tertiary" variant="eyebrow">
          {t('grade.controls')}
        </Text>
      </Gutter>

      {canAdjust ? (
        <Gutter style={styles.controls}>
          <GradeSlider
            grade={current}
            label={t('grade.exposure')}
            minimum={-1}
            onChange={choose}
            parameter="exposure"
            spoken={(value) => t('grade.stops', { value: (value * 2).toFixed(1) })}
          />
          <GradeSlider
            grade={current}
            label={t('grade.contrast')}
            minimum={-1}
            onChange={choose}
            parameter="contrast"
            spoken={(value) => t('grade.amount', { value: Math.round(value * 100) })}
          />
          <GradeSlider
            grade={current}
            label={t('grade.saturation')}
            minimum={-1}
            onChange={choose}
            parameter="saturation"
            spoken={(value) => t('grade.amount', { value: Math.round(value * 100) })}
          />
          <GradeSlider
            grade={current}
            label={t('grade.temperature')}
            minimum={-1}
            onChange={choose}
            parameter="temperature"
            spoken={(value) => t('grade.amount', { value: Math.round(value * 100) })}
          />
          <GradeSlider
            grade={current}
            label={t('grade.tint')}
            minimum={-1}
            onChange={choose}
            parameter="tint"
            spoken={(value) => t('grade.amount', { value: Math.round(value * 100) })}
          />
          <GradeSlider
            grade={current}
            label={t('grade.lift')}
            maximum={0.2}
            minimum={-0.2}
            onChange={choose}
            parameter="lift"
            spoken={(value) => t('grade.amount', { value: Math.round(value * 100) })}
          />
          <GradeSlider
            grade={current}
            label={t('grade.vignette')}
            onChange={choose}
            parameter="vignette"
            spoken={(value) => t('grade.amount', { value: Math.round(value * 100) })}
          />
          <GradeSlider
            grade={current}
            label={t('grade.grain')}
            onChange={choose}
            parameter="grain"
            spoken={(value) => t('grade.amount', { value: Math.round(value * 100) })}
          />
        </Gutter>
      ) : (
        <Gutter>
          <Card style={styles.proCard}>
            <Text tone="secondary" variant="body">
              {t('grade.proBody')}
            </Text>
            <Button
              label={t('common.pro')}
              onPress={() => router.push('/paywall?trigger=advanced-grading')}
              size="xs"
            />
          </Card>
        </Gutter>
      )}

      <Gutter style={styles.actions}>
        <Button
          disabled={status !== 'ready' || saved || baking}
          label={saved ? t('grade.applied') : baking ? t('grade.applying') : t('grade.apply')}
          onPress={() => void apply()}
          size="lg"
          variant="contrast"
        />
        {palette?.grade ? (
          <Button label={t('grade.remove')} onPress={() => void clear()} variant="ghost" />
        ) : null}
      </Gutter>
    </Screen>
  );
}

/** The eight scalar parameters a slider can move. */
type ScalarParameter =
  'exposure' | 'contrast' | 'lift' | 'saturation' | 'temperature' | 'tint' | 'vignette' | 'grain';

/**
 * One parameter of the grade.
 *
 * `spoken` exists because "0.72" is not a value anyone can act on: the slider
 * announces "1.4 stops" or "72 per cent", which is what the control actually
 * means.
 */
function GradeSlider({
  grade,
  parameter,
  label,
  onChange,
  spoken,
  minimum = 0,
  maximum = 1,
}: {
  grade: Grade;
  parameter: ScalarParameter;
  label: string;
  onChange: (grade: Grade) => void;
  spoken: (value: number) => string;
  minimum?: number;
  maximum?: number;
}) {
  const value = grade[parameter];
  return (
    <Slider
      label={label}
      maximumValue={maximum}
      minimumValue={minimum}
      onChange={(next) => onChange({ ...grade, [parameter]: Math.round(next * 1000) / 1000 })}
      value={value}
      valueText={spoken(value)}
    />
  );
}

/**
 * Whether two grades are the same look.
 *
 * Compared by value rather than by identity because the chips have to show which
 * one is active after a reload, when the stored grade is a different object that
 * happens to hold the same numbers.
 */
function sameGrade(a: Grade, b: Grade): boolean {
  return (
    a.exposure === b.exposure &&
    a.contrast === b.contrast &&
    a.lift === b.lift &&
    a.saturation === b.saturation &&
    a.temperature === b.temperature &&
    a.tint === b.tint &&
    a.vignette === b.vignette &&
    a.grain === b.grain &&
    a.shadowTint.hue === b.shadowTint.hue &&
    a.shadowTint.strength === b.shadowTint.strength &&
    a.highlightTint.hue === b.highlightTint.hue &&
    a.highlightTint.strength === b.highlightTint.strength
  );
}

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    centred: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: space.sm,
      paddingTop: space.xl,
    },
    error: { paddingBottom: space.cardGap },
    stage: {
      borderRadius: skin.round.media,
      overflow: 'hidden',
      backgroundColor: skin.ui.bg.media,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stageState: { alignItems: 'center', gap: space.xs, paddingHorizontal: space.gutter },
    stateCopy: { textAlign: 'center' },
    compareBadge: {
      position: 'absolute',
      top: space.sm,
      left: space.sm,
      backgroundColor: skin.ui.scrim.strong,
      borderRadius: skin.round.chip,
      paddingHorizontal: space.xs,
      paddingVertical: 4,
    },
    reason: { paddingTop: space.sm },
    rail: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, paddingTop: space.sm },
    sectionHead: { paddingTop: space.sectionGap },
    controls: { paddingTop: space.sm, gap: space.md },
    proCard: { gap: space.sm, marginTop: space.sm, alignItems: 'flex-start' },
    actions: { paddingTop: space.sectionGap, gap: space.xs },
  });
