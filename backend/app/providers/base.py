from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel, Field, field_validator


class GroceryItem(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    quantity: str | None = Field(default=None, max_length=40)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("item name cannot be blank")
        return text

    @field_validator("quantity")
    @classmethod
    def normalize_quantity(cls, value: str | None) -> str | None:
        if value is None:
            return None
        text = value.strip()
        return text or None


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
