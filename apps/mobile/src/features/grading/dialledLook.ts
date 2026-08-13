import type { Grade } from '@cw/domain';

/**
 * The look the intensity dial turns down.
 *
 * Three sources, and the order between them is the whole content of this
 * function: a look the user just chose wins; failing that the grade already
 * saved on the photograph; failing that the one its colours ask for.
 *
 * **It is a named function because getting the order wrong is invisible.** An
 * earlier version resolved the base only when the slider first moved, and
 * reached for the automatic grade when it did — so touching the dial on a
 * photograph graded last week silently replaced that look with a different one,
 * and applying afterwards wrote the replacement to the record. Nothing on screen
 * said so; the picture simply changed.
 */
export const dialledLook = (chosen: Grade | null, saved: Grade | null, automatic: Grade): Grade =>
  chosen ?? saved ?? automatic;
