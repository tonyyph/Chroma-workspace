import {
  formatOf,
  supportsSlideCount,
  type StoryElement,
  type StoryProject,
  type StoryTemplate,
  type TemplateSlot,
} from '@cw/domain';

/**
 * Putting a template's layout onto a story that already has content.
 *
 * **A template rearranges; it does not replace.** The photographs, their crops
 * and the words already written are the author's work — a template that dropped
 * them would be a destructive action wearing the word "apply". So existing
 * elements are matched to the template's slots by kind and in order, keeping
 * everything they carry, and only their *frames* change.
 *
 * **What has no slot is kept, not deleted.** A story with four photographs under
 * a template with three photo slots keeps the fourth exactly where it was. It is
 * reported so the editor can say so, and undo puts everything back anyway — but
 * silently deleting someone's photograph because a layout had no room for it is
 * not something undo should have to rescue them from.
 *
 * **Slots with nothing to fill them are dropped.** A template's text slot is a
 * request for words; with no words to put there it would export as an empty
 * rectangle, which is the placeholder problem `applyRecipe` already refuses.
 */

export type TemplateApplication = Readonly<{
  project: StoryProject;
  /** Elements the template had no slot for. Kept, not removed. */
  unplaced: number;
  /** Slots with nothing to fill them. Dropped. */
  unfilled: number;
}>;

export function applyTemplate(
  project: StoryProject,
  template: StoryTemplate,
  input: { groundHex: string; now: string; nextId: () => string },
): TemplateApplication {
  if (!supportsSlideCount(template, project.slideCount)) {
    return { project, unplaced: 0, unfilled: 0 };
  }

  const slots = template.build({
    format: project.format,
    slideCount: project.slideCount,
    palette: firstPalette(project),
    groundHex: input.groundHex,
    track: project.track,
  });

  // Queues per kind: the template asks for "a photograph here", and the answer
  // is the next photograph the story has, in the order the author arranged them.
  const photos = project.layers.filter((layer) => layer.kind === 'photo');
  const texts = project.layers.filter((layer) => layer.kind === 'text');
  const strips = project.layers.filter((layer) => layer.kind === 'paletteStrip');

  const placed = new Set<string>();
  const layers: StoryElement[] = [];
  let unfilled = 0;

  let photoIndex = 0;
  let textIndex = 0;
  let stripIndex = 0;

  for (const slot of slots) {
    switch (slot.kind) {
      case 'photo': {
        const existing = photos[photoIndex];
        photoIndex += 1;
        if (existing === undefined) {
          unfilled += 1;
          break;
        }
        placed.add(existing.id);
        // Frame only: the crop, the focal point and the mask are the author's.
        layers.push({ ...existing, frame: slot.frame });
        break;
      }

      case 'text': {
        const existing = texts[textIndex];
        textIndex += 1;
        if (existing === undefined) {
          // A request for words with no words to answer it.
          unfilled += 1;
          break;
        }
        placed.add(existing.id);
        layers.push({
          ...existing,
          frame: slot.frame,
          role: slot.role,
          align: slot.align,
          colorHex: slot.colorHex,
        });
        break;
      }

      case 'paletteStrip': {
        const existing = strips[stripIndex];
        stripIndex += 1;
        if (existing === undefined) {
          // Unlike text, a palette slot can be filled from the story itself —
          // the colours are already in the document, so there is nothing to
          // invent and nothing to leave blank.
          layers.push(stripFrom(slot, input.nextId()));
          break;
        }
        placed.add(existing.id);
        layers.push({
          ...existing,
          frame: slot.frame,
          orientation: slot.orientation,
          weighted: slot.weighted,
        });
        break;
      }
    }
  }

  // Anything the template had no slot for, kept in its original order and at its
  // original position, behind what the template placed.
  const leftovers = project.layers.filter((layer) => !placed.has(layer.id));

  return {
    project: { ...project, layers: [...leftovers, ...layers], updatedAt: input.now },
    unplaced: leftovers.length,
    unfilled,
  };
}

/**
 * The palette a template should consume.
 *
 * The first strip's colours, because those came from a memory the author chose.
 * With no strip there is nothing measured to hand over, and the template is
 * given an empty palette rather than an invented one — its palette slots then
 * have nothing to draw and are simply absent.
 */
function firstPalette(project: StoryProject) {
  const strip = project.layers.find((layer) => layer.kind === 'paletteStrip');
  return strip?.kind === 'paletteStrip' ? strip.colors : [];
}

const stripFrom = (
  slot: Extract<TemplateSlot, { kind: 'paletteStrip' }>,
  id: string,
): StoryElement => ({
  kind: 'paletteStrip',
  id,
  frame: slot.frame,
  rotation: 0,
  opacity: 1,
  locked: false,
  hidden: false,
  colors: [...slot.colors],
  sourceMemoryId: null,
  orientation: slot.orientation,
  weighted: slot.weighted,
  animation: null,
});

/** Which slide a format's template slot sits on, for the picker's miniature. */
export const slideWidthOf = (project: StoryProject): number => formatOf(project.format).slideWidth;
