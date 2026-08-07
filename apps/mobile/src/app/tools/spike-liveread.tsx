import { round, space, ui } from '@chromawave/design-tokens';
import { extractPaletteFromRgba } from '@chromawave/domain';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  usePhotoOutput,
  type CameraRef,
} from 'react-native-vision-camera';
import { Button, Card, Meta, Screen, Text } from '@/ui';

/**
 * THROUGHPUT PROBE — not a product screen. Delete before release.
 *
 * The live read cannot use a Vision Camera frame processor: the worklets package
 * includes `React/RCTMessageThread.h`, a private header RN 0.83's prebuilt React
 * pods do not expose (see `hooks/usePhotoRead.ts`). This measures the alternative
 * path, which needs no new dependency:
 *
 *   CameraRef.takeSnapshot()  →  Image.resizeAsync()  →  Image.toRawPixelDataAsync()
 *   →  swizzle to RGBA  →  extractPaletteFromRgba()
 *
 * `takeSnapshot` comes from `PreviewViewMethods`, which `CameraRef` extends, and
 * returns a `react-native-nitro-image` `Image` — a dependency the app already
 * carries and currently never imports.
 *
 * Reachable only by typing the path; nothing links here, and it is inert outside
 * __DEV__. Run it on a physical device: a simulator's camera is a static image
 * and its timings mean nothing.
 */

/** Both candidate grids, measured side by side. */
const GRIDS = [96, 128] as const;

/** Stop after whichever comes first, so a slow device still reports. */
const RUN_MS = 8_000;
const MAX_ITERATIONS = 80;

type Stage = 'snapshot' | 'resize' | 'rawPixels' | 'swizzle' | 'extract' | 'total';
const STAGES: readonly Stage[] = ['snapshot', 'resize', 'rawPixels', 'swizzle', 'extract', 'total'];

type Report = {
  grid: number;
  iterations: number;
  elapsedMs: number;
  hz: number;
  pixelFormat: string;
  bufferBytes: number;
  sampleHex: readonly string[];
  timings: Record<Stage, { median: number; p95: number }>;
};

/**
 * Nitro returns whichever byte order the platform stores natively, so the buffer
 * has to be rewritten into the RGBA layout the extractor indexes.
 *
 * Two traps live here, and both are silent failures rather than errors:
 *
 *  · `normalizePixels` skips any pixel whose fourth byte is under 200. In the
 *    `X` formats that byte is a *skip placeholder*, not alpha, and is commonly 0
 *    — every pixel would be dropped and the extractor would throw INVALID_IMAGE
 *    on a perfectly good frame. Alpha is forced opaque for those.
 *  · The 3-byte formats have no fourth byte at all, so the length check
 *    `rgba.length < width * height * 4` would throw. They are expanded, not
 *    reinterpreted.
 */
function toRgba(source: Uint8Array, pixelCount: number, format: string): Uint8Array {
  if (format === 'RGBA') return source;

  const out = new Uint8Array(pixelCount * 4);
  const stride = format === 'RGB' || format === 'BGR' ? 3 : 4;

  // Byte offsets of red/green/blue within one pixel, and of alpha when carried.
  const layout: Record<string, readonly [number, number, number, number | null]> = {
    ARGB: [1, 2, 3, 0],
    BGRA: [2, 1, 0, 3],
    ABGR: [3, 2, 1, 0],
    XRGB: [1, 2, 3, null],
    BGRX: [2, 1, 0, null],
    XBGR: [3, 2, 1, null],
    RGBX: [0, 1, 2, null],
    RGB: [0, 1, 2, null],
    BGR: [2, 1, 0, null],
  };
  const order = layout[format];
  if (!order) throw new Error(`Unhandled pixelFormat: ${format}`);
  const [rIndex, gIndex, bIndex, aIndex] = order;

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const from = pixel * stride;
    const to = pixel * 4;
    out[to] = source[from + rIndex] ?? 0;
    out[to + 1] = source[from + gIndex] ?? 0;
    out[to + 2] = source[from + bIndex] ?? 0;
    out[to + 3] = aIndex === null ? 255 : (source[from + aIndex] ?? 255);
  }
  return out;
}

const percentile = (values: readonly number[], fraction: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return Math.round((sorted[index] ?? 0) * 100) / 100;
};

