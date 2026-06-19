from hashlib import sha256

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException

from app.services.openai_realtime import build_realtime_session_config
from app.services.runtime_secrets import RuntimeSecrets, get_runtime_secrets, is_configured_secret
from app.settings import Settings, get_settings

router = APIRouter(prefix="/api/realtime", tags=["realtime"])


def safety_identifier(user_id: str) -> str:
    return sha256(user_id.encode("utf-8")).hexdigest()


@router.post("/token")
async def create_realtime_token(
    x_user_id: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    runtime_secrets: RuntimeSecrets = Depends(get_runtime_secrets),
) -> dict:
    openai_api_key = runtime_secrets.get_openai_api_key(settings)
    if not is_configured_secret(openai_api_key):
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")

    user_id = (x_user_id.strip() if x_user_id else "") or settings.demo_user_id
    headers = {
        "Authorization": f"Bearer {openai_api_key}",
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": safety_identifier(user_id),
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/realtime/client_secrets",
            headers=headers,
            json=build_realtime_session_config(
                model=settings.openai_realtime_model,
                voice=settings.openai_realtime_voice,
            ),
        )

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    return response.json()
