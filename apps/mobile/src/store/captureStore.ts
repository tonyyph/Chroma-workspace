import {
  makeColor,
  paletteSchema,
  type Color,
  type Palette,
  type PaletteSource,
} from '@chromawave/domain';
import * as Crypto from 'expo-crypto';
import { create } from 'zustand';

/**
 * The capture in flight between B1 and B2/B3.
 *
 * Route params carry strings, and a pending capture is an array of colours plus a
 * frame path — so it lives here rather than being serialised through the URL.
 * Cleared on save or discard, so a stale capture can never be committed twice.
 */
type PendingCapture = {
  colors: readonly Color[];
  photoUri: string | null;
  deltaE: number;
  confidence: number;
  source: PaletteSource;
  /**
   * The project this capture was started from, when it was started from one.
   *
   * A capture opened from a set's gap line exists *because* of that set, so the
   * id rides along with the pending capture and the save writes membership
   * without the user having to add the palette to the set afterwards.
   */
  setId: string | null;
};

/** Every capture path but the scoped one leaves `setId` off entirely. */
type BeginInput = Omit<PendingCapture, 'setId'> & { setId?: string | null };

type CaptureState = {
  pending: PendingCapture | null;
  begin: (capture: BeginInput) => void;
  /** Replaces the colours after a tune, keeping the frame and the read metrics. */
  retune: (colors: readonly Color[]) => void;
  discard: () => void;
  /** Builds a valid `Palette` from the pending capture, or null if there is none. */
  toPalette: (name: string) => Palette | null;
};

export const useCaptureStore = create<CaptureState>((set, get) => ({
  pending: null,

  begin: (capture) => set({ pending: { ...capture, setId: capture.setId ?? null } }),

  retune: (colors) =>
    set((state) => (state.pending ? { pending: { ...state.pending, colors } } : state)),

  discard: () => set({ pending: null }),

  toPalette: (name) => {
    const pending = get().pending;
    if (!pending || pending.colors.length < 2) return null;

    const now = new Date().toISOString();
    // Weights come from the extractor already summing to one, but a retune can
    // round them; normalise here so the schema's invariant always holds.
    const colors = normalise(pending.colors);

    const candidate = {
      schemaVersion: 1 as const,
      id: Crypto.randomUUID(),
      name: name.trim() || 'Untitled capture',
      createdAt: now,
      capturedAt: now,
      source: pending.source,
      colors,
      tags: [],
      location: null,
      photoUri: pending.photoUri,
      deltaE: Math.min(100, Math.max(0, pending.deltaE)),
      confidence: Math.min(1, Math.max(0, pending.confidence)),
      space: 'srgb' as const,
      tuned: false,
      // The set's own `paletteIds` stays authoritative for membership; this is
      // the palette's record of which project it was captured for.
      setIds: pending.setId ? [pending.setId] : [],
      isPinned: false,
    };

    const parsed = paletteSchema.safeParse(candidate);
    return parsed.success ? parsed.data : null;
  },
}));

/** Rescales weights to sum to one, pushing any remainder onto the dominant. */
function normalise(colors: readonly Color[]): Color[] {
  const total = colors.reduce((sum, color) => sum + color.weight, 0) || 1;
  const scaled = colors.map((color) =>
    makeColor(
      color.hex,
      Math.round((color.weight / total) * 1000) / 1000,
      color.role,
      color.locked,
    ),
  );
  const drift = 1 - scaled.reduce((sum, color) => sum + color.weight, 0);
  const first = scaled[0];
  if (first) {
    scaled[0] = { ...first, weight: Math.round((first.weight + drift) * 1000) / 1000 };
  }
  return scaled;
}
