from dataclasses import dataclass

from app.providers.base import GroceryItem, OrderPreview


RISKY_KEYWORDS = ("药", "处方", "酒", "白酒", "啤酒", "保健品", "补品")
VAGUE_PURCHASE_PHRASES = ("随便买", "你决定", "都行", "看着办")


@dataclass(frozen=True)
class SafetyDecision:
    allowed: bool
    need_caregiver_confirm: bool = False
    reason: str | None = None


class SafetyPolicy:
    def __init__(self, single_order_limit_cents: int, daily_budget_cents: int) -> None:
        self.single_order_limit_cents = single_order_limit_cents
        self.daily_budget_cents = daily_budget_cents

    def evaluate_search_request(self, items: list[GroceryItem], utterance: str | None = None) -> SafetyDecision:
        text = " ".join([item.name for item in items] + ([utterance] if utterance else []))
        if any(keyword in text for keyword in RISKY_KEYWORDS):
            return SafetyDecision(
                allowed=False,
                need_caregiver_confirm=True,
                reason="涉及药品、酒精或保健品，MVP 不允许自动购买。",
            )
        if utterance and any(phrase in utterance for phrase in VAGUE_PURCHASE_PHRASES):
            return SafetyDecision(
                allowed=True,
                need_caregiver_confirm=False,
                reason="需求表达较模糊，只能展示候选项，不能直接下单。",
            )
        return SafetyDecision(allowed=True)

    def evaluate_order_preview(self, preview: OrderPreview, spent_today_cents: int = 0) -> SafetyDecision:
        if preview.total_cents > self.single_order_limit_cents:
            return SafetyDecision(
                allowed=True,
                need_caregiver_confirm=True,
                reason="单笔金额超过老人端免家属确认额度。",
            )
        if spent_today_cents + preview.total_cents > self.daily_budget_cents:
            return SafetyDecision(
                allowed=True,
                need_caregiver_confirm=True,
                reason="今日累计金额超过预算，需要家属确认。",
            )
        return SafetyDecision(allowed=True)

    @staticmethod
    def assert_emotion_event_is_non_diagnostic(label: str, raw_video_saved: bool) -> SafetyDecision:
        if raw_video_saved:
            return SafetyDecision(allowed=False, reason="不得保存或上传原始视频。")
        if label in {"depressed", "clinical_depression", "diagnosis"}:
            return SafetyDecision(allowed=False, reason="情绪识别不得做医学诊断。")
        return SafetyDecision(allowed=True)
