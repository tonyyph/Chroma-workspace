import type { AtmosphereReading } from './atmosphere';
import type { ChromaticMemory } from './memory';

/**
 * A memory, in motion — as a storyboard rather than as a template.
 *
 * **The motion is derived, the way the grade is.** A template would play every
 * memory at the same speed with the same cuts, which says the same thing about a
 * still lake and a lit dance floor. Here the pacing comes from the atmosphere the
 * colour already produced: a serene memory breathes, a vivid one cuts, and the
 * frame drifts further under a mood with energy in it than under one without.
 *
 * Deterministic, total and pure, on the same terms as `atmosphere` and `grading`:
 * the same memory always yields the same storyboard, it costs nothing, it runs
 * offline, and it is testable at its thresholds rather than by watching it.
 *
 * **What this is not.** It is not a video file. Nothing in the dependency set can
 * encode one, and pretending otherwise would put an export button on screen that
 * cannot work. This describes a performance the app plays; `docs` records the
 * encoder as the thing that would have to arrive before it can be written out.
 */

export const sceneKinds = ['frame', 'title', 'palette', 'atmosphere', 'track'] as const;
export type SceneKind = (typeof sceneKinds)[number];

export type Scene = Readonly<{
  kind: SceneKind;
  /** Milliseconds from the start of the performance. */
  startMs: number;
  durationMs: number;
}>;

export type Storyboard = Readonly<{
  totalMs: number;
  scenes: readonly Scene[];
  /**
   * The slow push under everything else.
   *
   * A photograph held perfectly still for thirty seconds reads as a stuck
   * screen, and one that moves briskly reads as a slideshow effect. The amount
   * comes from the atmosphere so the movement belongs to the picture.
   */
  drift: Readonly<{ fromScale: number; toScale: number; panX: number; panY: number }>;
  /** How long one breath of the colour bands takes. */
  pulseMs: number;
  /** Whether a preview is there to play under it. */
  hasAudio: boolean;
}>;

/**
 * How long a performance runs.
 *
 * A paired memory runs the length of the preview the catalogue licenses, because
 * music that stops before the picture does is what people notice. An unpaired one
 * is shorter: there is less to say, and a silent thirty seconds is a long time.
 */
const PAIRED_MS = 30_000;
const SILENT_MS = 12_000;

/** No scene shorter than this; below it a cut reads as a glitch. */
const MINIMUM_SCENE_MS = 1_200;

/** The slowest and fastest a set of bands should breathe. */
const SLOWEST_PULSE_MS = 2_600;
const FASTEST_PULSE_MS = 700;

/**
 * The share of the performance each kind of scene gets, before they are scaled
 * to fit the real duration.
 *
 * The frame is most of it on purpose: the photograph is the memory, and the
 * cards that explain it are punctuation. These are the editorial decisions of the
 * feature, stated as data so they can be argued with.
 */
const SCENE_WEIGHT: Record<SceneKind, number> = {
  frame: 3.4,
  title: 1,
  palette: 1.4,
  atmosphere: 1.1,
  track: 1.5,
};

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Which scenes this memory has anything to put in. */
function scenesFor(memory: ChromaticMemory): readonly SceneKind[] {
  const kinds: SceneKind[] = ['frame'];

  // A title card with no title is an empty card. The same for every other one:
  // a scene exists because there is something to show, never to pad a runtime.
  if (memory.personalContext.title || memory.personalContext.location) kinds.push('title');
  kinds.push('palette');
  kinds.push('atmosphere');
  if (memory.musicPairing.status === 'paired' && memory.musicPairing.selectedTrack) {
    kinds.push('track');
  }
  return kinds;
}

/**
 * The performance this memory implies.
 *
 * Total: every schema-valid memory yields a storyboard whose scenes tile its
 * whole duration with no gap and no overlap, which is the invariant the player
 * depends on and the tests assert directly.
 */
