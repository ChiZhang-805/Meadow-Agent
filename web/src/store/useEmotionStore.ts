import { create } from "zustand";

import type { EmotionResult } from "../emotion/emotionClassifier";

interface EmotionState {
  current: EmotionResult;
  rawVideoSaved: false;
  update: (result: EmotionResult) => void;
}

export const useEmotionStore = create<EmotionState>((set) => ({
  current: { label: "unknown", confidence: 0, valence: 0, arousal: 0 },
  rawVideoSaved: false,
  update: (result) => set({ current: result, rawVideoSaved: false })
}));
