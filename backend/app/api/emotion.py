from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.services.safety_policy import SafetyPolicy
from app.dependencies import get_safety_policy

router = APIRouter(prefix="/api/emotion", tags=["emotion"])

EmotionLabel = Literal["happy", "sad_tendency", "angry_tendency", "surprised", "calm", "unknown"]


class EmotionEventRequest(BaseModel):
    user_id: str
    label: EmotionLabel
    confidence: float = Field(ge=0, le=1)
    valence: float = Field(ge=-1, le=1)
    arousal: float = Field(ge=0, le=1)
    window_seconds: int = Field(ge=1, le=10)
    source: Literal["face_blendshape"] = "face_blendshape"
    raw_video_saved: bool = False


@router.post("/events")
async def receive_emotion_event(
    payload: EmotionEventRequest,
    policy: SafetyPolicy = Depends(get_safety_policy),
) -> dict:
    decision = policy.assert_emotion_event_is_non_diagnostic(payload.label, payload.raw_video_saved)
    if not decision.allowed:
        raise HTTPException(status_code=400, detail=decision.reason)
    return {
        "accepted": True,
        "stored_raw_video": False,
        "received_at": datetime.now(timezone.utc).isoformat(),
    }
