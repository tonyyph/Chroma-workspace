import { resolveGrade, type Grade } from '@cw/domain';
import {
  Canvas,
  Fill,
  ImageShader,
  Shader,
  Skia,
  useImage,
  type SkImage,
} from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GRADE_SHADER, gradeUniforms } from '@/lib/grade';

/**
 * Compiled once for the whole app, not once per canvas.
 *
 * The source is a constant, and a `RuntimeEffect` is immutable and safe to share
 * across canvases. It used to be memoised per component, which was fine when the
 * only canvas was the hero preview — the look grid then puts six more on the same
 * screen, and compiling the same SkSL seven times on every mount is seven times
 * the work for one identical result.
 */
const EFFECT = Skia.RuntimeEffect.Make(GRADE_SHADER);

/**
 * The photograph, graded, on the GPU.
 *
 * One Skia pass over the decoded frame: the image becomes a shader, the grade
 * becomes uniforms, and the runtime effect samples one and applies the other.
 * Nothing is rasterised to a file and nothing is copied through JavaScript, which
 * is what lets a slider move the whole frame at frame rate rather than after it.
 *
 * `image` is passed in rather than loaded here so the screen can tell the three
 * states apart — decoding, decoded, and failed — and say which one it is in.
 */
export function GradePreview({
  image,
  grade,
  width,
  height,
}: {
  image: SkImage;
  grade: Grade;
  width: number;
  height: number;
}) {
  const uniforms = useMemo(
    () => gradeUniforms(resolveGrade(grade), width, height),
    [grade, width, height],
  );

  // A shader that did not compile is a bug in the shipped source, not a runtime
  // condition — but drawing nothing beats taking down the screen someone is on.
  if (!EFFECT) return null;

  return (
    <Canvas style={{ width, height }}>
      <Fill>
        <Shader source={EFFECT} uniforms={uniforms}>
          {/* `cover` so the preview crops the frame the way the library card and
              the detail hero already do — a grade judged on a differently
              cropped image is a grade judged on a different picture. */}
          <ImageShader
            fit="cover"
            height={height}
            image={image}
            rect={{ x: 0, y: 0, width, height }}
            width={width}
          />
        </Shader>
      </Fill>
    </Canvas>
  );
}

export type GradeImageStatus = 'absent' | 'loading' | 'ready' | 'failed';

/**
 * Decodes the photograph for the preview.
 *
 * Returns which of four states the screen is in rather than a bare nullable:
 * "no photograph", "still opening" and "will never open" want three different
 * sentences, and a spinner that never stops is the failure this exists to
 * prevent. A palette's frame lives in the app's own storage and can be cleared
 * by the system, so failing is ordinary rather than exceptional.
 */
export function useGradeImage(uri: string | null): {
  image: SkImage | null;
  status: GradeImageStatus;
} {
  // Held per uri so a second photograph does not inherit the first one's
  // failure, and so retrying a uri that now resolves clears it.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const onError = useCallback(() => setFailedUri(uri), [uri]);

  // Skia owns the decode and its cache; a null uri yields null rather than
  // throwing. The callback is what separates "slow" from "never".
  const image = useImage(uri ?? null, onError);

  useEffect(() => {
    if (failedUri !== null && failedUri !== uri) setFailedUri(null);
  }, [failedUri, uri]);

  if (!uri) return { image: null, status: 'absent' };
  if (failedUri === uri) return { image: null, status: 'failed' };
  if (!image) return { image: null, status: 'loading' };
  return { image, status: 'ready' };
}
