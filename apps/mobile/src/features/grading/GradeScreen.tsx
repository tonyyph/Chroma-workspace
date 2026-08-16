import {
  describeGrade,
  gradesEqual,
  gradeForAtmosphere,
  look,
  NEUTRAL_GRADE,
  readAtmosphere,
  scaleGrade,
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
  SwatchStrip,
  Slider,
  Text,
  useStyles,
} from '@/ui';
import { dialledLook } from './dialledLook';
import { GradePreview, useGradeImage } from './GradePreview';
import { LookGrid } from './LookGrid';
import { useGradedExport } from './useGradedExport';

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

  /**
   * The look, and how much of it.
   *
   * They are separate pieces of state because the slider has to be able to go
   * back up: scaling the shown grade in place would lose the look at 20% and
   * leave nothing to return to. `base` is what was chosen, `amount` is the dial,
   * and `current` is the only thing anything else on this screen sees.
   */
  const [base, setBase] = useState<Grade | null>(null);
  const [amount, setAmount] = useState(1);
  const [comparing, setComparing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [baking, setBaking] = useState(false);
  const [writeFailed, setWriteFailed] = useState(false);

  // `scaleGrade(x, 1)` is `x`, so resolving the base up front costs nothing at
  // full strength — and it is what stops the dial swapping a saved look out.
  const current = scaleGrade(dialledLook(base, palette?.grade ?? null, automatic), amount);
  const shown = comparing ? NEUTRAL_GRADE : current;

  const { image, status } = useGradeImage(palette?.photoUri ?? null);
  const exporter = useGradedExport(palette?.photoUri ?? null, current);

  const previewWidth = width - space.gutter * 2;
  const previewHeight = Math.round(previewWidth * 1.15);

  /**
   * Choosing a look resets the dial to full.
   *
   * Anything else means tapping a look and being shown a weakened version of it
   * for reasons invisible on screen.
   */
  const choose = (next: Grade) => {
    setBase(next);
    setAmount(1);
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
      setBase(NEUTRAL_GRADE);
      setAmount(1);
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

        {/*
          The palette, on the screen the photograph landed on.

          Importing writes a palette record and then opens the grade, so the
          colours exist whether or not anyone asked for them — and without this
          they were invisible from here, which made the record look like
          bookkeeping rather than the other half of what was made. Tapping goes
          to the sampler, because someone looking hard enough at these five
          swatches to tap them is someone who disagrees with one.
        */}
        {palette?.colors.length ? (
          <Pressable
            accessibilityHint={t('grade.paletteHint')}
            accessibilityLabel={t('grade.palette', { count: palette.colors.length })}
            accessibilityRole="button"
            onPress={() => router.push(`/tools/pick?id=${palette.id}`)}
            style={styles.palette}
          >
            <SwatchStrip colors={palette.colors} height={28} radius={skin.round.control} />
            <Meta>{t('grade.palette', { count: palette.colors.length })}</Meta>
          </Pressable>
        ) : null}
      </Gutter>

      <Gutter style={styles.rail}>
        <Chip
          label={t('grade.auto')}
          onPress={() => choose(automatic)}
          tone={gradesEqual(current, automatic) ? 'selected' : 'default'}
        />
        <Chip
          label={t('grade.original')}
          onPress={() => choose(NEUTRAL_GRADE)}
          tone={gradesEqual(current, NEUTRAL_GRADE) ? 'selected' : 'default'}
        />
      </Gutter>

      <Gutter style={styles.sectionHead}>
        <Text tone="tertiary" variant="eyebrow">
          {t('grade.stocks')}
        </Text>
      </Gutter>
      {/*
        The grid needs the decoded photograph to preview on. Without one there is
        nothing to show a look *doing*, so it falls back to a rail of names — but
        it keeps the collections either way, because the alternative is a
        hundred and ten chips wrapped down the screen.
      */}
      <LookGrid
        current={current}
        image={status === 'ready' ? image : null}
        isLocked={(lookId) => !canAdjust && !(look(lookId)?.free ?? false)}
        onChoose={choose}
        onLocked={() => router.push('/paywall?trigger=advanced-grading')}
      />

      {/*
        Free, and outside the Pro gate on purpose: the automatic grade has to
        stay free, and a dial is what turns it from take-it-or-leave-it into
        something anyone can actually place.
      */}
      <Gutter style={styles.intensity}>
        <Slider
          label={t('grade.intensity')}
          maximumValue={1}
          minimumValue={0}
          onChange={(next) => {
            setAmount(Math.round(next * 100) / 100);
            setSaved(false);
          }}
          value={amount}
          valueText={t('grade.amount', { value: Math.round(amount * 100) })}
        />
      </Gutter>

      <Gutter style={styles.sectionHead}>
        <Text tone="tertiary" variant="eyebrow">
          {t('grade.controls')}
        </Text>
      </Gutter>

      {/*
        A manual edit takes over: `choose` receives the already-scaled grade and
        makes it the base at full strength. Nothing on screen jumps — the numbers
        are identical — and the dial honestly reads 100%, because a grade someone
        set by hand is not a percentage of anything.
      */}

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

      {/*
        Saving the photograph is the primary action and applying the grade is
        not. Someone who imported a frame came to get a frame out; remembering
        the look on the palette record is the smaller, separate intention.
      */}
      <Gutter style={styles.actions}>
        <Button
          disabled={status !== 'ready' || exporter.status === 'working'}
          label={exporter.status === 'working' ? t('grade.exporting') : t('grade.save')}
          onPress={exporter.save}
          size="lg"
          variant="contrast"
        />
        <Button
          disabled={status !== 'ready' || exporter.status === 'working'}
          label={t('grade.share')}
          onPress={exporter.share}
          variant="secondary"
        />

        {exporter.status === 'saved' ? <Meta>{t('grade.savedPhoto')}</Meta> : null}
        {exporter.status === 'shared' ? <Meta>{t('grade.sharedPhoto')}</Meta> : null}
        {exporter.status === 'denied' ? (
          <InlineError detail={t('grade.saveDeniedDetail')} title={t('grade.saveDenied')} />
        ) : null}
        {exporter.status === 'failed' ? (
          <InlineError detail={t('grade.exportFailedDetail')} title={t('grade.exportFailed')} />
        ) : null}

        <Button
          disabled={status !== 'ready' || saved || baking}
          label={saved ? t('grade.applied') : baking ? t('grade.applying') : t('grade.apply')}
          onPress={() => void apply()}
          variant="secondary"
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
      marginTop: space.sm,
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
    palette: { paddingTop: space.md, gap: 6 },
    reason: { paddingTop: space.sm },
    rail: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, paddingTop: space.sm },
    intensity: { paddingTop: space.md },
    sectionHead: { paddingVertical: space.md },
    controls: { paddingTop: space.sm, gap: space.md },
    proCard: { gap: space.sm, marginTop: space.sm, alignItems: 'flex-start' },
    actions: { paddingTop: space.sectionGap, gap: space.xs },
  });
