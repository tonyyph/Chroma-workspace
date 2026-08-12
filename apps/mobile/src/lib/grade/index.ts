/**
 * Rendering a grade.
 *
 * The module, not a barrel over the feature: the shader is consumed by the
 * grading screen and by anything that later exports a graded frame, and neither
 * should have to reach into a screen's folder to find it.
 */
export { GRADE_SHADER, GRADE_UNIFORM_ORDER, gradeUniforms } from './gradeShader';
