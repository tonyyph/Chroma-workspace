import { extractPaletteFromRgba, type Color } from '@chromawave/domain';
import { useCallback, useRef, useState } from 'react';
import { runOnJS } from 'react-native-reanimated';
import { useFrameOutput, type Frame } from 'react-native-vision-camera';

/** Grid the frame is reduced to before extraction. 24×24 = 576 samples. */
const GRID = 24;

/**
 * Reads a palette from the live camera feed.
 *
 * The performance gate is "live read at 30fps min on 3-year-old hardware", so the
 * frame processor does almost nothing: it subsamples the frame to a 24×24 grid on
 * the worklet thread and hands that ~2 KB array to JS. k-means then runs on 576
 * pixels rather than 12 million, which keeps extraction off the frame budget
 * entirely.
 *
 * Extraction is additionally throttled to `intervalMs`, because the read only has
 * to feel live — the design's own strip updates at a readable pace, not 30 times
 * a second.
 */
export function useLiveRead({
  enabled = true,
  intervalMs = 200,
  colorCount = 5,
}: { enabled?: boolean; intervalMs?: number; colorCount?: number } = {}) {
  const [colors, setColors] = useState<readonly Color[]>([]);
  const [deltaE, setDeltaE] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const lastRun = useRef(0);

  const ingest = useCallback(
    (flat: number[], width: number, height: number) => {
      const now = Date.now();
      if (now - lastRun.current < intervalMs) return;
      lastRun.current = now;
      try {
        const result = extractPaletteFromRgba(Uint8Array.from(flat), width, height, colorCount);
        setColors(result.colors);
        setDeltaE(result.deltaE);
        setConfidence(result.confidence);
      } catch {
        // A malformed frame is dropped rather than surfaced; the next one is 33ms away.
      }
    },
    [intervalMs, colorCount],
  );

  const frameOutput = useFrameOutput({
    // 'rgb' asks the pipeline for an RGB buffer so the worklet does no YUV maths.
    pixelFormat: 'rgb',
    onFrame(frame: Frame) {
      'worklet';
      if (!enabled) {
        frame.dispose();
        return;
      }
      try {
        if (!frame.hasPixelBuffer) {
          frame.dispose();
          return;
        }
        const buffer = new Uint8Array(frame.getPixelBuffer());
        const { width, height, bytesPerRow } = frame;
        // Four channels: 'rgb' resolves to a 4-byte-per-pixel layout on both
        // platforms; bytesPerRow is used rather than width * 4 because rows are
        // padded to an alignment boundary.
        const channels = Math.max(1, Math.floor(bytesPerRow / Math.max(1, width)));
        const flat: number[] = [];
        for (let gy = 0; gy < GRID; gy++) {
          const y = Math.min(height - 1, Math.floor(((gy + 0.5) / GRID) * height));
          for (let gx = 0; gx < GRID; gx++) {
            const x = Math.min(width - 1, Math.floor(((gx + 0.5) / GRID) * width));
            const offset = y * bytesPerRow + x * channels;
            flat.push(buffer[offset] ?? 0, buffer[offset + 1] ?? 0, buffer[offset + 2] ?? 0, 255);
          }
        }
        frame.dispose();
        runOnJS(ingest)(flat, GRID, GRID);
      } catch {
        frame.dispose();
      }
    },
  });

  return { frameOutput, colors, deltaE, confidence };
}
