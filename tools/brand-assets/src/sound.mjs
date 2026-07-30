/**
 * BUILD KIT · 05 · SOUND. Four cues, synthesised rather than sourced so they are
 * reproducible and carry no licence.
 *
 *   shutter       80ms  · soft click
 *   extract-done  420ms · 3-note rise
 *   save          240ms · single tone
 *   error         180ms · low thud
 *
 * "The three-note rise maps to the three bands: violet → cyan → coral, a major
 * triad." That is C4-E4-G4 in equal temperament, the frequencies below.
 */

const SAMPLE_RATE = 44_100;

/** Equal-temperament frequencies for the triad the kit names. */
export const TRIAD = { C4: 261.626, E4: 329.628, G4: 391.995 };

/** Raised-cosine fade, so no cue starts or ends on a click. */
function envelope(index, total, attack = 0.02, release = 0.35) {
  const t = index / total;
  if (t < attack) return 0.5 - 0.5 * Math.cos((Math.PI * t) / attack);
  if (t > 1 - release) {
    const r = (t - (1 - release)) / release;
    return 0.5 + 0.5 * Math.cos(Math.PI * r);
  }
  return 1;
}

function tone({ frequency, ms, gain = 0.4, harmonics = [1], attack = 0.02, release = 0.35 }) {
  const total = Math.round((ms / 1000) * SAMPLE_RATE);
  const samples = new Float32Array(total);
  const weight = harmonics.reduce((sum, h) => sum + 1 / h, 0);
  for (let i = 0; i < total; i++) {
    const t = i / SAMPLE_RATE;
    let value = 0;
    for (const h of harmonics) value += Math.sin(2 * Math.PI * frequency * h * t) / h;
    samples[i] = (value / weight) * gain * envelope(i, total, attack, release);
  }
  return samples;
}

/** Adds `b` onto `a` starting at `offsetMs`, so notes can overlap into a chord. */
function mix(a, b, offsetMs) {
  const offset = Math.round((offsetMs / 1000) * SAMPLE_RATE);
  const out = new Float32Array(Math.max(a.length, offset + b.length));
  out.set(a);
  for (let i = 0; i < b.length; i++) {
    const target = offset + i;
    out[target] = Math.max(-1, Math.min(1, (out[target] ?? 0) + (b[i] ?? 0)));
  }
  return out;
}

/** 16-bit PCM mono WAV. */
function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    data.writeInt16LE(Math.round(clamped * 32_767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

export const sounds = {
  /** "80ms · soft click" — a short, high, fast-decaying transient. */
  shutter: () =>
    wav(
      tone({
        frequency: 1800,
        ms: 80,
        gain: 0.32,
        harmonics: [1, 2],
        attack: 0.01,
        release: 0.8,
      }),
    ),

  /**
   * "420ms · 3-note rise" — C4, E4, G4 entering 60ms apart. Each note is sized to
   * end with the cue rather than to a fixed length, so all three are still
   * ringing at 420ms and the rise resolves into the triad instead of decaying to
   * whichever note happened to enter last.
   */
  'extract-done': () => {
    const TOTAL = 420;
    const entries = [
      [TRIAD.C4, 0],
      [TRIAD.E4, 60],
      [TRIAD.G4, 120],
    ];
    let track = new Float32Array(0);
    for (const [frequency, offset] of entries) {
      const note = tone({
        frequency,
        ms: TOTAL - offset,
        gain: 0.24,
        harmonics: [1, 2, 3],
        attack: 0.06,
        // A short release keeps every note audible at the final sample.
        release: 0.22,
      });
      track = mix(track, note, offset);
    }
    return wav(track.subarray(0, Math.round((TOTAL / 1000) * SAMPLE_RATE)));
  },

  /** "240ms · single tone" — the root of the triad alone. */
  save: () =>
    wav(tone({ frequency: TRIAD.C4 * 2, ms: 240, gain: 0.3, harmonics: [1, 2], release: 0.45 })),

  /** "180ms · low thud" — an octave below the root, no upper harmonics. */
  error: () => wav(tone({ frequency: TRIAD.C4 / 2, ms: 180, gain: 0.42, release: 0.55 })),
};

export const soundNames = Object.keys(sounds);

/**
 * BUILD KIT · 06 lists the cues as `.caf + .ogg`.
 *
 * CAF is produced with macOS's own `afconvert`, so no third-party encoder is
 * involved: IMA4 at 44.1kHz mono, which is the compressed format iOS decodes
 * cheapest for short UI cues. OGG needs `oggenc` or `ffmpeg`, neither of which
 * ships with macOS — see `docs/24-build-kit.md`.
 */
export const CAF_FORMAT = { dataFormat: 'ima4', channels: 1, rate: 44_100 };