export function storyboardFor(memory: ChromaticMemory): Storyboard {
  const hasAudio =
    memory.musicPairing.status === 'paired' && memory.musicPairing.selectedTrack !== null;
  const totalMs = hasAudio ? PAIRED_MS : SILENT_MS;

  const kinds = scenesFor(memory);
  const weightTotal = kinds.reduce((sum, kind) => sum + SCENE_WEIGHT[kind], 0);

  // Laid out by accumulating starts rather than by summing rounded durations, so
  // rounding cannot open a one-millisecond hole between two scenes.
  const scenes: Scene[] = [];
  let elapsed = 0;
  kinds.forEach((kind, index) => {
    const last = index === kinds.length - 1;
    const share = (SCENE_WEIGHT[kind] / weightTotal) * totalMs;
    const durationMs = last ? totalMs - elapsed : Math.max(MINIMUM_SCENE_MS, Math.round(share));
    scenes.push({ kind, startMs: elapsed, durationMs });
    elapsed += durationMs;
  });

  return {
    totalMs,
    scenes: rebalance(scenes, totalMs),
    drift: driftFor(memory.atmosphere),
    pulseMs: pulseFor(memory.atmosphere),
    hasAudio,
  };
}

/**
 * Makes the scenes tile the duration exactly.
 *
 * The minimum-length rule can push the total past the runtime on a memory with
 * many scenes, and the last scene absorbing the difference could otherwise leave
 * it negative. Trimming from the longest scene takes the time from where it is
 * least missed.
 */
function rebalance(scenes: readonly Scene[], totalMs: number): readonly Scene[] {
  const working = scenes.map((scene) => ({ ...scene }));
  let overflow = working.reduce((sum, scene) => sum + scene.durationMs, 0) - totalMs;

  while (overflow > 0) {
    const longest = working.reduce((a, b) => (b.durationMs > a.durationMs ? b : a));
    // Every scene already at the floor means the memory cannot fit its own
    // scenes; the runtime stretches rather than the cuts becoming glitches.
    if (longest.durationMs <= MINIMUM_SCENE_MS) break;
    const take = Math.min(overflow, longest.durationMs - MINIMUM_SCENE_MS);
    longest.durationMs -= take;
    overflow -= take;
  }

  let elapsed = 0;
  return working.map((scene) => {
    const laid = { ...scene, startMs: elapsed };
    elapsed += scene.durationMs;
    return laid;
  });
}

/**
 * How far the frame drifts, from what the colour said about the moment.
 *
 * Energy is not measured directly, so it is read the way `intent` reads it: a
 * saturated, high-contrast scene has more going on than a flat pale one. The pan
 * leans toward the warm side of the frame for a warm reading, which is a bias
 * rather than a fact about composition — but a consistent one, and it beats
 * drifting the same direction for every photograph ever taken.
 */
function driftFor(atmosphere: AtmosphereReading): Storyboard['drift'] {
  const energy = clamp(atmosphere.saturation * 0.6 + atmosphere.contrast * 0.4, 0, 1);
  const amount = 0.04 + energy * 0.06;
  return {
    fromScale: 1,
    toScale: Math.round((1 + amount) * 1000) / 1000,
    panX: Math.round(atmosphere.warmth * 0.03 * 1000) / 1000,
    // Bright scenes drift up toward the light, dark ones settle.
    panY: Math.round((atmosphere.luminosity - 0.5) * -0.04 * 1000) / 1000,
  };
}

/** How long one breath of the bands takes, fastest for the liveliest reading. */
function pulseFor(atmosphere: AtmosphereReading): number {
  const energy = clamp(atmosphere.saturation * 0.5 + atmosphere.contrast * 0.5, 0, 1);
  return Math.round(SLOWEST_PULSE_MS - (SLOWEST_PULSE_MS - FASTEST_PULSE_MS) * energy);
}

/** The scene playing at a moment, or the last one at the very end. */
export function sceneAt(storyboard: Storyboard, elapsedMs: number): Scene {
  const clamped = clamp(elapsedMs, 0, storyboard.totalMs);
  const found = storyboard.scenes.find(
    (scene) => clamped >= scene.startMs && clamped < scene.startMs + scene.durationMs,
  );
  // The final millisecond belongs to the final scene rather than to nothing.
  return found ?? storyboard.scenes[storyboard.scenes.length - 1]!;
}

/** How far through its own scene a moment is, 0–1. */
export function sceneProgress(scene: Scene, elapsedMs: number): number {
  if (scene.durationMs <= 0) return 1;
  return clamp((elapsedMs - scene.startMs) / scene.durationMs, 0, 1);
}
