import type { EmotionResult } from "../emotion/emotionClassifier";

const labelText: Record<EmotionResult["label"], string> = {
  happy: "开心",
  sad_tendency: "可能低落",
  angry_tendency: "可能着急",
  surprised: "有点惊讶",
  calm: "平静",
  unknown: "未识别"
};

export function EmotionBadge({ emotion }: { emotion: EmotionResult }) {
  const confidence = Math.round(emotion.confidence * 100);

  return (
    <div className={`emotion-badge emotion-${emotion.label}`}>
      <span>{labelText[emotion.label]}</span>
      <strong>{confidence}%</strong>
    </div>
  );
}
