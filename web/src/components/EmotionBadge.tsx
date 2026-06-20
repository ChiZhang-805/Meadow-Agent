import { Camera, CameraOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { sendEmotionEvent } from "../api/emotion";
import { classifyEmotion, type EmotionResult } from "../emotion/emotionClassifier";
import {
  blendshapeScoresFromResult,
  loadFaceLandmarker,
  type EmotionEventPayload
} from "../emotion/faceLandmarker";
import { EmotionSmoother } from "../emotion/smoothing";
import { useEmotionStore } from "../store/useEmotionStore";

const labelText: Record<EmotionResult["label"], string> = {
  happy: "开心",
  sad_tendency: "可能低落",
  angry_tendency: "可能着急",
  surprised: "有点惊讶",
  calm: "平静",
  unknown: "未识别"
};

const DETECTION_INTERVAL_MS = 260;
const EVENT_INTERVAL_MS = 4000;
const SMOOTHING_WINDOW_SECONDS = 4;

type RecognitionState = "idle" | "loading" | "active" | "error";

export function EmotionBadge({ userId }: { userId: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<Awaited<ReturnType<typeof loadFaceLandmarker>> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastDetectionAtRef = useRef(0);
  const lastEventAtRef = useRef(0);
  const lastEventLabelRef = useRef("");
  const eventInFlightRef = useRef(false);
  const smootherRef = useRef(new EmotionSmoother(SMOOTHING_WINDOW_SECONDS * 1000));
  const current = useEmotionStore((state) => state.current);
  const updateEmotion = useEmotionStore((state) => state.update);
  const [state, setState] = useState<RecognitionState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    return () => stopRecognition(null);
  }, []);

  async function startRecognition() {
    if (state === "loading" || state === "active") return;
    setState("loading");
    setMessage("");
    runningRef.current = true;
    smootherRef.current = new EmotionSmoother(SMOOTHING_WINDOW_SECONDS * 1000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("video element is not ready");
      video.srcObject = stream;
      await video.play();
      await waitForVideoReady(video);

      const landmarker = await loadFaceLandmarker();
      if (!runningRef.current) {
        landmarker.close();
        return;
      }

      landmarkerRef.current = landmarker;
      setState("active");
      detectLoop();
    } catch (error) {
      stopRecognition("error");
      setMessage(error instanceof Error ? error.message : "无法开启表情识别");
    }
  }

  function stopRecognition(nextState: RecognitionState | null = "idle") {
    runningRef.current = false;

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    landmarkerRef.current?.close();
    landmarkerRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    lastDetectionAtRef.current = 0;
    lastEventAtRef.current = 0;
    lastEventLabelRef.current = "";
    eventInFlightRef.current = false;
    updateEmotion({ label: "unknown", confidence: 0, valence: 0, arousal: 0 });
    if (nextState) {
      setState(nextState);
    }
  }

  function detectLoop() {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    const now = performance.now();

    if (video && landmarker && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      if (now - lastDetectionAtRef.current >= DETECTION_INTERVAL_MS) {
        lastDetectionAtRef.current = now;
        try {
          const result = landmarker.detectForVideo(video, now);
          const scores = blendshapeScoresFromResult(result);
          const nextEmotion: EmotionResult =
            Object.keys(scores).length > 0
              ? classifyEmotion(scores)
              : { label: "unknown", confidence: 0, valence: 0, arousal: 0 };
          const smoothed = smootherRef.current.push(nextEmotion);
          updateEmotion(smoothed);
          maybeSendEmotionEvent(smoothed);
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "表情识别暂时不可用");
        }
      }
    }

    animationFrameRef.current = window.requestAnimationFrame(detectLoop);
  }

  function maybeSendEmotionEvent(emotion: EmotionResult) {
    const now = Date.now();
    const labelChanged = emotion.label !== lastEventLabelRef.current;
    const intervalReady = now - lastEventAtRef.current >= EVENT_INTERVAL_MS;
    if (eventInFlightRef.current || (!labelChanged && !intervalReady)) return;

    const payload: EmotionEventPayload = {
      user_id: userId,
      label: emotion.label,
      confidence: emotion.confidence,
      valence: emotion.valence,
      arousal: emotion.arousal,
      window_seconds: SMOOTHING_WINDOW_SECONDS,
      source: "face_blendshape",
      raw_video_saved: false
    };

    eventInFlightRef.current = true;
    lastEventAtRef.current = now;
    lastEventLabelRef.current = emotion.label;
    sendEmotionEvent(payload)
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "情绪摘要发送失败");
      })
      .finally(() => {
        eventInFlightRef.current = false;
      });
  }

  const activeLabel = state === "active" ? labelText[current.label] : stateText(state);
  const buttonLabel = state === "active" ? "停止识别" : "开启识别";

  return (
    <section className={`emotion-badge emotion-control emotion-control-${state}`} aria-label="表情识别">
      <video ref={videoRef} className="emotion-video" muted playsInline />
      <div className="emotion-control-main">
        <span>表情识别</span>
        <strong>{activeLabel}</strong>
        <small>{message || "不保存原始视频"}</small>
      </div>
      <button
        type="button"
        disabled={state === "loading"}
        onClick={state === "active" ? () => stopRecognition() : startRecognition}
      >
        {state === "active" ? <CameraOff aria-hidden="true" size={22} /> : <Camera aria-hidden="true" size={22} />}
        <span>{buttonLabel}</span>
      </button>
    </section>
  );
}

function stateText(state: RecognitionState) {
  if (state === "loading") return "开启中";
  if (state === "error") return "未开启";
  return "未开启";
}

function waitForVideoReady(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const onReady = () => {
      video.removeEventListener("loadeddata", onReady);
      resolve();
    };
    video.addEventListener("loadeddata", onReady, { once: true });
  });
}
