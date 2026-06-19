import type { EmotionLabel, EmotionResult } from "./emotionClassifier";

interface TimedEmotionResult extends EmotionResult {
  timestamp: number;
}

const labels: EmotionLabel[] = ["happy", "sad_tendency", "angry_tendency", "surprised", "calm", "unknown"];

export class EmotionSmoother {
  private samples: TimedEmotionResult[] = [];

  constructor(private readonly windowMs = 5000) {}

  push(result: EmotionResult, timestamp = Date.now()): EmotionResult {
    this.samples.push({ ...result, timestamp });
    this.samples = this.samples.filter((sample) => timestamp - sample.timestamp <= this.windowMs);
    return this.current();
  }

  current(): EmotionResult {
    if (this.samples.length === 0) {
      return { label: "unknown", confidence: 0, valence: 0, arousal: 0 };
    }

    const scoreByLabel = new Map<EmotionLabel, number>();
    for (const label of labels) scoreByLabel.set(label, 0);

    let confidenceSum = 0;
    let valenceSum = 0;
    let arousalSum = 0;

    for (const sample of this.samples) {
      scoreByLabel.set(sample.label, (scoreByLabel.get(sample.label) ?? 0) + sample.confidence);
      confidenceSum += sample.confidence;
      valenceSum += sample.valence;
      arousalSum += sample.arousal;
    }

    const [label, labelScore] = [...scoreByLabel.entries()].sort((a, b) => b[1] - a[1])[0];
    const count = this.samples.length;
    const confidence = confidenceSum === 0 ? 0 : Math.min(1, labelScore / confidenceSum);

    return {
      label,
      confidence,
      valence: valenceSum / count,
      arousal: arousalSum / count
    };
  }
}
