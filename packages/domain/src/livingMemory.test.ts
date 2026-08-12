import { describe, expect, it } from 'vitest';
import { readAtmosphere, type AtmosphereReading } from './atmosphere';
import {
  emptyPersonalContext,
  toChromaticMemory,
  type ChromaticMemory,
  type ChromaticMemoryDraft,
} from './memory';
import { unpairedPairing, type MusicTrackReference } from './music';
import { makeColor } from './palette';
import { sceneAt, sceneProgress, storyboardFor, type SceneKind } from './livingMemory';

/**
 * A performance is judged by watching it, which is exactly why its skeleton is
 * pinned down here. Every claim below is one the player depends on — most of all
 * that the scenes tile the runtime with no gap and no overlap, because a gap is a
 * black frame in the middle of someone's memory.
 */

const colors = [
  makeColor('#7C5CFF', 0.5, 'dominant'),
  makeColor('#4A3AA8', 0.3, 'support'),
  makeColor('#22D3EE', 0.2, 'signal'),
];

const NOW = '2026-08-12T09:00:00.000Z';

const track: MusicTrackReference = {
  provider: 'itunes',
  providerTrackId: '12345',
  title: 'Nightswimming',
  artist: 'R.E.M.',
  album: 'Automatic for the People',
  artworkUrl: 'https://example.test/art.jpg',
  durationMs: 255_000,
  isrc: 'USWB19900001',
  genres: ['Alternative'],
  releaseYear: 1992,
  externalUrl: 'https://example.test/track',
  attribution: 'Preview via iTunes',
};

const memory = (overrides: Partial<ChromaticMemoryDraft> = {}): ChromaticMemory => {
  const parsed = toChromaticMemory(
    {
      image: {
        grade: null,
        localUri: 'file:///photos/a.jpg',
        width: 3000,
        height: 4000,
        source: 'photo-library',
        thumbnailUri: null,
      },
      palette: {
        colors,
        deltaE: 2.4,
        confidence: 0.94,
        space: 'srgb',
        tuned: false,
        source: 'photo',
      },
      atmosphere: readAtmosphere(colors, 2.4),
      visualAnalysis: null,
      pairing: unpairedPairing,
      personalContext: emptyPersonalContext,
      capturedAt: NOW,
      ...overrides,
    },
    { id: '11111111-1111-4111-8111-111111111111', now: NOW },
  );
  // Asserted rather than asserted-away: a broken fixture must not read as a
  // broken storyboard.
  if (!parsed.success) throw new Error(`fixture is not a valid memory: ${parsed.error.message}`);
  return parsed.data;
};

const paired = (overrides: Partial<ChromaticMemoryDraft> = {}) =>
  memory({
    pairing: { ...unpairedPairing, status: 'paired', selectedTrack: track },
    ...overrides,
  });

const kinds = (record: ChromaticMemory): readonly SceneKind[] =>
  storyboardFor(record).scenes.map((scene) => scene.kind);

describe('storyboardFor', () => {
  it('is deterministic', () => {
    expect(storyboardFor(memory())).toEqual(storyboardFor(memory()));
  });

  it('tiles its whole runtime with no gap and no overlap', () => {
    // A gap is a black frame in the middle of someone's memory.
    for (const record of [memory(), paired()]) {
      const board = storyboardFor(record);
      let expectedStart = 0;
      for (const scene of board.scenes) {
        expect(scene.startMs).toBe(expectedStart);
        expect(scene.durationMs).toBeGreaterThan(0);
        expectedStart += scene.durationMs;
      }
      expect(expectedStart).toBe(board.totalMs);
    }
  });

  it('runs the length of the preview when there is one to play', () => {
    expect(storyboardFor(paired()).totalMs).toBe(30_000);
    expect(storyboardFor(paired()).hasAudio).toBe(true);
  });

  it('runs shorter in silence — thirty quiet seconds is a long time', () => {
    const board = storyboardFor(memory());
    expect(board.totalMs).toBeLessThan(30_000);
    expect(board.hasAudio).toBe(false);
  });

  it('always opens on the photograph', () => {
    expect(kinds(memory())[0]).toBe('frame');
    expect(kinds(paired())[0]).toBe('frame');
  });

  it('plays a track card only when a track was actually chosen', () => {
    expect(kinds(memory())).not.toContain('track');
    expect(kinds(paired())).toContain('track');
  });

  it('does not show a title card with nothing on it', () => {
    expect(kinds(memory())).not.toContain('title');
    expect(
      kinds(memory({ personalContext: { ...emptyPersonalContext, title: 'Harbour dusk' } })),
    ).toContain('title');
  });

  it('shows a title card for a place, when that is all there is', () => {
    const located = memory({
      personalContext: {
        ...emptyPersonalContext,
        location: { name: 'Oslo' },
      },
    });
    expect(kinds(located)).toContain('title');
  });

  it('gives the photograph more time than any card explaining it', () => {
    const board = storyboardFor(paired());
    const frame = board.scenes.find((scene) => scene.kind === 'frame')!;
    for (const scene of board.scenes) {
      if (scene.kind !== 'frame') expect(frame.durationMs).toBeGreaterThan(scene.durationMs);
    }
  });

  it('never cuts fast enough to read as a glitch', () => {
    const busiest = paired({
      personalContext: {
        ...emptyPersonalContext,
        title: 'Harbour dusk',
        location: { name: 'Oslo' },
      },
    });
    for (const scene of storyboardFor(busiest).scenes) {
      expect(scene.durationMs).toBeGreaterThanOrEqual(1_200);
    }
  });
});

