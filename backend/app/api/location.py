from typing import Any

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.services.profile_service import DeliveryAddress, InMemoryProfileService, get_profile_service
from app.services.runtime_secrets import RuntimeSecrets, get_runtime_secrets
from app.settings import Settings, get_settings

router = APIRouter(prefix="/api/location", tags=["location"])


class AddressSuggestRequest(BaseModel):
    query: str = Field(min_length=1, max_length=80)
    city: str | None = Field(default=None, max_length=40)

    @field_validator("query")
    @classmethod
    def normalize_query(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("query cannot be blank")
        return text

    @field_validator("city")
    @classmethod
    def normalize_city(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None


class AddressSuggestion(BaseModel):
    id: str | None = None
    name: str
    district: str | None = None
    address: str | None = None
    location: str | None = None
    adcode: str | None = None


class SaveAddressRequest(BaseModel):
    user_id: str | None = None
    name: str = Field(min_length=1, max_length=120)
    district: str | None = None
    address: str | None = None
    location: str | None = None
    detail: str | None = Field(default=None, max_length=120)

    @field_validator("name")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("value cannot be blank")
        return text

    @field_validator("user_id")
    @classmethod
    def normalize_user_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None

    @field_validator("district", "address", "location", "detail")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None


@router.post("/amap/address_suggestions")
async def get_amap_address_suggestions(
    payload: AddressSuggestRequest,
    x_user_id: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    runtime_secrets: RuntimeSecrets = Depends(get_runtime_secrets),
) -> dict[str, Any]:
    user_id = (x_user_id.strip() if x_user_id else "") or settings.demo_user_id
    amap_api_key = runtime_secrets.get_amap_api_key(settings, user_id=user_id)
    if not amap_api_key:
        raise HTTPException(status_code=500, detail="AMAP_API_KEY is not configured")

    params = {
        "key": amap_api_key,
        "keywords": payload.query,
        "datatype": "all",
        "output": "json",
    }
    if payload.city:
        params["city"] = payload.city

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get("https://restapi.amap.com/v3/assistant/inputtips", params=params)

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    data = response.json()
    if data.get("status") != "1":
        raise HTTPException(status_code=502, detail=data.get("info") or "AMap inputtips failed")

    tips = data.get("tips") if isinstance(data.get("tips"), list) else []
    suggestions: list[AddressSuggestion] = []
    for tip in tips:
        if not isinstance(tip, dict):
            continue
        suggestion = normalize_tip(tip)
        if suggestion.name:
            suggestions.append(suggestion)
        if len(suggestions) >= 8:
            break
    return {"suggestions": [suggestion.model_dump() for suggestion in suggestions]}


@router.post("/address")
async def save_delivery_address(
    payload: SaveAddressRequest,
    x_user_id: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    profile_service: InMemoryProfileService = Depends(get_profile_service),
) -> dict[str, Any]:
    user_id = (x_user_id.strip() if x_user_id else "") or payload.user_id or settings.demo_user_id
    address = profile_service.set_delivery_address(
        DeliveryAddress(
            user_id=user_id,
            name=payload.name,
            district=payload.district,
            address=payload.address,
            location=payload.location,
            detail=payload.detail,
        )
    )
    return {"address": address.__dict__}


def normalize_tip(tip: dict[str, Any]) -> AddressSuggestion:
    return AddressSuggestion(
        id=string_or_none(tip.get("id")),
        name=string_or_none(tip.get("name")) or "",
        district=string_or_none(tip.get("district")),
        address=string_or_none(tip.get("address")),
        location=string_or_none(tip.get("location")),
        adcode=string_or_none(tip.get("adcode")),
    )


def string_or_none(value: Any) -> str | None:
    if value is None or value == []:
        return None
    text = str(value).strip()
    return text or None
