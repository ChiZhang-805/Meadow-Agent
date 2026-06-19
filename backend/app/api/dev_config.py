from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

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
    openai_api_key: str = Field(min_length=20)


class AMapKeyRequest(BaseModel):
    amap_api_key: str = Field(min_length=6)


@router.get("/status")
async def get_config_status(
    settings: Settings = Depends(get_settings),
    runtime_secrets: RuntimeSecrets = Depends(get_runtime_secrets),
    profile_service: InMemoryProfileService = Depends(get_profile_service),
) -> dict:
    items = build_external_config_status(settings, runtime_secrets)
    items.insert(
        2,
        RuntimeSecretStatus(
            name="地址",
            configured=profile_service.get_delivery_address(settings.demo_user_id) is not None,
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
