SYSTEM_INSTRUCTIONS = """
你是 Meadow Agent，中文名叫麦豆。你是一个面向老年人的中文 AI 语音助手。
你的目标是陪伴、解释、提醒、协助买菜，但不能代替医生、律师、家属或护理人员做重大决定。

说话要求：
1. 使用简体中文。
2. 每次回复尽量不超过 80 个汉字。
3. 语速清楚、略慢但自然，比很慢的朗读稍快一点；不要拖长停顿。
4. 首次会话要明确说明：“我是麦豆，AI 语音助手。”
5. 老人没听清时，要耐心重复。
6. 涉及购买、付款、地址、个人信息、医疗建议、紧急情况时，必须复述关键信息并要求二次确认。
7. 不得在一次语音确认中直接完成付款或下单。
8. 情绪识别结果只能作为陪伴参考，不得诊断心理疾病。
9. 如果老人表达明显自伤、跌倒、急病、迷路等风险，应建议联系家属或急救。
10. 如果老人更换买菜品类，例如从土豆改成菠菜或白菜，必须重新调用 search_grocery_options，不要沿用旧候选。
""".strip()


REALTIME_TOOLS = [
    {
        "type": "function",
        "name": "search_grocery_options",
        "description": "根据老人语音中的买菜需求搜索附近可购买的候选商品或套餐；只返回候选项，不下单。",
        "parameters": {
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "quantity": {"type": "string"},
                        },
                        "required": ["name"],
                    },
                },
                "budget_cents": {"type": "integer"},
                "delivery_time": {"type": "string"},
            },
            "required": ["items"],
        },
    },
    {
        "type": "function",
        "name": "create_order_preview",
        "description": "根据候选项生成订单预览，包括商品、配送费、总价、预计送达时间；不会提交订单。",
        "parameters": {
            "type": "object",
            "properties": {"option_id": {"type": "string"}},
            "required": ["option_id"],
        },
    },
    {
        "type": "function",
        "name": "submit_order",
        "description": "提交订单。只有服务端签发 confirmation_token 后才允许调用。",
        "parameters": {
            "type": "object",
            "properties": {
                "preview_id": {"type": "string"},
                "confirmation_token": {"type": "string"},
            },
            "required": ["preview_id", "confirmation_token"],
        },
    },
]


REALTIME_TURN_DETECTION = {
    "type": "server_vad",
    "threshold": 0.6,
    "prefix_padding_ms": 300,
    "silence_duration_ms": 700,
    "create_response": True,
    "interrupt_response": False,
}


def build_realtime_session_config(model: str, voice: str) -> dict:
    return {
        "session": {
            "type": "realtime",
            "model": model,
            "instructions": SYSTEM_INSTRUCTIONS,
            "audio": {
                "input": {
                    "transcription": {
                        "model": "gpt-realtime-whisper",
                        "language": "zh",
                    },
                    "turn_detection": REALTIME_TURN_DETECTION,
                },
                "output": {"voice": voice},
            },
            "tools": REALTIME_TOOLS,
            "tool_choice": "auto",
        }
    }
