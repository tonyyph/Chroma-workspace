import { space, type Skin } from '@cw/tokens';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { usePreferences, useSkin } from '@/providers';
import {
  Card,
  Icon,
  InlineError,
  Meta,
  Pressable,
  Screen,
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
 * The commonest job is two taps: open this, touch a photograph. Nothing is
 * asked for and no system sheet appears. The camera costs one tap more than it
 * used to, which is the price of it being one job among several.
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
      // The screen stays up while the read runs. Routing first and reporting
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

  return (
    <Screen>
      <View style={styles.head}>
        <Text variant="headline">{t('source.title')}</Text>
        <Pressable
          accessibilityLabel={t('source.cancel')}
          accessibilityRole="button"
          onPress={onCancel}
          style={styles.close}
        >
          <Icon name="close" scale="inline" />
        </Pressable>
      </View>

      {state === 'unavailable' ? null : (
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
                <Meta>{t('source.chooseMore')}</Meta>
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
            {state === 'unasked' ? (
              /**
               * The ask lives on a tile, not in an effect.
               *
               * iOS asks once. A dialog raised because a sheet opened is one the
               * user cannot connect to anything they did, and refusing it is
               * permanent — so the question is attached to the thing it buys.
               */
              <Pressable
                accessibilityLabel={t('source.showRecent')}
                accessibilityRole="button"
                onPress={ask}
                style={[styles.tile, styles.tileAsk]}
              >
                <Icon name="photos" scale="control" />
                <Meta style={styles.askCopy}>{t('source.showRecent')}</Meta>
              </Pressable>
            ) : null}

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
      )}

      {working ? (
        <View style={styles.working}>
          <ActivityIndicator color={skin.ui.text.tertiary} />
          <Meta>{t('source.working')}</Meta>
        </View>
      ) : null}

      {failure ? (
        <View style={styles.error}>
          <InlineError detail={t(COPY[failure][1])} title={t(COPY[failure][0])} />
        </View>
      ) : null}

      <View style={styles.rows}>
        <SourceRow
          detail={t('source.allPhotosDetail')}
          disabled={working}
          icon="photos"
          label={t('source.allPhotos')}
          onPress={() => void pick()}
        />
        <SourceRow
          detail={t('source.cameraDetail')}
          disabled={working}
          icon="capture"
          label={t('source.camera')}
          onPress={onCamera}
        />
        <SourceRow
          detail={t('source.scanDetail')}
          disabled={working}
          icon="scan"
          label={t('source.scan')}
          onPress={onScan}
        />
      </View>
    </Screen>
  );
}

function SourceRow({
  icon,
  label,
  detail,
  onPress,
  disabled,
}: {
  icon: IconName;
  label: string;
  detail: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const styles = useStyles(makeStyles);
  return (
    <Card
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
      <Icon name={icon} scale="control" />
      <View style={styles.rowCopy}>
        <Text variant="rowTitle">{label}</Text>
        <Meta>{detail}</Meta>
      </View>
      <Icon name="forward" scale="inline" />
    </Card>
  );
}

const TILE = 78;

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
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
    tileAsk: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: space.xs,
      borderWidth: 1,
      borderColor: skin.ui.border.control,
      borderStyle: 'dashed',
      backgroundColor: skin.ui.fill.chipGhost,
    },
    askCopy: { textAlign: 'center' },
    tileImage: { width: '100%', height: '100%' },
    working: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.xs,
      paddingHorizontal: space.gutter,
      paddingTop: space.md,
    },
    error: { paddingHorizontal: space.gutter, paddingTop: space.md },
    rows: { paddingHorizontal: space.gutter, paddingTop: space.md, gap: space.cardGap },
    row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    rowCopy: { flex: 1, gap: 2 },
  });