describe('the motion comes from the reading', () => {
  const withAtmosphere = (overrides: Partial<AtmosphereReading>) =>
    memory({ atmosphere: { ...readAtmosphere(colors, 2.4), ...overrides } });

  it('breathes slowly for a still scene and quickly for a lively one', () => {
    const still = storyboardFor(withAtmosphere({ saturation: 0, contrast: 0 }));
    const lively = storyboardFor(withAtmosphere({ saturation: 1, contrast: 1 }));
    expect(still.pulseMs).toBeGreaterThan(lively.pulseMs);
  });

  it('keeps every pulse inside a watchable range', () => {
    for (const saturation of [0, 0.5, 1]) {
      for (const contrast of [0, 0.5, 1]) {
        const board = storyboardFor(withAtmosphere({ saturation, contrast }));
        expect(board.pulseMs).toBeGreaterThanOrEqual(700);
        expect(board.pulseMs).toBeLessThanOrEqual(2_600);
      }
    }
  });

  it('drifts further under a scene with more going on', () => {
    const flat = storyboardFor(withAtmosphere({ saturation: 0, contrast: 0 }));
    const busy = storyboardFor(withAtmosphere({ saturation: 1, contrast: 1 }));
    expect(busy.drift.toScale).toBeGreaterThan(flat.drift.toScale);
  });

  it('always drifts, and never far enough to look like a slideshow effect', () => {
    for (const saturation of [0, 1]) {
      const board = storyboardFor(withAtmosphere({ saturation, contrast: saturation }));
      expect(board.drift.toScale).toBeGreaterThan(1);
      expect(board.drift.toScale).toBeLessThanOrEqual(1.1);
    }
  });

  it('leans the pan with the warmth of the frame', () => {
    const warm = storyboardFor(withAtmosphere({ warmth: 1 }));
    const cool = storyboardFor(withAtmosphere({ warmth: -1 }));
    expect(warm.drift.panX).toBeGreaterThan(cool.drift.panX);
  });

  it('drifts up toward the light and settles in the dark', () => {
    const bright = storyboardFor(withAtmosphere({ luminosity: 1 }));
    const dark = storyboardFor(withAtmosphere({ luminosity: 0 }));
    expect(bright.drift.panY).toBeLessThan(dark.drift.panY);
  });
});

describe('sceneAt', () => {
  const board = storyboardFor(paired());

  it('finds the scene playing at a moment', () => {
    for (const scene of board.scenes) {
      expect(sceneAt(board, scene.startMs).kind).toBe(scene.kind);
      expect(sceneAt(board, scene.startMs + scene.durationMs - 1).kind).toBe(scene.kind);
    }
  });

  it('gives the last millisecond to the last scene rather than to nothing', () => {
    const last = board.scenes[board.scenes.length - 1]!;
    expect(sceneAt(board, board.totalMs).kind).toBe(last.kind);
  });

  it('clamps rather than failing outside the runtime', () => {
    expect(sceneAt(board, -5_000).kind).toBe('frame');
    expect(sceneAt(board, 999_999).kind).toBe(board.scenes[board.scenes.length - 1]!.kind);
  });
});

describe('sceneProgress', () => {
  it('runs 0 to 1 across a scene', () => {
    const scene = { kind: 'frame' as const, startMs: 1_000, durationMs: 2_000 };
    expect(sceneProgress(scene, 1_000)).toBe(0);
    expect(sceneProgress(scene, 2_000)).toBe(0.5);
    expect(sceneProgress(scene, 3_000)).toBe(1);
  });

  it('clamps outside its own scene', () => {
    const scene = { kind: 'frame' as const, startMs: 1_000, durationMs: 2_000 };
    expect(sceneProgress(scene, 0)).toBe(0);
    expect(sceneProgress(scene, 9_000)).toBe(1);
  });

  it('treats a zero-length scene as finished rather than dividing by nothing', () => {
    expect(sceneProgress({ kind: 'frame', startMs: 0, durationMs: 0 }, 0)).toBe(1);
  });
});
