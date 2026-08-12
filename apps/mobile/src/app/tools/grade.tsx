import { GradeScreen } from '@/features/grading/GradeScreen';

/**
 * The screen reads its own palette, unlike the other tool routes.
 *
 * They take one as a prop and render a fallback when there is none. This one has
 * a state the fallback cannot express: a palette that exists but carries no
 * photograph is not a missing palette, and "nothing to grade here" is a different
 * sentence from "we could not find that".
 */
export default function GradeRoute() {
  return <GradeScreen />;
}
