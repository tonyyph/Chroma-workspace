import { type CompositionProposal, type Rejection } from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import { StyleSheet, View } from 'react-native';
import { usePreferences } from '@/providers';
import { Button, Text, useStyles } from '@/ui';

/**
 * A composition proposal, shown before anything is applied.
 *
 * **A proposal, not an action.** `05-ai-director-adr.md` requires the result to
 * be previewable, acceptable, discardable and undoable, and the plainest way to
 * honour that is a panel that changes nothing until someone presses Apply.
 *
 * **It says where the suggestion came from.** No provider is configured, so this
 * is the app's own deterministic composer reading colours already measured — and
 * the copy says exactly that rather than implying a service was consulted. The
 * day a provider exists, this line changes and stays true.
 */
export function ComposePanel({
  proposal,
  rejectedCount,
  onApply,
  onDiscard,
}: {
  proposal: CompositionProposal | null;
  /** How many parts of the proposal the validator refused. */
  rejectedCount: number;
  onApply: () => void;
  onDiscard: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { t } = usePreferences();

  if (proposal === null) return null;

  if (proposal.reasons.length === 0) {
    return (
      <View style={styles.panel}>
        <Text tone="secondary" variant="meta">
          {t('story.compose.nothing')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      {/* Structured reasons rather than prose: they translate as templates, they
          render as a list, and none of them needed a language model. */}
      {proposal.reasons.map((reason) => (
        <Text key={`${reason.kind}:${reason.subjectId ?? ''}`} variant="meta">
          {t(`story.reason.${reason.kind}`)}
        </Text>
      ))}

      {rejectedCount === 0 ? null : (
        <Text tone="danger" variant="meta">
          {t('story.compose.rejected', { count: rejectedCount })}
        </Text>
      )}

      <Text tone="secondary" variant="meta">
        {t('story.compose.local')}
      </Text>

      <View style={styles.actions}>
        <Button label={t('story.compose.apply')} onPress={onApply} />
        <Button label={t('story.compose.discard')} onPress={onDiscard} variant="ghost" />
      </View>
    </View>
  );
}

/** Counts what a validator refused, for the line above. */
export const countRejections = (rejected: readonly Rejection[]): number => rejected.length;

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    panel: {
      gap: space.xs,
      paddingHorizontal: space.gutter,
      paddingVertical: space.sm,
      borderTopWidth: skin.chrome.rules ? StyleSheet.hairlineWidth : 0,
      borderTopColor: skin.ui.border.hairline,
    },
    actions: {
      flexDirection: 'row',
      gap: space.xs,
      paddingTop: space.xs,
    },
  });
