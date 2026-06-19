import secrets
import time
from dataclasses import dataclass


@dataclass
class ConfirmationRecord:
    preview_id: str
    user_id: str
    expires_at: float
    used: bool = False


class InMemoryConfirmationService:
    def __init__(self, ttl_seconds: int = 300) -> None:
        self.ttl_seconds = ttl_seconds
        self.records: dict[str, ConfirmationRecord] = {}

    def issue(self, user_id: str, preview_id: str) -> str:
        token = secrets.token_urlsafe(32)
        self.records[token] = ConfirmationRecord(
            preview_id=preview_id,
            user_id=user_id,
            expires_at=time.time() + self.ttl_seconds,
        )
        return token

    def verify_and_consume(self, user_id: str, preview_id: str, token: str) -> bool:
        record = self.records.get(token)
        if not record or record.used:
            return False
        if record.user_id != user_id or record.preview_id != preview_id:
            return False
        if record.expires_at < time.time():
            return False
        record.used = True
        return True
