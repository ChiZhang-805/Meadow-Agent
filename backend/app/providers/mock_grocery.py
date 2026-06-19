import hashlib
import secrets
from datetime import datetime, timezone

from app.providers.base import GroceryItem, GroceryOption, GroceryProvider, OrderPreview, OrderResult


class MockGroceryAdapter(GroceryProvider):
    provider_name = "mock"

    def __init__(self) -> None:
        self._options: dict[str, GroceryOption] = {}
        self._previews: dict[str, OrderPreview] = {}

    async def search_options(
        self,
        user_id: str,
        items: list[GroceryItem],
        latitude: float,
        longitude: float,
        budget_cents: int | None = None,
    ) -> list[GroceryOption]:
        if not items:
            return []

        normalized = [self._normalize_item(item) for item in items]
        item_summary = self._summarize_items(normalized)
        base_price = sum(self._estimate_item_price(item) for item in normalized)
        option_specs = [
            ("meadow-fresh", f"{item_summary}安心菜篮", "社区安心菜站", 0, 35),
            ("value-market", f"{item_summary}实惠组合", "邻里平价菜铺", -350, 45),
            ("fast-basket", f"{item_summary}加急组合", "半小时鲜菜店", 500, 25),
        ]

        options: list[GroceryOption] = []
        for slug, title, shop_name, delta, eta in option_specs:
            option_id = self._make_option_id(user_id, slug, normalized)
            price_cents = max(500, base_price + delta)
            delivery_fee_cents = 300 if price_cents < 3900 else 0
            option = GroceryOption(
                id=option_id,
                provider=self.provider_name,
                title=title,
                shop_name=shop_name,
                items=[item.model_dump() for item in normalized],
                price_cents=price_cents,
                delivery_fee_cents=delivery_fee_cents,
                eta_minutes=eta,
                raw_payload={
                    "mock": True,
                    "user_id": user_id,
                    "budget_cents": budget_cents,
                    "latitude": latitude,
                    "longitude": longitude,
                },
            )
            self._options[option_id] = option
            options.append(option)

        if budget_cents is not None:
            affordable = [opt for opt in options if opt.price_cents + opt.delivery_fee_cents <= budget_cents]
            return affordable or options[:1]

        return options

    async def create_order_preview(self, user_id: str, option_id: str) -> OrderPreview:
        option = self._options.get(option_id)
        if option is None:
            raise ValueError("option_id not found")
        if option.raw_payload.get("user_id") != user_id:
            raise PermissionError("option_id is not bound to this user")

        preview_id = f"preview_{secrets.token_urlsafe(12)}"
        preview = OrderPreview(
            preview_id=preview_id,
            provider=option.provider,
            title=option.title,
            items=option.items,
            total_cents=option.price_cents + option.delivery_fee_cents,
            delivery_fee_cents=option.delivery_fee_cents,
            eta_minutes=option.eta_minutes,
            address_masked="上海市**区**路默认地址",
            raw_payload={
                "mock": True,
                "option_id": option.id,
                "user_id": user_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        self._previews[preview_id] = preview
        return preview

    async def submit_order(self, user_id: str, preview_id: str, confirmation_token: str) -> OrderResult:
        preview = self._previews.get(preview_id)
        if preview is None:
            raise ValueError("preview_id not found")
        if preview.raw_payload.get("user_id") != user_id:
            raise PermissionError("preview_id is not bound to this user")

        order_suffix = secrets.token_hex(6)
        return OrderResult(
            order_id=f"mock_order_{order_suffix}",
            provider_order_id=f"mock_provider_{order_suffix}",
            status="submitted_mock_only",
        )

    def get_preview(self, preview_id: str) -> OrderPreview | None:
        return self._previews.get(preview_id)

    @staticmethod
    def _normalize_item(item: GroceryItem) -> GroceryItem:
        name = item.name.strip()
        quantity = item.quantity.strip() if item.quantity else "适量"
        return GroceryItem(name=name, quantity=quantity)

    @staticmethod
    def _estimate_item_price(item: GroceryItem) -> int:
        price_map = {
            "西红柿": 1200,
            "番茄": 1200,
            "鸡蛋": 1600,
            "小青菜": 900,
            "青菜": 900,
            "菠菜": 1100,
            "白菜": 650,
            "娃娃菜": 850,
            "土豆": 800,
            "牛奶": 1800,
            "苹果": 1500,
            "香蕉": 1200,
        }
        return next((price for key, price in price_map.items() if key in item.name), 1000)

    @staticmethod
    def _summarize_items(items: list[GroceryItem]) -> str:
        names = [item.name for item in items if item.name]
        if not names:
            return "家常"
        if len(names) == 1:
            return names[0]
        return "、".join(names[:2])

    @staticmethod
    def _make_option_id(user_id: str, slug: str, items: list[GroceryItem]) -> str:
        payload = "|".join([user_id, slug, *[f"{item.name}:{item.quantity}" for item in items]])
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]
        return f"{slug}_{digest}"