export default function LiveReadSpikeRoute() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraRef>(null);
  const device = useCameraDevice('back');
  const photoOutput = usePhotoOutput();
  const { hasPermission, requestPermission } = useCameraPermission();

  const [running, setRunning] = useState(false);
  const [reports, setReports] = useState<readonly Report[]>([]);
  const [failure, setFailure] = useState<string | null>(null);

  const probe = useCallback(
    async (grid: number): Promise<Report> => {
      const samples: Record<Stage, number[]> = {
        snapshot: [],
        resize: [],
        rawPixels: [],
        swizzle: [],
        extract: [],
        total: [],
      };
      let pixelFormat = 'unknown';
      let bufferBytes = 0;
      let sampleHex: readonly string[] = [];

      const startedAt = Date.now();
      let iterations = 0;

      while (iterations < MAX_ITERATIONS && Date.now() - startedAt < RUN_MS) {
        const top = performance.now();

        const t0 = performance.now();
        // Throws when the preview has no snapshottable contents — which is the
        // single most important thing this probe is here to find out.
        const image = await camera.current!.takeSnapshot();
        const t1 = performance.now();

        const small = await image.resizeAsync(grid, grid);
        const t2 = performance.now();

        const raw = await small.toRawPixelDataAsync();
        const t3 = performance.now();

        pixelFormat = raw.pixelFormat;
        bufferBytes = raw.buffer.byteLength;
        const rgba = toRgba(new Uint8Array(raw.buffer), raw.width * raw.height, raw.pixelFormat);
        const t4 = performance.now();

        const result = extractPaletteFromRgba(rgba, raw.width, raw.height, 5);
        const t5 = performance.now();

        sampleHex = result.colors.map((color) => color.hex);

        samples.snapshot.push(t1 - t0);
        samples.resize.push(t2 - t1);
        samples.rawPixels.push(t3 - t2);
        samples.swizzle.push(t4 - t3);
        samples.extract.push(t5 - t4);
        samples.total.push(t5 - top);
        iterations += 1;
      }

      const elapsedMs = Date.now() - startedAt;
      const timings = Object.fromEntries(
        STAGES.map((stage) => [
          stage,
          { median: percentile(samples[stage], 0.5), p95: percentile(samples[stage], 0.95) },
        ]),
      ) as Report['timings'];

      return {
        grid,
        iterations,
        elapsedMs,
        hz: Math.round((iterations / (elapsedMs / 1000)) * 100) / 100,
        pixelFormat,
        bufferBytes,
        sampleHex,
        timings,
      };
    },
    [camera],
  );

  const run = useCallback(async () => {
    setRunning(true);
    setFailure(null);
    setReports([]);
    try {
      const collected: Report[] = [];
      for (const grid of GRIDS) {
        const report = await probe(grid);
        collected.push(report);
        setReports([...collected]);
        console.info(`[live-read spike] grid=${grid}`, JSON.stringify(report, null, 2));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFailure(message);
      console.info('[live-read spike] FAILED', message);
    } finally {
      setRunning(false);
    }
  }, [probe]);

  if (!__DEV__) {
    return (
      <Screen>
        <View style={styles.centred}>
          <Text variant="section">Not available</Text>
          <Button label="Back" onPress={router.back} size="xs" variant="ghost" />
        </View>
      </Screen>
    );
  }

  if (!hasPermission) {
    return (
      <Screen>
        <View style={styles.centred}>
          <Text variant="section">Camera permission needed</Text>
          <Button label="Grant" onPress={() => void requestPermission()} size="xs" />
          <Button label="Back" onPress={router.back} size="xs" variant="ghost" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={[styles.head, { paddingTop: insets.top + space.sm }]}>
        <Text variant="section">Live read throughput</Text>
        <Meta>Physical device only · point at a colourful scene</Meta>
      </View>

      <View style={styles.preview}>
        {device ? (
          <Camera
            device={device}
            isActive
            outputs={[photoOutput]}
            ref={camera}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={styles.centred}>
            <Meta>No camera device</Meta>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <Button
          disabled={running || !device}
          label={running ? 'Running…' : 'Run probe'}
          onPress={() => void run()}
          size="lg"
        />
        <Button label="Back" onPress={router.back} size="xs" variant="ghost" />
      </View>

      {failure ? (
        <View style={styles.body}>
          <Card style={styles.report}>
            <Text tone="danger" variant="rowTitle">
              takeSnapshot path failed
            </Text>
            <Text tone="secondary" variant="monoSmall">
              {failure}
            </Text>
          </Card>
        </View>
      ) : null}

      {reports.map((report) => (
        <View key={report.grid} style={styles.body}>
          <Card style={styles.report}>
            <View style={styles.reportHead}>
              <Text variant="rowTitle">{`grid ${report.grid}×${report.grid}`}</Text>
              <Meta tone={report.hz >= 4 ? 'info' : 'tertiary'}>{`${report.hz} Hz`}</Meta>
            </View>
            <Text tone="secondary" variant="monoSmall">
              {`${report.iterations} reads in ${report.elapsedMs}ms · ${report.pixelFormat} · ${report.bufferBytes}B`}
            </Text>
            <View style={styles.table}>
              {STAGES.map((stage) => (
                <View key={stage} style={styles.tableRow}>
                  <Text style={styles.stage} tone="secondary" variant="monoSmall">
                    {stage}
                  </Text>
                  <Text
                    style={styles.number}
                    tone={stage === 'total' ? 'primary' : 'tertiary'}
                    variant="monoSmall"
                  >
                    {`${report.timings[stage].median}`}
                  </Text>
                  <Text style={styles.number} tone="tertiary" variant="monoSmall">
                    {`${report.timings[stage].p95}`}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.swatches}>
              {report.sampleHex.map((hex) => (
                <View key={hex} style={[styles.swatch, { backgroundColor: hex }]} />
              ))}
            </View>
          </Card>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centred: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: space.sm },
  head: { paddingHorizontal: space.gutter, gap: 4 },
  preview: {
    height: 220,
    marginHorizontal: space.gutter,
    marginTop: space.md,
    borderRadius: round.media,
    backgroundColor: ui.bg.media,
    overflow: 'hidden',
  },
  controls: { paddingHorizontal: space.gutter, paddingTop: space.md, gap: space.xs },
  body: { paddingHorizontal: space.gutter, paddingTop: space.cardGap },
  report: { gap: space.xs },
  reportHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  table: { paddingTop: space.xs, gap: 3 },
  tableRow: { flexDirection: 'row', alignItems: 'center' },
  stage: { flex: 1 },
  number: { width: 64, textAlign: 'right' },
  swatches: { flexDirection: 'row', gap: 4, paddingTop: space.xs },
  swatch: { flex: 1, height: 24, borderRadius: 6 },
});
