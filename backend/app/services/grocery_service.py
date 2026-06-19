from app.providers.base import GroceryItem, GroceryOption, OrderPreview, OrderResult
from app.providers.mock_grocery import MockGroceryAdapter
from app.services.confirmation_service import InMemoryConfirmationService
from app.services.profile_service import InMemoryProfileService, format_delivery_address
from app.services.safety_policy import SafetyPolicy


class GroceryService:
    def __init__(
        self,
        provider: MockGroceryAdapter,
        safety_policy: SafetyPolicy,
        confirmation_service: InMemoryConfirmationService,
        profile_service: InMemoryProfileService,
    ) -> None:
        self.provider = provider
        self.safety_policy = safety_policy
        self.confirmation_service = confirmation_service
        self.profile_service = profile_service

    async def search_options(
        self,
        user_id: str,
        items: list[GroceryItem],
        latitude: float,
        longitude: float,
        budget_cents: int | None = None,
        utterance: str | None = None,
    ) -> list[GroceryOption]:
        decision = self.safety_policy.evaluate_search_request(items, utterance)
        if not decision.allowed:
            raise ValueError(decision.reason or "search request rejected")
        return await self.provider.search_options(user_id, items, latitude, longitude, budget_cents)

    async def create_order_preview(self, user_id: str, option_id: str) -> OrderPreview:
        preview = await self.provider.create_order_preview(user_id, option_id)
        delivery_address = self.profile_service.get_delivery_address(user_id)
        if delivery_address is not None:
            preview.address_masked = format_delivery_address(delivery_address)
            preview.raw_payload["delivery_address"] = delivery_address.__dict__
        decision = self.safety_policy.evaluate_order_preview(preview)
        preview.need_caregiver_confirm = decision.need_caregiver_confirm
        preview.policy_reason = decision.reason
        return preview

    def issue_confirmation_token(self, user_id: str, preview_id: str) -> str:
        preview = self.provider.get_preview(preview_id)
        if preview is None:
            raise ValueError("preview_id not found")
        if preview.raw_payload.get("user_id") != user_id:
            raise PermissionError("preview_id is not bound to this user")
        return self.confirmation_service.issue(user_id, preview_id)

    async def submit_order(self, user_id: str, preview_id: str, confirmation_token: str) -> OrderResult:
        valid = self.confirmation_service.verify_and_consume(user_id, preview_id, confirmation_token)
        if not valid:
            raise PermissionError("confirmation_token is invalid, expired, used, or not bound to this preview")
        return await self.provider.submit_order(user_id, preview_id, confirmation_token)
