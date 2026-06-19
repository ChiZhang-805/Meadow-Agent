from app.services.openai_realtime import build_realtime_session_config


def test_realtime_turn_detection_does_not_interrupt_assistant_response() -> None:
    config = build_realtime_session_config(model="gpt-realtime-2", voice="marin")

    turn_detection = config["session"]["audio"]["input"]["turn_detection"]

    assert turn_detection["type"] == "server_vad"
    assert turn_detection["create_response"] is True
    assert turn_detection["interrupt_response"] is False


def test_search_grocery_tool_accepts_original_utterance() -> None:
    config = build_realtime_session_config(model="gpt-realtime-2", voice="marin")
    search_tool = next(tool for tool in config["session"]["tools"] if tool["name"] == "search_grocery_options")

    assert "utterance" in search_tool["parameters"]["properties"]
