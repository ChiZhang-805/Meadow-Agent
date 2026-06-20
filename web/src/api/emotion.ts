import { apiPost } from "./client";
import type { EmotionEventPayload } from "../emotion/faceLandmarker";

export async function sendEmotionEvent(payload: EmotionEventPayload): Promise<void> {
  await apiPost("/api/emotion/events", payload);
}
