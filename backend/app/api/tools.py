from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.dependencies import get_grocery_service
from app.providers.base import GroceryItem
from app.services.grocery_service import GroceryService
from app.settings import Settings, get_settings

router = APIRouter(prefix="/api/tools", tags=["tools"])


class UserScopedRequest(BaseModel):
    user_id: str | None = Field(default=None, max_length=120)

    @field_validator("user_id")
    @classmethod
    def normalize_user_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None


class SearchGroceryOptionsRequest(UserScopedRequest):
    items: list[GroceryItem] = Field(min_length=1, max_length=12)
    latitude: float = Field(default=31.2304, ge=-90, le=90)
    longitude: float = Field(default=121.4737, ge=-180, le=180)
    budget_cents: int | None = Field(default=None, ge=0)
    utterance: str | None = Field(default=None, max_length=600)

    @field_validator("utterance")
    @classmethod
    def normalize_utterance(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None


class CreateOrderPreviewRequest(UserScopedRequest):
    option_id: str = Field(min_length=1, max_length=160)

    @field_validator("option_id")
    @classmethod
    def normalize_option_id(cls, value: str) -> str:
        return require_text(value, "option_id")


class IssueConfirmationTokenRequest(UserScopedRequest):
    preview_id: str = Field(min_length=1, max_length=160)

    @field_validator("preview_id")
    @classmethod
    def normalize_preview_id(cls, value: str) -> str:
        return require_text(value, "preview_id")


class SubmitOrderRequest(UserScopedRequest):
    preview_id: str = Field(min_length=1, max_length=160)
    confirmation_token: str = Field(min_length=10, max_length=256)

    @field_validator("preview_id", "confirmation_token")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return require_text(value, "value")


def require_text(value: str, field_name: str) -> str:
    text = value.strip()
    if not text:
        raise ValueError(f"{field_name} cannot be blank")
    return text


def resolve_user_id(
    body_user_id: str | None,
    settings: Settings,
    x_user_id: str | None,
) -> str:
    header_user_id = x_user_id.strip() if x_user_id else ""
    return header_user_id or body_user_id or settings.demo_user_id


@router.post("/search_grocery_options")
async def search_grocery_options(
    payload: SearchGroceryOptionsRequest,
    x_user_id: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    service: GroceryService = Depends(get_grocery_service),
) -> dict[str, Any]:
    try:
        options = await service.search_options(
            user_id=resolve_user_id(payload.user_id, settings, x_user_id),
            items=payload.items,
            latitude=payload.latitude,
            longitude=payload.longitude,
            budget_cents=payload.budget_cents,
            utterance=payload.utterance,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"options": [option.model_dump() for option in options]}


@router.post("/create_order_preview")
async def create_order_preview(
    payload: CreateOrderPreviewRequest,
    x_user_id: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    service: GroceryService = Depends(get_grocery_service),
) -> dict[str, Any]:
    try:
        preview = await service.create_order_preview(
            user_id=resolve_user_id(payload.user_id, settings, x_user_id),
            option_id=payload.option_id,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"preview": preview.model_dump()}


@router.post("/issue_confirmation_token")
async def issue_confirmation_token(
    payload: IssueConfirmationTokenRequest,
    x_user_id: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    service: GroceryService = Depends(get_grocery_service),
) -> dict[str, Any]:
    try:
        token = service.issue_confirmation_token(
            user_id=resolve_user_id(payload.user_id, settings, x_user_id),
            preview_id=payload.preview_id,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"confirmation_token": token, "token_type": "one_time", "expires_in_seconds": settings.confirmation_token_ttl_seconds}


@router.post("/submit_order")
async def submit_order(
    payload: SubmitOrderRequest,
    x_user_id: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
    service: GroceryService = Depends(get_grocery_service),
) -> dict[str, Any]:
    try:
        result = await service.submit_order(
            user_id=resolve_user_id(payload.user_id, settings, x_user_id),
            preview_id=payload.preview_id,
            confirmation_token=payload.confirmation_token,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"order": result.model_dump()}
