# 11 · Motion and audio system

## Motion grammar

Motion exists to explain one transformation and nothing else:

```
photograph → colour → atmosphere → music → memory
```

If an animation does not advance that sentence, it is decoration and does not
ship. The existing system (`ui/Loops.tsx`, `ui/Sequences.tsx`,
`ui/HeroTransition.tsx`, `duration` tokens) is the substrate; this adds four
motions and removes none.

### The four

**1. Extraction reveal** — colour leaves the photograph.
On analysis, the palette ribbon draws from the photograph's foot: each band
widens from zero to its true weight, staggered by weight order (dominant first).
The photograph does not move. Duration `duration.enter`; stagger 40ms.
_Reads as:_ the colour was always in the image.

**2. Ribbon → waveform** — colour becomes sound.
On entering pairing, the ribbon's bands lean: each band's top edge displaces
vertically by a value derived from the _intent's_ energy, forming a coarse
waveform silhouette while keeping every band's colour and width. It is not audio
data and is never labelled as such — it is the brand's abstract mark for
"this colour became this music", and `10` requires that distinction be honest.
Reversible; reverses on back.

**3. Artwork from the field** — the match arrives.
Album art scales up from the memory's chromatic field with the artwork's own
dominant colour bleeding into the field's stops for the first 300ms, then
settling. Chroma only; Swiss cuts, because a printed plate does not fade in.

**4. Ribbon as playhead** — sound moves through colour.
During playback a `progressFill` overlay sweeps the ribbon left to right across
the preview's duration. Chroma: a soft luminance lift over the bands. Swiss: a
hard-edged fill on a separate rule below the specimen strip.
This is **real data** — `currentTime / duration` from the player — and is the one
place the product draws a value from audio. Honest by construction.

### Hero transitions

`HeroOverlay` + `heroStore` already fly a palette from a card into the screen it
opens. Extended to memories, unchanged in mechanism.

`archive/25 §8` flags the computed landing position as the highest-risk unseen
item in the repository. It is verified on device **before** any new motion is
built on it (`14`). Jest mocks Reanimated; a worklet bug is structurally
invisible to the test suite, and one already reached device once
(`deea9e5 fix(ui): stop the backdrop worklet calling a non-worklet`).

### Rules

- Continuous loops must be seamless. `Loops.tsx` already handles this; new
  playback-linked motion follows the same pattern — no visible reset.
- Ambient drift rate responds to track energy, bounded ±20% of resting rate.
  Perceptible over ten seconds, imperceptible over one.
- **No motion delays a playback control.** Play must be pressable on the frame
  the card appears. Entrance animations never gate interaction.
- No bounce, no glow, no blocking sequence over 400ms.
- Text does not move under a finger. Layout is settled before controls are live.

### Reduce Motion

`useReducedMotion` is already used. Under it:

| Motion              | Static equivalent                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extraction reveal   | Ribbon present at full weight, cross-faded 120ms                                                                                                                        |
| Ribbon → waveform   | Waveform silhouette drawn in its final state                                                                                                                            |
| Artwork arrival     | Cross-fade                                                                                                                                                              |
| **Ribbon playhead** | **Still animates.** It is information, not decoration — a static progress bar communicates nothing. Rendered as a discrete stepped fill rather than a continuous sweep. |
| Ambient drift       | Field static at its resting composition                                                                                                                                 |

The distinction: Reduce Motion removes _decoration_, not _state_. A user who has
reduced motion still needs to know how much preview is left.

---

## Audio system

`expo-audio` is already a dependency, currently used for four UI cues
(`ExpoSoundService`). It gains a preview player. `expo-audio` wraps AVFoundation,
which is what Apple's preview assets are designed to be played with (`07`).

### Service

`infrastructure/audio/PreviewPlayer.ts`, behind a domain interface:

```ts
export interface PreviewPlaybackService {
  readonly state: PreviewPlaybackState; // observable
  play(track: MusicTrackReference, preview: MusicPreview): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  seek(ms: number): void; // only if the provider allows it
  subscribe(listener: (s: PreviewPlaybackState) => void): () => void;
}

type PreviewPlaybackState =
  | { kind: 'idle' }
  | { kind: 'loading'; trackId: string }
  | { kind: 'playing'; trackId: string; positionMs: number; durationMs: number }
  | { kind: 'paused'; trackId: string; positionMs: number; durationMs: number }
  | { kind: 'unavailable'; trackId: string; reason: PreviewUnavailableReason }
  | { kind: 'error'; trackId: string; reason: PlaybackErrorReason };
```

**One player instance for the whole app.** `play()` stops whatever is playing
before it starts anything. Two previews cannot overlap because there is only one
player — enforced in the service, not asked of screens. A test asserts a second
`play()` transitions the first track out of `playing`.

### Behaviour

| Situation                 | Behaviour                                                                               |
| ------------------------- | --------------------------------------------------------------------------------------- |
| First preview             | **Never autoplays.** Explicit "Hear it".                                                |
| After one deliberate play | Offer "auto-play as I browse"; remember (`preferences.autoPlayPreviews`, default false) |
| Move to next candidate    | Previous stops immediately, before the next request                                     |
| Screen popped             | `stop()` on unmount. Audio never outlives its screen                                    |
| App backgrounded          | Pause. **No background audio mode is declared** (`08`)                                  |
| Phone call / interruption | Pause; do not auto-resume — resuming into a conversation is worse than silence          |
| Headphones unplugged      | Pause (the platform default; honoured, not overridden)                                  |
| Preview URL 404 / expired | Re-resolve once via `getPreview`; then `unavailable`                                    |
| Provider gives no preview | `unavailable` before playback is offered — the control is never a lie                   |
| Offline                   | Controls disabled with a stated reason, not a spinner                                   |
| Silent switch             | Platform default honoured                                                               |

### Audio session

Configured once, at first playback rather than at launch:

- Category: playback, **not** mixing with others by default — a 30-second preview
  should duck nothing and own the moment; it is short and user-initiated.
- Not activated until the user's first deliberate play, so the app never grabs
  the audio session for a session that includes no audio.
- Released on `stop()`.

### Loading and errors are visible

No indefinite spinner. `loading` shows a bounded indicator with an 8-second
ceiling, after which it becomes `error` with a retry. A control that cannot work
is disabled and labelled, never silently inert.

### Haptics

`HapticMoment` (`preferences.ts:97`) is a closed union by design — a screen
cannot invent a buzz. Two additions, and only two:

- `trackSelected` — the moment a pairing is chosen.
- `previewStarted` — a light tick as audio begins, so the transition from silence
  is felt as well as heard.

**No haptic on scroll, tab switch, card swipe, or plain navigation.** The BUILD
KIT rule holds, and it holds because the union has no key for those.

### Accessibility

- Every control labelled, with `accessibilityState: { selected, busy, disabled }`.
- Progress exposed as `accessibilityValue` with `now`/`max` **and** a text form
  ("18 seconds of 30").
- VoiceOver announces state changes once, not per frame.
- Playback is fully operable without hearing it: state, position and availability
  are all in the accessibility tree.
