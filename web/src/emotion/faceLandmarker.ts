import {
  FaceLandmarker,
  FilesetResolver,
  type FaceLandmarkerResult,
  type NormalizedLandmark
} from "@mediapipe/tasks-vision";

const DEFAULT_FACE_LANDMARKER_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

export async function loadFaceLandmarker(modelAssetPath = DEFAULT_FACE_LANDMARKER_MODEL): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
  );

  try {
    return await createFaceLandmarker(vision, modelAssetPath, "GPU");
  } catch {
    return createFaceLandmarker(vision, modelAssetPath, "CPU");
  }
}

function createFaceLandmarker(
  vision: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  modelAssetPath: string,
  delegate: "GPU" | "CPU"
) {
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath,
      delegate
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
