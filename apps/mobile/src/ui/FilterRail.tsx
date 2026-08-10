import { space } from '@chromawave/design-tokens';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSkin } from '@/providers';
import { Chip } from './Chip';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Meta, Text } from './Text';

export type FilterOption = { value: string; label: string };

export type FilterGroup = {
  id: string;
  /** The group's own eyebrow — "COLOUR MOOD", "STYLE". */
  label: string;
  options: readonly FilterOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
};

/**
 * The filter rail: one always-visible row, the rest one tap away.
 *
 * **The space problem.** Three groups of five chips is thirty-odd controls. Laid
 * out flat they are two hundred points of a phone screen spent on something the
 * user is not looking at — and a filter rail that pushes the content it filters
 * off screen is a filter rail nobody reaches. So the primary axis (the one with
 * a sensible default) stays on screen and the derived axes collapse behind a
 * disclosure that carries the count of what is on, which is the one thing a user
 * needs to know while it is shut.
 *
 * **Why chips and not a sheet.** A modal filter sheet hides the result while it
 * is being chosen, so every change costs a round trip to see what it did. In
 * place, each tap re-filters the list underneath immediately.
 */
export function FilterRail({
  primary,
  groups,
  activeCount,
  onReset,
  labels,
}: {
  /** Single-select, always visible. Omit for a rail with no default axis. */
  primary?: FilterGroup | undefined;
  /** Multi-select, revealed by the disclosure. */
  groups: readonly FilterGroup[];
  activeCount: number;
  onReset: () => void;
  labels: {
    /** The disclosure control, e.g. "FILTERS". */
    toggle: string;
    /** With a `{count}` placeholder already substituted, e.g. "3 ON". */
    active: string;
    reset: string;
    expand: string;
    collapse: string;
  };
}) {
  // Opens itself when something is already on — arriving from a deep link with a
  // mood applied and no visible reason why is worse than the space it costs.
  const skin = useSkin();
  const [expanded, setExpanded] = useState(activeCount > 0);

  return (
    <Animated.View layout={LinearTransition.duration(220)}>
      <ScrollView
        contentContainerStyle={styles.rail}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {primary?.options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            onPress={() => primary.onToggle(option.value)}
            tone={primary.selected.includes(option.value) ? 'selected' : 'default'}
          />
        ))}

        <Pressable
          accessibilityLabel={expanded ? labels.collapse : labels.expand}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((current) => !current)}
          style={[
            styles.disclosure,
            {
              borderRadius: skin.round.chip,
              borderColor: skin.ui.border.hairlineStrong,
              backgroundColor: skin.ui.fill.chip,
            },
            activeCount > 0 && {
              backgroundColor: skin.tint.pro.backgroundColor,
              borderColor: skin.tint.pro.borderColor,
            },
          ]}
        >
          <Icon
            color={activeCount > 0 ? skin.tint.pro.color : skin.ui.text.secondary}
            name={expanded ? 'collapse' : 'filter'}
            scale="inline"
          />
          <Text
            style={{ color: activeCount > 0 ? skin.tint.pro.color : skin.ui.text.secondary }}
            variant="chip"
          >
            {activeCount > 0 ? labels.active : labels.toggle}
          </Text>
        </Pressable>
      </ScrollView>

      {expanded ? (
        <Animated.View
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={[
            styles.panel,
            {
              borderRadius: skin.round.card,
              borderColor: skin.ui.border.hairline,
              backgroundColor: skin.ui.fill.chipGhost,
            },
          ]}
        >
          {groups.map((group) => (
            <View key={group.id} style={styles.group}>
              <Meta tone="quaternary">{group.label}</Meta>
              <View style={styles.groupChips}>
                {group.options.map((option) => (
                  <Chip
                    key={option.value}
                    label={option.label}
                    onPress={() => group.onToggle(option.value)}
                    tone={group.selected.includes(option.value) ? 'selected' : 'default'}
                  />
                ))}
              </View>
            </View>
          ))}

          {activeCount > 0 ? (
            <Pressable
              accessibilityLabel={labels.reset}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onReset}
              style={styles.reset}
            >
              <Icon color={skin.ui.status.dangerText} name="close" scale="inline" />
              <Text style={{ color: skin.ui.status.dangerText }} variant="chip">
                {labels.reset}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  rail: {
    paddingHorizontal: space.gutter,
    paddingVertical: space.sm,
    gap: space.xs,
    alignItems: 'center',
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 13,
    borderWidth: 1,
  },
  panel: {
    marginHorizontal: space.gutter,
    marginBottom: space.gutter,
    padding: space.cardGap,
    borderWidth: 1,
    gap: space.sm,
  },
  group: {
    gap: space.xs,
  },
  groupChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingTop: 2,
  },
});
