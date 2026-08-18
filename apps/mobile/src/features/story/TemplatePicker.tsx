import {
  formatOf,
  STORY_TEMPLATES,
  supportsSlideCount,
  type StoryProject,
  type StoryTemplate,
  type TemplateSlot,
} from '@cw/domain';
import { space, type Skin } from '@cw/tokens';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useEntitlements, usePreferences, useSkin } from '@/providers';
import { Pressable, Text, useStyles } from '@/ui';

/**
 * Choosing a layout.
 *
 * **The thumbnail is drawn from the template's own slots.** The brief asks for a
 * preview thumbnail; a baked PNG would be a picture of what the template looked
 * like on the day someone exported it, and would quietly stop matching the first
 * time a layout changed. Drawing the slots means the preview cannot disagree
 * with the layout, because it *is* the layout.
 *
 * **One template per family is free.** `looks.ts` set that line and stated why:
 * a wall of locked chips tells someone the app is not for them, while one
 * working example tells them what the family is. A locked template still shows
 * its layout — the shape is the thing being sold, so hiding it would sell
 * nothing.
 */
export function TemplatePicker({
  project,
  onApply,
  onLocked,
}: {
  project: StoryProject;
  onApply: (template: StoryTemplate) => void;
  /** A locked family was tapped. The caller opens the paywall. */
  onLocked: (template: StoryTemplate) => void;
}) {
  const styles = useStyles(makeStyles);
  const { t } = useEntitlementsCopy();
  const { has, ready } = useEntitlements();

  const unlocked = ready && has('template_library');

  return (
    <ScrollView
      contentContainerStyle={styles.row}
      horizontal
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
    >
      {STORY_TEMPLATES.map((template) => {
        const fits = supportsSlideCount(template, project.slideCount);
        const locked = !template.free && !unlocked;

        return (
          <Pressable
            accessibilityLabel={t(`story.template.${template.family}`)}
            accessibilityRole="button"
            accessibilityState={{ disabled: !fits, selected: false }}
            key={template.family}
            // A template that cannot lay out this many slides is genuinely
            // unavailable, and saying so beats applying it and doing nothing.
            onPress={fits ? () => (locked ? onLocked(template) : onApply(template)) : null}
            style={[styles.card, !fits && styles.unavailable]}
          >
            <TemplateThumbnail project={project} template={template} />
            <Text numberOfLines={1} variant="meta">
              {t(`story.template.${template.family}`)}
            </Text>
            {locked ? (
              <Text tone="secondary" variant="meta">
                {t('story.template.locked')}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * The layout, at thumbnail size.
 *
 * Plain views rather than a Skia canvas: this is a handful of rectangles, and a
 * row of eight live canvases in a scroll view is a lot of GPU for a picker.
 */
function TemplateThumbnail({
  template,
  project,
}: {
  template: StoryTemplate;
  project: StoryProject;
}) {
  const styles = useStyles(makeStyles);
  const skin = useSkin();

  const slideCount = Math.min(Math.max(project.slideCount, template.minSlides), template.maxSlides);
  const format = formatOf(project.format);

  const slots = template.build({
    format: project.format,
    slideCount,
    palette: paletteOf(project),
    groundHex: skin.ui.bg.base,
    track: project.track,
  });

  // Only the first slide: a thumbnail of twelve slides is a grey smear.
  const first = slots.filter((slot) => slot.slide === 0);
  const scale = THUMB_WIDTH / format.slideWidth;

  return (
    <View style={[styles.thumb, { height: format.slideHeight * scale }]}>
      {first.map((slot, index) => (
        <View
          key={`${slot.kind}:${index}`}
          style={[
            styles.slot,
            colourFor(slot, skin),
            {
              left: slot.frame.x * scale,
              top: slot.frame.y * scale,
              width: slot.frame.width * scale,
              height: slot.frame.height * scale,
            },
          ]}
        />
      ))}
    </View>
  );
}

const THUMB_WIDTH = 64;

/**
 * Each slot kind reads differently, without any of them being a colour literal.
 *
 * A photo slot is the solid one, text is a rule, and a palette strip takes the
 * accent — all from the skin, so the picker looks like the app under both.
 */
const colourFor = (slot: TemplateSlot, skin: Skin) => {
  switch (slot.kind) {
    case 'photo':
      return { backgroundColor: skin.ui.bg.media };
    case 'text':
      return { backgroundColor: skin.ui.text.tertiary };
    case 'paletteStrip':
      return { backgroundColor: skin.ui.action.primary };
  }
};

const paletteOf = (project: StoryProject) => {
  const strip = project.layers.find((layer) => layer.kind === 'paletteStrip');
  return strip?.kind === 'paletteStrip' ? strip.colors : [];
};

/** `usePreferences` under a name that says why this component reads it. */
const useEntitlementsCopy = () => usePreferences();

const makeStyles = (skin: Skin) =>
  StyleSheet.create({
    row: {
      gap: space.sm,
      paddingHorizontal: space.gutter,
      paddingVertical: space.sm,
    },
    card: {
      gap: space.xs,
      width: THUMB_WIDTH,
      // 48pt minimum touch target comes from the thumbnail's own height, which
      // is always taller than that at every format.
      minHeight: 48,
    },
    unavailable: {
      opacity: 0.4,
    },
    thumb: {
      width: THUMB_WIDTH,
      backgroundColor: skin.ui.bg.sheet,
      borderRadius: skin.round.swatch,
      overflow: 'hidden',
    },
    slot: {
      position: 'absolute',
    },
  });
