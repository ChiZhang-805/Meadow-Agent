from fastapi.testclient import TestClient

from app.dependencies import get_confirmation_service, get_mock_grocery_adapter
from app.main import app
from app.services.profile_service import get_profile_service
from app.services.runtime_secrets import get_runtime_secrets
from app.settings import get_settings


def reset_in_memory_state() -> None:
    get_settings.cache_clear()
    get_mock_grocery_adapter.cache_clear()
    get_confirmation_service.cache_clear()
    get_runtime_secrets.cache_clear()
    get_profile_service.cache_clear()


def make_client() -> TestClient:
    reset_in_memory_state()
    return TestClient(app)
