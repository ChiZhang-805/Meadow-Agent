from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.dependencies import get_grocery_service
from app.providers.base import GroceryItem
from app.services.grocery_service import GroceryService
from app.settings import Settings, get_settings

router = APIRouter(prefix="/api/tools", tags=["tools"])


class SearchGroceryOptionsRequest(BaseModel):
    user_id: str | None = None
    items: list[GroceryItem]
    latitude: float = 31.2304
    longitude: float = 121.4737
    budget_cents: int | None = None
    utterance: str | None = None


class CreateOrderPreviewRequest(BaseModel):
    user_id: str | None = None
    option_id: str


class IssueConfirmationTokenRequest(BaseModel):
    user_id: str | None = None
    preview_id: str


class SubmitOrderRequest(BaseModel):
    user_id: str | None = None
    preview_id: str
    confirmation_token: str = Field(min_length=10)


def resolve_user_id(
    body_user_id: str | None,
    settings: Settings,
    x_user_id: str | None,
) -> str:
    return body_user_id or x_user_id or settings.demo_user_id


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
