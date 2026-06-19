export type EmotionLabel =
  | "happy"
  | "sad_tendency"
  | "angry_tendency"
  | "surprised"
  | "calm"
  | "unknown";

export interface EmotionResult {
  label: EmotionLabel;
  confidence: number;
  valence: number;
  arousal: number;
}

function avg(...xs: number[]) {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function classifyEmotion(scores: Record<string, number>): EmotionResult {
  const smile = avg(scores.mouthSmileLeft ?? 0, scores.mouthSmileRight ?? 0);
  const frown = avg(scores.mouthFrownLeft ?? 0, scores.mouthFrownRight ?? 0);
  const browDown = avg(scores.browDownLeft ?? 0, scores.browDownRight ?? 0);
  const eyeWide = avg(scores.eyeWideLeft ?? 0, scores.eyeWideRight ?? 0);
  const jawOpen = scores.jawOpen ?? 0;
  const browInnerUp = scores.browInnerUp ?? 0;

  const happyScore =
    smile * 0.8 + (scores.cheekSquintLeft ?? 0) * 0.1 + (scores.cheekSquintRight ?? 0) * 0.1;
  const sadScore = frown * 0.6 + browInnerUp * 0.4;
  const angryScore = browDown * 0.7 + avg(scores.eyeSquintLeft ?? 0, scores.eyeSquintRight ?? 0) * 0.3;
  const surprisedScore = jawOpen * 0.5 + eyeWide * 0.3 + browInnerUp * 0.2;

  const candidates: Array<[EmotionLabel, number]> = [
    ["happy", happyScore],
    ["sad_tendency", sadScore],
    ["angry_tendency", angryScore],
    ["surprised", surprisedScore]
  ];

  candidates.sort((a, b) => b[1] - a[1]);
  const [label, confidence] = candidates[0] ?? ["unknown", 0];

  if (confidence < 0.35) {
    return { label: "calm", confidence: 0.6, valence: 0, arousal: 0.2 };
  }

  const valence =
    label === "happy"
      ? 0.8
      : label === "sad_tendency"
        ? -0.6
        : label === "angry_tendency"
          ? -0.7
          : label === "surprised"
            ? 0.1
            : 0;

  const arousal = label === "sad_tendency" ? 0.4 : 0.75;

  return { label, confidence, valence, arousal };
}
