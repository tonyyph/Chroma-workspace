import { space } from '@chromawave/design-tokens';
import { StyleSheet, View } from 'react-native';
import { useSkin } from '@/providers';
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
  const skin = useSkin();
  const accent = tone === 'success' ? skin.ui.action.primary : skin.ui.status.danger;
  const body = (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.toast,
        tone === 'success'
          ? { backgroundColor: skin.ui.bg.raised, borderColor: skin.tint.pro.borderColor }
          : {
              backgroundColor: skin.tint.danger.backgroundColor,
              borderColor: skin.tint.danger.borderColor,
            },
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
  const skin = useSkin();
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.toast,
        {
          backgroundColor: skin.tint.danger.backgroundColor,
          borderColor: skin.tint.danger.borderColor,
          borderRadius: skin.round.card - 2,
        },
      ]}
    >
      <View style={[styles.rule, { backgroundColor: skin.ui.status.danger }]} />
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
  const skin = useSkin();
  return (
    <View
      accessibilityLabel="Loading"
      style={[
        styles.skeleton,
        {
          borderRadius: skin.round.card,
          backgroundColor: skin.ui.fill.card,
          borderColor: skin.ui.border.hairline,
        },
      ]}
    >
      <View style={[styles.skeletonMedia, { backgroundColor: skin.ui.bg.media }]} />
      <View style={styles.skeletonStrip}>
        {/* The bands step down through the skin's own fill alphas rather than
            three hardcoded bones, which only described one ground. */}
        <View style={[styles.skeletonBand, { backgroundColor: skin.ui.fill.track }]} />
        <View style={[styles.skeletonBand, { backgroundColor: skin.ui.fill.chip }]} />
        <View style={[styles.skeletonBand, { backgroundColor: skin.ui.fill.chipGhost }]} />
      </View>
      <View style={styles.skeletonCopy}>
        <View
          style={[
            styles.skeletonLine,
            { width: '60%', height: 11, backgroundColor: skin.ui.fill.track },
          ]}
        />
        <View
          style={[
            styles.skeletonLine,
            { width: '35%', height: 9, opacity: 0.6, backgroundColor: skin.ui.fill.track },
          ]}
        />
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
    overflow: 'hidden',
    borderWidth: 1,
  },
  skeletonMedia: {
    height: 80,
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
  },
});
