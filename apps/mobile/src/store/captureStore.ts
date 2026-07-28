import type { Palette, TrackRecommendation } from '@chromawave/domain';
import { create } from 'zustand';

export type DraftPhoto = Readonly<{
  uri: string;
  width: number;
  height: number;
  mediaType: 'image/heic' | 'image/heif' | 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'heic' | 'heif' | 'jpg' | 'png' | 'webp';
}>;

type CaptureState = {
  photo: DraftPhoto | null;
  palette: Palette | null;
  recommendations: readonly TrackRecommendation[];
  selectedRecommendation: TrackRecommendation | null;
  note: string;
  setPhoto: (photo: DraftPhoto) => void;
  setPalette: (palette: Palette) => void;
  setRecommendations: (recommendations: readonly TrackRecommendation[]) => void;
  selectRecommendation: (recommendation: TrackRecommendation) => void;
  setNote: (note: string) => void;
  reset: () => void;
};

const initialState = {
  photo: null,
  palette: null,
  recommendations: [],
  selectedRecommendation: null,
  note: '',
} as const;

export const useCaptureStore = create<CaptureState>((set) => ({
  ...initialState,
  setPhoto: (photo) => set({ ...initialState, photo }),
  setPalette: (palette) => set({ palette }),
  setRecommendations: (recommendations) => set({ recommendations }),
  selectRecommendation: (selectedRecommendation) => set({ selectedRecommendation }),
  setNote: (note) => set({ note }),
  reset: () => set(initialState),
}));
