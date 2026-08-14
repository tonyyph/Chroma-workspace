import { space, type Skin } from '@cw/tokens';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { usePreferences, useSkin } from '@/providers';
import {
  BandSweepCanvas,
  Icon,
  InlineError,
  LiveReadPulse,
  Meta,
  Pressable,
  Text,
  useStyles,
} from '@/ui';
import { useRecentPhotos, type RecentPhoto } from './useRecentPhotos';

/**
 * What went wrong, in the words the sheet has for it.
 *
 * Three, not one. "This file will not open", "this photograph has too little
 * colour in it" and "the record would not save" send a user to three different
 * places, and pooling them into one message sends everyone to the wrong one.
 */
export type SourceFailure = 'decode' | 'tooFewColours' | 'write';

const COPY = {
  decode: ['source.decodeFailed', 'source.decodeFailedDetail'],
  tooFewColours: ['source.tooFewColours', 'source.tooFewColoursDetail'],
  write: ['palette.writeFailed', 'palette.writeFailedDetail'],
} as const;

/** Frame numbers in the strip: 01, 02 … rather than 1, 2. */
const pad = (index: number) => String(index + 1).padStart(2, '0');

/**
 * B0 · INPUT SELECT.
 *
 * The app used to open the camera and keep everything else behind it: importing
 * a photograph meant granting camera access, watching a live preview, and then
 * finding a button — and refusing the camera made importing unreachable
 * entirely. This is the door instead, and the camera is one of the answers
 * rather than the question.
 *
 * **Three channels, not three menu items.** An earlier version drew a grouped
 * settings list, which is what every app's share sheet looks like and says
 * nothing about what this one measures. The app already owns an instrument
 * vocabulary — ΔE readouts, band sweeps, mono at 8pt on wide tracking, the live
 * read pulse — and none of it appeared on the screen people meet first. Each
 * source now shows its own signature: the library shows the photograph it would
 * open with, the camera shows the sweep it reads light with, scan shows the
 * pulse it pins colour with.
 */
