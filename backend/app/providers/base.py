from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field


class GroceryItem(BaseModel):
    name: str
    quantity: str | None = None


class GroceryOption(BaseModel):
    id: str
    provider: str
    title: str
    shop_name: str
    items: list[dict[str, Any]]
    price_cents: int
    delivery_fee_cents: int
    eta_minutes: int
    raw_payload: dict[str, Any] = Field(default_factory=dict)


class OrderPreview(BaseModel):
    preview_id: str
    provider: str
    title: str
    items: list[dict[str, Any]]
    total_cents: int
    delivery_fee_cents: int
    eta_minutes: int
    address_masked: str
    need_caregiver_confirm: bool = False
    policy_reason: str | None = None
    raw_payload: dict[str, Any] = Field(default_factory=dict)


class OrderResult(BaseModel):
    order_id: str
    provider_order_id: str
    status: str


class GroceryProvider(ABC):
    @abstractmethod
    async def search_options(
        self,
        user_id: str,
        items: list[GroceryItem],
        latitude: float,
        longitude: float,
        budget_cents: int | None = None,
    ) -> list[GroceryOption]:
        raise NotImplementedError

    @abstractmethod
    async def create_order_preview(self, user_id: str, option_id: str) -> OrderPreview:
        raise NotImplementedError

    @abstractmethod
    async def submit_order(self, user_id: str, preview_id: str, confirmation_token: str) -> OrderResult:
        raise NotImplementedError
