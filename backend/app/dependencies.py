from functools import lru_cache

from app.providers.mock_grocery import MockGroceryAdapter
from app.services.confirmation_service import InMemoryConfirmationService
from app.services.grocery_service import GroceryService
from app.services.profile_service import get_profile_service
from app.services.safety_policy import SafetyPolicy
from app.settings import get_settings


@lru_cache
def get_mock_grocery_adapter() -> MockGroceryAdapter:
    return MockGroceryAdapter()


@lru_cache
def get_confirmation_service() -> InMemoryConfirmationService:
    settings = get_settings()
    return InMemoryConfirmationService(ttl_seconds=settings.confirmation_token_ttl_seconds)


@lru_cache
def get_safety_policy() -> SafetyPolicy:
    settings = get_settings()
    return SafetyPolicy(
        single_order_limit_cents=settings.single_order_limit_cents,
        daily_budget_cents=settings.daily_budget_cents,
    )


def get_grocery_service() -> GroceryService:
    return GroceryService(
        provider=get_mock_grocery_adapter(),
        safety_policy=get_safety_policy(),
        confirmation_service=get_confirmation_service(),
        profile_service=get_profile_service(),
    )
