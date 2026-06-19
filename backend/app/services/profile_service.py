from dataclasses import dataclass
from functools import lru_cache


@dataclass
class DeliveryAddress:
    user_id: str
    name: str
    district: str | None = None
    address: str | None = None
    location: str | None = None
    detail: str | None = None


class InMemoryProfileService:
    def __init__(self) -> None:
        self._addresses: dict[str, DeliveryAddress] = {}

    def set_delivery_address(self, address: DeliveryAddress) -> DeliveryAddress:
        self._addresses[address.user_id] = address
        return address

    def get_delivery_address(self, user_id: str) -> DeliveryAddress | None:
        return self._addresses.get(user_id)


def format_delivery_address(address: DeliveryAddress) -> str:
    parts = [address.district, address.name, address.address, address.detail]
    normalized: list[str] = []
    for part in parts:
        text = (part or "").strip()
        if text and text not in normalized:
            normalized.append(text)
    return " ".join(normalized) or "默认地址"


@lru_cache
def get_profile_service() -> InMemoryProfileService:
    return InMemoryProfileService()
