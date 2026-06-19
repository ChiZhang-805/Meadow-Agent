import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type NormalizedLandmark
} from "@mediapipe/tasks-vision";

export async function loadFaceLandmarker(modelAssetPath = "/models/face_landmarker.task"): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
  );

  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath,
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false
  });
}

export function blendshapeScoresFromResult(result: FaceLandmarkerResult): Record<string, number> {
  const categories = result.faceBlendshapes?.[0]?.categories ?? [];
  return Object.fromEntries(categories.map((category) => [category.categoryName, category.score]));
}

export function firstFaceLandmarks(result: FaceLandmarkerResult): NormalizedLandmark[] {
  return result.faceLandmarks?.[0] ?? [];
}

export interface EmotionEventPayload {
  user_id: string;
  label: string;
  confidence: number;
  valence: number;
  arousal: number;
  window_seconds: number;
  source: "face_blendshape";
  raw_video_saved: false;
}
