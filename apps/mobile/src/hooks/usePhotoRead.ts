import type { Color } from '@chromawave/domain';
import { useCallback, useRef, useState } from 'react';

import { readPalette, type ReadOutcome } from '@/lib/readPalette';

/**
 * Reads a palette out of a captured photo.
 *
 * **Why not a live frame processor.** Vision Camera's frame processors need
 * `react-native-vision-camera-worklets`, which fails to compile against React
 * Native 0.83's prebuilt React pods — it includes `React/RCTMessageThread.h`, a
 * private header those pods do not expose. So the read happens on the frame the
 * shutter captures rather than continuously.
 *
 * The read is also exposed through a ref, not only through state. The capture
 * screen has to decide what to do the moment *both* the shutter animation and
 * this have finished, and a state value it re-read at that moment would still be
 * the previous render's.
 */
export function usePhotoRead() {
  const [colors, setColors] = useState<readonly Color[]>([]);
  const [deltaE, setDeltaE] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [reading, setReading] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef<ReadOutcome | null>(null);

  const read = useCallback(async (uri: string, colorCount = 5): Promise<ReadOutcome> => {
    setReading(true);
    setFailed(false);
    const outcome = await readPalette(uri, colorCount);
    latest.current = outcome;

    if (outcome.ok) {
      setColors(outcome.result.colors);
      setDeltaE(outcome.result.deltaE);
      setConfidence(outcome.result.confidence);
    } else {
      // A failed read used to leave the previous strip in place and return null,
      // which read as "nothing happened" rather than "that did not work".
      setFailed(true);
    }
    setReading(false);
    return outcome;
  }, []);

  const reset = useCallback(() => {
    latest.current = null;
    setColors([]);
    setDeltaE(0);
    setConfidence(0);
    setFailed(false);
  }, []);

  return { read, reset, colors, deltaE, confidence, reading, failed, latest };
}
