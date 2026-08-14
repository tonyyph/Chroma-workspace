import { space, type Skin } from '@cw/tokens';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { usePreferences, useSkin } from '@/providers';
import {
  CardGroup,
  Icon,
  InlineError,
  Meta,
  Pressable,
  Text,
  useStyles,
  type IconName,
} from '@/ui';
import { useRecentPhotos } from './useRecentPhotos';

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

/**
 * B0 · WHERE TO START.
 *
 * The app used to open the camera and keep everything else behind it: importing
 * a photograph meant granting camera access, watching a live preview, and then
 * finding a button — and refusing the camera made importing unreachable
 * entirely. This screen is the door instead, and the camera is one of the
 * answers rather than the question.
 *
 * **Laid out as a sheet the height of its contents**, and the rows use the same
 * grouped-card shape as the palette workbench and the settings deck. The first
 * version was a full-screen modal holding three floating cards with mono
 * upper-case subtitles — which left the bottom half of the display empty and
 * made the *subtitle* the widest thing in every row.
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
   * This is why a refusal above costs only the strip: `launchImageLibraryAsync`
   * runs out of process, so this row works in every state the sheet can be in.
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

  /** Only when there is something to draw does the strip earn its heading. */
  const showStrip = state === 'granted' || state === 'limited';

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text variant="title">{t('source.title')}</Text>
        <Pressable
          accessibilityLabel={t('source.cancel')}
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.close}
        >
          <Icon name="close" scale="inline" />
        </Pressable>
      </View>

      {showStrip ? (
        <>
          <View style={styles.stripHead}>
            <Text tone="tertiary" variant="eyebrow">
              {t('source.recent')}
            </Text>
            {state === 'limited' ? (
              <Pressable
                accessibilityLabel={t('source.chooseMore')}
                accessibilityRole="button"
                onPress={chooseMore}
              >
                <Meta tone="link">{t('source.chooseMore')}</Meta>
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            contentContainerStyle={styles.strip}
            horizontal
            // The rows below are reachable while a keyboard is up elsewhere in
            // the stack; without this the first tap only dismisses it.
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
          >
            {photos.map((photo) => (
              <Pressable
                accessibilityLabel={t('source.photo')}
                accessibilityRole="button"
                disabled={working}
                key={photo.id}
                onPress={() => void take(photo.uri)}
                style={styles.tile}
              >
                <Image contentFit="cover" source={{ uri: photo.uri }} style={styles.tileImage} />
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      <View style={styles.rows}>
        <CardGroup>
          {/*
            The offer to show recent photos is a row, not a lonely dashed
            square above an empty heading. It buys the strip, so it sits with
            the other ways in — and it only exists while it can still be taken.
          */}
          {state === 'unasked' ? (
            <SourceRow
              disabled={working}
              icon="photos"
              key="show-recent"
              label={t('source.showRecent')}
              onPress={ask}
            />
          ) : null}
          <SourceRow
            disabled={working}
            icon="library"
            key="all-photos"
            label={t('source.allPhotos')}
            onPress={() => void pick()}
          />
          <SourceRow
            disabled={working}
            icon="capture"
            key="camera"
            label={t('source.camera')}
            onPress={onCamera}
          />
          <SourceRow
            disabled={working}
            icon="scan"
            key="scan"
            label={t('source.scan')}
            onPress={onScan}
          />
        </CardGroup>
      </View>

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
 * The same row the workbench and the settings deck draw: an icon, a label, a
 * chevron. No subtitle — in the first version the mono upper-case explanation
 * ran wider than the title it explained, which put the emphasis on the least
 * important line. What a row does belongs in what it is called.
 */
function SourceRow({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const styles = useStyles(makeStyles);
  const skin = useSkin();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      // Guarded inside rather than by withholding the handler: a row that keeps
      // its `onPress` while a read is running still announces itself as the
      // button it is, and `accessibilityState` is what says it is busy.
      onPress={() => {
        if (!disabled) onPress();
      }}
      style={styles.row}
    >
      <Icon color={skin.ui.text.secondary} name={icon} scale="control" />
      <Text style={styles.rowLabel} variant="rowTitle">
        {label}
      </Text>
      <Icon color={skin.ui.text.tertiary} name="forward" scale="inline" />
    </Pressable>
  );
}

const TILE = 84;

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
    },
    close: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: skin.ui.fill.chipGhost,
    },
    stripHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: space.gutter,
      paddingTop: space.md,
    },
    strip: { gap: space.xs, paddingHorizontal: space.gutter, paddingTop: space.sm },
    tile: {
      width: TILE,
      height: TILE,
      borderRadius: skin.round.control,
      overflow: 'hidden',
      backgroundColor: skin.ui.bg.media,
    },
    tileImage: { width: '100%', height: '100%' },
    rows: { paddingHorizontal: space.gutter, paddingTop: space.md },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    rowLabel: { flex: 1 },
    status: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      paddingHorizontal: space.gutter,
      paddingTop: space.md,
    },
  });
