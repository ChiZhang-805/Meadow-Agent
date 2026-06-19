from app.providers.base import GroceryItem, OrderPreview
from app.services.safety_policy import SafetyPolicy


def test_rejects_risky_grocery_keywords() -> None:
    policy = SafetyPolicy(single_order_limit_cents=5000, daily_budget_cents=10000)
    decision = policy.evaluate_search_request([GroceryItem(name="处方药", quantity="一盒")])

    assert not decision.allowed
    assert decision.need_caregiver_confirm
    assert "药品" in decision.reason


def test_large_preview_requires_caregiver_confirmation() -> None:
    policy = SafetyPolicy(single_order_limit_cents=5000, daily_budget_cents=10000)
    preview = OrderPreview(
        preview_id="preview-1",
        provider="mock",
        title="大额订单",
        items=[{"name": "牛奶", "quantity": "十箱"}],
        total_cents=8000,
        delivery_fee_cents=0,
        eta_minutes=45,
        address_masked="上海市**区**路默认地址",
    )

    decision = policy.evaluate_order_preview(preview)

    assert decision.allowed
    assert decision.need_caregiver_confirm
    assert "单笔金额" in decision.reason


def test_emotion_policy_rejects_raw_video_saved() -> None:
    decision = SafetyPolicy.assert_emotion_event_is_non_diagnostic("calm", raw_video_saved=True)

    assert not decision.allowed
    assert "原始视频" in decision.reason
