from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services.profile_service import InMemoryProfileService, get_profile_service
from app.services.runtime_secrets import (
    RuntimeSecretStatus,
    RuntimeSecrets,
    build_external_config_status,
    get_runtime_secrets,
)
from app.settings import Settings, get_settings

router = APIRouter(prefix="/api/dev/config", tags=["dev-config"])


class OpenAIKeyRequest(BaseModel):
    openai_api_key: str = Field(min_length=20, max_length=300)

    @field_validator("openai_api_key")
    @classmethod
    def normalize_openai_api_key(cls, value: str) -> str:
        text = value.strip()
        if len(text) < 20:
            raise ValueError("OpenAI API key is too short")
        return text


class AMapKeyRequest(BaseModel):
    amap_api_key: str = Field(min_length=6, max_length=120)

    @field_validator("amap_api_key")
    @classmethod
    def normalize_amap_api_key(cls, value: str) -> str:
        text = value.strip()
        if len(text) < 6:
            raise ValueError("AMap API key is too short")
        return text


@router.get("/status")
async def get_config_status(
    x_user_id: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    runtime_secrets: RuntimeSecrets = Depends(get_runtime_secrets),
    profile_service: InMemoryProfileService = Depends(get_profile_service),
) -> dict:
    user_id = (x_user_id.strip() if x_user_id else "") or settings.demo_user_id
    items = build_external_config_status(settings, runtime_secrets)
    items.insert(
        2,
        RuntimeSecretStatus(
            name="地址",
            configured=profile_service.get_delivery_address(user_id) is not None,
            source="profile",
            required_for_mvp=True,
        ),
    )

    return {
        "app_env": settings.app_env,
        "items": [item.__dict__ for item in items],
    }


@router.post("/openai-api-key")
async def set_openai_api_key(
    payload: OpenAIKeyRequest,
    settings: Settings = Depends(get_settings),
    runtime_secrets: RuntimeSecrets = Depends(get_runtime_secrets),
) -> dict:
    if settings.app_env != "development":
        raise HTTPException(status_code=403, detail="Runtime secret editing is only available in development")

    api_key = payload.openai_api_key.strip()
    if not api_key.startswith("sk-"):
        raise HTTPException(status_code=400, detail="OpenAI API key should start with sk-")

    runtime_secrets.set_openai_api_key(api_key)
    return {
        "configured": True,
        "source": "runtime_memory",
    }


@router.post("/amap-api-key")
async def set_amap_api_key(
    payload: AMapKeyRequest,
    settings: Settings = Depends(get_settings),
    runtime_secrets: RuntimeSecrets = Depends(get_runtime_secrets),
) -> dict:
    if settings.app_env != "development":
        raise HTTPException(status_code=403, detail="Runtime secret editing is only available in development")

    api_key = payload.amap_api_key.strip()
    runtime_secrets.set_amap_api_key(api_key)
    return {
        "configured": True,
        "source": "runtime_memory",
    }
