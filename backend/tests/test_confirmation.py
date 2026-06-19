import time

from app.services.confirmation_service import InMemoryConfirmationService


def test_confirmation_token_is_one_time() -> None:
    service = InMemoryConfirmationService(ttl_seconds=300)
    token = service.issue("user-1", "preview-1")

    assert service.verify_and_consume("user-1", "preview-1", token)
    assert not service.verify_and_consume("user-1", "preview-1", token)


def test_confirmation_token_expires() -> None:
    service = InMemoryConfirmationService(ttl_seconds=-1)
    token = service.issue("user-1", "preview-1")

    time.sleep(0.01)
    assert not service.verify_and_consume("user-1", "preview-1", token)


def test_confirmation_token_binds_user_and_preview() -> None:
    service = InMemoryConfirmationService(ttl_seconds=300)
    token = service.issue("user-1", "preview-1")

    assert not service.verify_and_consume("user-2", "preview-1", token)
    assert not service.verify_and_consume("user-1", "preview-2", token)
    assert service.verify_and_consume("user-1", "preview-1", token)
