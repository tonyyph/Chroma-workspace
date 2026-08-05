import { round, space, tint, ui } from '@chromawave/design-tokens';
import { StyleSheet, View } from 'react-native';
import { Pressable } from './Pressable';
import { Text } from './Text';

/**
 * FLOW E · TOAST · SUCCESS. A coloured rule, a title and a mono detail line
 * that carries the undo affordance. Presentation and the 2.4s dismissal are the
 * caller's job; this is the surface only.
 */
export function Toast({
  title,
  detail,
  onUndo,
  tone = 'success',
}: {
  title: string;
  detail: string;
  onUndo?: () => void;
  tone?: 'success' | 'danger';
}) {
  const accent = tone === 'success' ? ui.action.primary : ui.status.danger;
  const body = (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.toast,
        tone === 'success'
          ? { backgroundColor: ui.bg.raised, borderColor: 'rgba(124,92,255,.4)' }
          : { backgroundColor: tint.danger.backgroundColor, borderColor: tint.danger.borderColor },
      ]}
    >
      <View style={[styles.rule, { backgroundColor: accent }]} />
      <View style={styles.copy}>
        <Text variant="cardTitle">{title}</Text>
        <Text tone="tertiary" variant="monoSmall">
          {detail.toLocaleUpperCase()}
        </Text>
      </View>
    </View>
  );

  if (!onUndo) return body;
  return (
    <Pressable accessibilityLabel={`${title}. Undo`} accessibilityRole="button" onPress={onUndo}>
      {body}
    </Pressable>
  );
}

/** FLOW E · INLINE ERROR. Same anatomy as the toast, in the destructive tint. */
export function InlineError({ title, detail }: { title: string; detail: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.toast,
        { backgroundColor: tint.danger.backgroundColor, borderColor: tint.danger.borderColor },
      ]}
    >
      <View style={[styles.rule, { backgroundColor: ui.status.danger }]} />
      <View style={styles.copy}>
        <Text tone="danger" variant="cardTitle">
          {title}
        </Text>
        <Text tone="tertiary" variant="monoSmall">
          {detail.toLocaleUpperCase()}
        </Text>
      </View>
    </View>
  );
}

/**
 * FLOW E · SKELETON · CARD. Static by design: the loading motion in this system
 * is the band sweep, and the sheet is explicit that a spinner is never used.
 */
export function CardSkeleton() {
  return (
    <View accessibilityLabel="Loading" style={styles.skeleton}>
      <View style={styles.skeletonMedia} />
      <View style={styles.skeletonStrip}>
        <View style={[styles.skeletonBand, { backgroundColor: 'rgba(237,234,227,.12)' }]} />
        <View style={[styles.skeletonBand, { backgroundColor: 'rgba(237,234,227,.08)' }]} />
        <View style={[styles.skeletonBand, { backgroundColor: 'rgba(237,234,227,.05)' }]} />
      </View>
      <View style={styles.skeletonCopy}>
        <View style={[styles.skeletonLine, { width: '60%', height: 11 }]} />
        <View style={[styles.skeletonLine, { width: '35%', height: 9, opacity: 0.6 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: round.card - 2,
    padding: space.cardGap,
  },
  rule: {
    width: 8,
    height: 34,
    borderRadius: 4,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  skeleton: {
    borderRadius: round.card - 2,
    overflow: 'hidden',
    backgroundColor: ui.fill.card,
    borderWidth: 1,
    borderColor: ui.border.hairline,
  },
  skeletonMedia: {
    height: 80,
    backgroundColor: 'rgba(237,234,227,.07)',
  },
  skeletonStrip: {
    flexDirection: 'row',
    height: 8,
  },
  skeletonBand: {
    flex: 1,
  },
  skeletonCopy: {
    padding: space.sm,
    gap: space.xs,
  },
  skeletonLine: {
    borderRadius: 6,
    backgroundColor: 'rgba(237,234,227,.12)',
  },
});