export function SourceSheet({
  onPhoto,
  onCamera,
  onScan,
  onCancel,
}: {
  /** A chosen photograph, already a local uri. Resolving it is the caller's job. */
  onPhoto: (uri: string) => Promise<SourceFailure | null>;
  onCamera: () => void;
  onScan: () => void;
  onCancel: () => void;
}) {
  const styles = useStyles(makeStyles);
  const skin = useSkin();
  const { t } = usePreferences();
  const { state, photos, ask, chooseMore } = useRecentPhotos();
  const [working, setWorking] = useState(false);
  const [failure, setFailure] = useState<SourceFailure | null>(null);

  const take = useCallback(
    async (uri: string) => {
      setFailure(null);
      setWorking(true);
      // The sheet stays up while the read runs. Routing first and reporting
      // afterwards would put the failure on a screen the photo never reached.
      setFailure(await onPhoto(uri));
      setWorking(false);
    },
    [onPhoto],
  );

  /**
   * The system picker, which needs no permission at all.
   *
   * This is why a refusal costs only the strip: `launchImageLibraryAsync` runs
   * out of process, so channel 01 works in every state the sheet can be in.
   */
  const pick = useCallback(async () => {
    setFailure(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    // The sheet can be dismissed by the system rather than by the user, in
    // which case there is no `assets` array at all.
    const chosen = result?.canceled === false ? result.assets?.[0]?.uri : undefined;
    if (chosen) await take(chosen);
  }, [take]);

  const granted = state === 'granted' || state === 'limited';
  /** Channel 01 wears the newest photograph, when it is allowed to see one. */
  const face = granted ? photos[0]?.uri : undefined;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.wordmark} variant="section">
          {t('source.input')}
        </Text>
        <View style={styles.headRight}>
          <Meta>{t('source.channels', { count: 3 })}</Meta>
          <Pressable
            accessibilityLabel={t('source.cancel')}
            accessibilityRole="button"
            onPress={onCancel}
            style={styles.close}
          >
            <Icon name="close" scale="inline" />
          </Pressable>
        </View>
      </View>
      <View style={styles.rule} />

      <View style={styles.channels}>
        <Channel
          disabled={working}
          face={face}
          index={0}
          label={t('source.allPhotos')}
          onPress={() => void pick()}
        />
        <Channel
          disabled={working}
          index={1}
          label={t('source.camera')}
          onPress={onCamera}
          signature="sweep"
        />
        <Channel
          disabled={working}
          index={2}
          label={t('source.scan')}
          onPress={onScan}
          signature="pulse"
        />
      </View>

      <View style={styles.stripHead}>
        <Text tone="tertiary" variant="eyebrow">
          {t('source.recent')}
        </Text>
        {state === 'unasked' ? (
          /**
           * The ask is a readout, not a dashed square in an empty row.
           *
           * iOS asks once, so it is raised from a tap rather than on open: a
           * dialog that appears because a sheet opened is one the user cannot
           * connect to anything they did, and they refuse it on that basis.
           */
          <Pressable
            accessibilityLabel={t('source.showRecent')}
            accessibilityRole="button"
            onPress={ask}
          >
            <Meta tone="link">{t('source.showRecent')}</Meta>
          </Pressable>
        ) : null}
        {state === 'limited' ? (
          <Pressable
            accessibilityLabel={t('source.chooseMore')}
            accessibilityRole="button"
            onPress={chooseMore}
          >
            <Meta tone="link">{t('source.chooseMore')}</Meta>
          </Pressable>
        ) : null}
        {granted ? <Meta>{t('source.frames', { count: photos.length })}</Meta> : null}
      </View>

      {granted && photos.length ? (
        <ScrollView
          contentContainerStyle={styles.strip}
          horizontal
          // The channels below are reachable while a keyboard is up elsewhere in
          // the stack; without this the first tap only dismisses it.
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
        >
          {photos.map((photo, index) => (
            <Frame
              disabled={working}
              index={index}
              key={photo.id}
              onPress={() => void take(photo.uri)}
              photo={photo}
            />
          ))}
        </ScrollView>
      ) : (
        /* The strip keeps its height in every state. A row that appears when a
           permission lands would shove the channels down under the thumb that
           was already reaching for them. */
        <View style={styles.stripEmpty}>
          {/* A sentence, so it is set as one. Mono caps on wide tracking is a
              legend for a control, not a line of prose — run a clause through
              it and it becomes the widest thing on the screen. */}
          <Text tone="quaternary" variant="body">
            {t(`source.strip.${state}`)}
          </Text>
        </View>
      )}

      {working ? (
        <View style={styles.status}>
          <ActivityIndicator color={skin.ui.text.tertiary} />
          <Meta>{t('source.working')}</Meta>
        </View>
      ) : null}

      {failure ? (
        <View style={styles.status}>
          <InlineError detail={t(COPY[failure][1])} title={t(COPY[failure][0])} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * One channel: an index, a signature, a name.
 *
 * The signature is the point. A tile with an icon in it is a menu item drawn
 * larger; a tile showing the photograph it would open, or the sweep the lens
 * reads with, tells you what taking that route gets you before you take it.
 */
function Channel({
  index,
  label,
  onPress,
  disabled,
  face,
  signature,
}: {
  index: number;
  label: string;
  onPress: () => void;
  disabled: boolean;
  /** Channel 01 only: the newest photograph, when the library is readable. */
  face?: string | undefined;
  signature?: 'sweep' | 'pulse';
}) {
  const styles = useStyles(makeStyles);
  const skin = useSkin();

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      // Guarded inside rather than by withholding the handler: a channel that
      // keeps its `onPress` while a read is running still announces itself as
      // the button it is, and `accessibilityState` is what says it is busy.
      onPress={() => {
        if (!disabled) onPress();
      }}
      style={styles.channel}
    >
      <View style={styles.signature}>
        {face ? (
          <Image
            contentFit="cover"
            source={{ uri: face }}
            style={StyleSheet.absoluteFill}
            testID="channel-face"
          />
        ) : null}
        {signature === 'sweep' ? <BandSweepCanvas height={SIGNATURE} width={SIGNATURE} /> : null}
        {signature === 'pulse' ? <LiveReadPulse /> : null}
        {!face && !signature ? <Icon color={skin.ui.text.tertiary} name="library" /> : null}
        <Text style={styles.index} tone="quaternary" variant="monoSmall">
          {pad(index)}
        </Text>
      </View>
      <Text style={styles.channelLabel} tone="secondary" variant="chip">
        {label}
      </Text>
    </Pressable>
  );
}

/** One frame in the strip, numbered the way a contact sheet numbers them. */
function Frame({
  photo,
  index,
  onPress,
  disabled,
}: {
  photo: RecentPhoto;
  index: number;
  onPress: () => void;
  disabled: boolean;
}) {
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();

  return (
    <Pressable
      accessibilityLabel={t('source.photo', { index: pad(index) })}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={() => {
        if (!disabled) onPress();
      }}
      style={styles.frame}
    >
      <Image contentFit="cover" source={{ uri: photo.uri }} style={styles.frameImage} />
      <Text tone="quaternary" variant="monoSmall">
        {pad(index)}
      </Text>
    </Pressable>
  );
}

const SIGNATURE = 96;
const FRAME = 72;

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    // No `flex: 1`. The sheet is sized to fit these contents, so a root that
    // grew to fill the display would defeat the detent that measures it.
    root: { backgroundColor: skin.ui.bg.base, paddingBottom: space.lg },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.gutter,
      paddingTop: space.md,
      paddingBottom: space.sm,
    },
    // Tracked wide, the way the panel legends on the capture screen are. This is
    // a legend for an instrument, not a headline for an article.
    wordmark: { letterSpacing: 4 },
    headRight: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    close: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: skin.ui.fill.chipGhost,
    },
    rule: { height: 1, backgroundColor: skin.ui.border.hairlineStrong },
    channels: {
      flexDirection: 'row',
      gap: space.xs,
      paddingHorizontal: space.gutter,
      paddingTop: space.md,
    },
    channel: { flex: 1, gap: 8 },
    signature: {
      height: SIGNATURE,
      borderRadius: skin.round.control,
      borderWidth: 1,
      borderColor: skin.ui.border.control,
      backgroundColor: skin.ui.bg.media,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    index: { position: 'absolute', top: 8, left: 8 },
    channelLabel: { paddingHorizontal: 2 },
    stripHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.gutter,
      paddingTop: space.lg,
    },
    strip: { gap: space.xs, paddingHorizontal: space.gutter, paddingTop: space.sm },
    stripEmpty: {
      height: FRAME + 20,
      justifyContent: 'center',
      paddingHorizontal: space.gutter,
      paddingTop: space.sm,
    },
    frame: { gap: 4, alignItems: 'center' },
    frameImage: {
      width: FRAME,
      height: FRAME,
      borderRadius: skin.round.control,
      backgroundColor: skin.ui.bg.media,
    },
    status: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      paddingHorizontal: space.gutter,
      paddingTop: space.md,
    },
  });
