import { round, size, space, typeExtra, ui } from '@chromawave/design-tokens';
import type { Palette } from '@chromawave/domain';
import { useState } from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { PalettePhoto } from '@/features/library/PalettePhoto';
import { usePreferences } from '@/providers';
import {
  Button,
  Card,
  Gutter,
  InlineError,
  Meta,
  NavBar,
  Screen,
  ScreenHeader,
  SwatchStrip,
  Text,
} from '@/ui';

/**
 * C3a · NEW SET · the draft.
 *
 * Nothing is written until Save is pressed: the set only exists once it has a
 * name, so the list never fills with "Untitled set" rows someone abandoned on
 * the way in. The palettes below are the ones the set will start with, shown
 * rather than described so the name is not the only thing being confirmed.
 */
export function NewSetScreen({
  seedPalettes,
  saving,
  failed,
  onCancel,
  onSave,
}: {
  seedPalettes: readonly Palette[];
  saving: boolean;
  failed: boolean;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const { t } = usePreferences();
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);
  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed || saving) return;
    Keyboard.dismiss();
    onSave(trimmed);
  };

  return (
    <Screen>
      <NavBar leading={t('common.cancel')} leadingIcon="close" onLeading={onCancel} />

      <Gutter style={styles.head}>
        <ScreenHeader
          meta={
            seedPalettes.length
              ? t('sets.new.seeded', { count: seedPalettes.length })
              : t('sets.new.seededEmpty')
          }
          title={t('sets.new.title')}
        />
      </Gutter>

      {failed ? (
        <Gutter style={styles.error}>
          <InlineError detail={t('sets.createFailedDetail')} title={t('sets.createFailed')} />
        </Gutter>
      ) : null}

      <Gutter style={styles.form}>
        <View
          style={[
            styles.field,
            { borderColor: focused ? ui.action.primary : ui.border.hairlineStrong },
          ]}
        >
          <TextInput
            accessibilityLabel={t('sets.new.nameLabel')}
            autoCapitalize="sentences"
            autoFocus
            maxLength={60}
            onBlur={() => setFocused(false)}
            onChangeText={setName}
            onFocus={() => setFocused(true)}
            onSubmitEditing={submit}
            placeholder={t('sets.new.namePlaceholder')}
            placeholderTextColor={ui.text.tertiary}
            returnKeyType="done"
            style={styles.input}
            value={name}
          />
        </View>
        <Button
          disabled={trimmed.length === 0 || saving}
          label={t(saving ? 'sets.new.saving' : 'common.save')}
          onPress={submit}
        />
      </Gutter>

      {seedPalettes.length ? (
        <Gutter style={styles.rows}>
          <Meta>{t('sets.new.startsWith')}</Meta>
          {seedPalettes.map((palette) => (
            <Card key={palette.id} style={styles.row}>
              <PalettePhoto palette={palette} style={styles.rowThumb} />
              <View style={styles.rowCopy}>
                <Text variant="cardTitle">{palette.name}</Text>
              </View>
              <SwatchStrip
                colors={palette.colors.slice(0, 3)}
                height={26}
                radius={8}
                style={styles.rowStrip}
              />
            </Card>
          ))}
        </Gutter>
      ) : (
        <Gutter style={styles.hint}>
          <Text tone="secondary" variant="body">
            {t('sets.new.hint')}
          </Text>
        </Gutter>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingTop: space.md },
  error: { paddingTop: space.md },
  form: { paddingTop: space.md + 2, gap: space.sm },
  field: {
    height: size.field,
    borderRadius: round.full,
    backgroundColor: ui.fill.chip,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  input: {
    padding: 0,
    color: ui.text.primary,
    fontFamily: typeExtra.button.fontFamily,
    fontSize: 14,
  },
  rows: { paddingTop: space.sectionGap, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm },
  rowThumb: { width: 44, height: 44, borderRadius: round.control, backgroundColor: ui.bg.media },
  rowCopy: { flex: 1, gap: 3 },
  rowStrip: { width: 60 },
  hint: { paddingTop: space.sectionGap },
});
