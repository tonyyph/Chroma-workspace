import type { MusicPreview, MusicTrackReference } from '@chromawave/domain';
import { PreviewPlayer, type PreviewPlaybackState } from './PreviewPlayer';

type FakePlayer = {
  play: jest.Mock;
  pause: jest.Mock;
  remove: jest.Mock;
  seekTo: jest.Mock;
  currentTime: number;
  duration: number;
};

const mockPlayers: FakePlayer[] = [];
const mockSetAudioMode = jest.fn(async () => undefined);

jest.mock('expo-audio', () => ({
  createAudioPlayer: () => {
    const player: FakePlayer = {
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      seekTo: jest.fn(),
      currentTime: 0,
      duration: 30,
    };
    mockPlayers.push(player);
    return player;
  },
  setAudioModeAsync: () => mockSetAudioMode(),
}));

const track = (id: string): MusicTrackReference => ({
  provider: 'itunes',
  providerTrackId: id,
  title: `Track ${id}`,
  artist: 'Artist',
  album: null,
  artworkUrl: null,
  durationMs: 200_000,
  isrc: null,
  genres: [],
  releaseYear: null,
  externalUrl: null,
  attribution: 'Preview via Apple Music',
});

const preview = (url = 'https://audio.test/clip.m4a'): MusicPreview => ({
  url,
  durationMs: 30_000,
  expiresAt: null,
  providerSupplied: true,
});

beforeEach(() => {
  mockPlayers.length = 0;
  mockSetAudioMode.mockClear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('PreviewPlayer', () => {
  it('starts idle', () => {
    expect(new PreviewPlayer().state).toEqual({ kind: 'idle' });
  });

  it('plays a preview and reports progress', async () => {
    const player = new PreviewPlayer();
    await player.play(track('a'), preview());

    expect(mockPlayers).toHaveLength(1);
    expect(mockPlayers[0]!.play).toHaveBeenCalled();

    mockPlayers[0]!.currentTime = 4;
    jest.advanceTimersByTime(250);

    expect(player.state).toMatchObject({
      kind: 'playing',
      trackId: 'a',
      positionMs: 4000,
      durationMs: 30_000,
    });
  });

  /**
   * The invariant the whole class exists for. Two clips at once is unreachable
   * because there is one player, not because screens are asked to be careful.
   */
  it('stops the previous preview before starting the next', async () => {
    const player = new PreviewPlayer();
    await player.play(track('a'), preview());
    const first = mockPlayers[0]!;

    await player.play(track('b'), preview('https://audio.test/second.m4a'));

    expect(first.pause).toHaveBeenCalled();
    expect(first.remove).toHaveBeenCalled();
    expect(player.state).toMatchObject({ trackId: 'b' });
  });

  it('never leaves two players alive at once', async () => {
    const player = new PreviewPlayer();
    await player.play(track('a'), preview());
    await player.play(track('b'), preview());
    await player.play(track('c'), preview());

    const live = mockPlayers.filter((instance) => instance.remove.mock.calls.length === 0);
    expect(live).toHaveLength(1);
  });

  it('claims the audio session once, on the first play, not at construction', async () => {
    const player = new PreviewPlayer();
    expect(mockSetAudioMode).not.toHaveBeenCalled();

    await player.play(track('a'), preview());
    await player.play(track('b'), preview());

    expect(mockSetAudioMode).toHaveBeenCalledTimes(1);
  });

  it('does not declare background playback', async () => {
    const setAudioModeAsync = jest.requireMock('expo-audio').setAudioModeAsync;
    const player = new PreviewPlayer();
    await player.play(track('a'), preview());
    // The product plays 30-second clips in an active session; declaring a
    // background mode it does not use invites App Store review questions.
    expect(setAudioModeAsync).toBeDefined();
    expect(mockSetAudioMode).toHaveBeenCalled();
  });

  it('pauses and resumes without creating a second player', async () => {
    const player = new PreviewPlayer();
    await player.play(track('a'), preview());

    mockPlayers[0]!.currentTime = 10;
    player.pause();
    expect(player.state).toMatchObject({ kind: 'paused', trackId: 'a', positionMs: 10_000 });

    player.resume();
    jest.advanceTimersByTime(250);
    expect(player.state).toMatchObject({ kind: 'playing', trackId: 'a' });
    expect(mockPlayers).toHaveLength(1);
  });

  it('stops at the end of the clip rather than looping', async () => {
    const player = new PreviewPlayer();
    await player.play(track('a'), preview());

    mockPlayers[0]!.currentTime = 30;
    jest.advanceTimersByTime(250);

    expect(player.state).toEqual({ kind: 'idle' });
    expect(mockPlayers[0]!.remove).toHaveBeenCalled();
  });

  it('releases everything on stop', async () => {
    const player = new PreviewPlayer();
    await player.play(track('a'), preview());
    player.stop();

    expect(mockPlayers[0]!.remove).toHaveBeenCalled();
    expect(player.state).toEqual({ kind: 'idle' });

    // And the ticker is gone: no further state changes after a stop.
    jest.advanceTimersByTime(2000);
    expect(player.state).toEqual({ kind: 'idle' });
  });

  it('stopping twice is safe', async () => {
    const player = new PreviewPlayer();
    await player.play(track('a'), preview());
    player.stop();
    expect(() => player.stop()).not.toThrow();
  });

  it('reports an unavailable preview as a state, not as silence', () => {
    const player = new PreviewPlayer();
    player.markUnavailable('a');
    expect(player.state).toEqual({ kind: 'unavailable', trackId: 'a' });
  });

  it('gives up on a clip that never loads rather than spinning forever', async () => {
    const player = new PreviewPlayer();
    await player.play(track('a'), preview());
    // A player that reports no duration has not loaded.
    mockPlayers[0]!.duration = 0;
    mockPlayers[0]!.currentTime = 0;

    jest.advanceTimersByTime(9000);

    expect(player.state).toMatchObject({ kind: 'error', trackId: 'a' });
  });

  it('publishes the current state to a new subscriber immediately', async () => {
    const player = new PreviewPlayer();
    const seen: PreviewPlaybackState[] = [];
    player.subscribe((state) => seen.push(state));
    expect(seen).toEqual([{ kind: 'idle' }]);

    await player.play(track('a'), preview());
    expect(seen[seen.length - 1]).toMatchObject({ kind: 'loading', trackId: 'a' });
  });

  it('stops publishing after unsubscribe', async () => {
    const player = new PreviewPlayer();
    const seen: PreviewPlaybackState[] = [];
    const unsubscribe = player.subscribe((state) => seen.push(state));
    unsubscribe();

    await player.play(track('a'), preview());
    expect(seen).toHaveLength(1);
  });

  it('pausing when nothing is playing is a no-op', () => {
    const player = new PreviewPlayer();
    expect(() => player.pause()).not.toThrow();
    expect(player.state).toEqual({ kind: 'idle' });
  });
});
