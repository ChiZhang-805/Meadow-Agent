import pytest

from app.providers.base import GroceryItem
from app.providers.mock_grocery import MockGroceryAdapter


@pytest.mark.asyncio
async def test_mock_grocery_returns_options_and_preview() -> None:
    adapter = MockGroceryAdapter()

    options = await adapter.search_options(
        user_id="demo-user",
        items=[GroceryItem(name="西红柿", quantity="两斤"), GroceryItem(name="鸡蛋", quantity="一盒")],
        latitude=31.2304,
        longitude=121.4737,
    )

    assert len(options) == 3
    assert all(option.provider == "mock" for option in options)
    assert options[0].items[0]["name"] == "西红柿"
    assert "西红柿" in options[0].title

    preview = await adapter.create_order_preview("demo-user", options[0].id)
    assert preview.preview_id.startswith("preview_")
    assert "西红柿" in preview.title
    assert preview.total_cents == options[0].price_cents + options[0].delivery_fee_cents
    assert preview.address_masked.endswith("默认地址")


@pytest.mark.asyncio
async def test_mock_grocery_unknown_option_raises() -> None:
    adapter = MockGroceryAdapter()

    with pytest.raises(ValueError):
        await adapter.create_order_preview("demo-user", "missing")


@pytest.mark.asyncio
async def test_mock_grocery_binds_option_and_preview_to_user() -> None:
    adapter = MockGroceryAdapter()
    options = await adapter.search_options(
        user_id="user-a",
        items=[GroceryItem(name="鸡蛋", quantity="一盒")],
        latitude=31.2304,
        longitude=121.4737,
    )

    with pytest.raises(PermissionError):
        await adapter.create_order_preview("user-b", options[0].id)

    preview = await adapter.create_order_preview("user-a", options[0].id)
    with pytest.raises(PermissionError):
        await adapter.submit_order("user-b", preview.preview_id, "already-verified-by-service")
