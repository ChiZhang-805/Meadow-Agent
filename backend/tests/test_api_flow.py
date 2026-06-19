from tests.conftest import make_client


def test_health() -> None:
    with make_client() as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["name_cn"] == "麦豆"


def test_order_flow_requires_confirmation_token() -> None:
    with make_client() as client:
        search = client.post(
            "/api/tools/search_grocery_options",
            json={"user_id": "demo-user", "items": [{"name": "西红柿", "quantity": "两斤"}]},
        )
        assert search.status_code == 200
        option_id = search.json()["options"][0]["id"]

        preview_response = client.post(
            "/api/tools/create_order_preview",
            json={"user_id": "demo-user", "option_id": option_id},
        )
        assert preview_response.status_code == 200
        preview_id = preview_response.json()["preview"]["preview_id"]

        rejected = client.post(
            "/api/tools/submit_order",
            json={"user_id": "demo-user", "preview_id": preview_id, "confirmation_token": "bad-token-123"},
        )
        assert rejected.status_code == 403

        token_response = client.post(
            "/api/tools/issue_confirmation_token",
            json={"user_id": "demo-user", "preview_id": preview_id},
        )
        assert token_response.status_code == 200
        token = token_response.json()["confirmation_token"]

        submitted = client.post(
            "/api/tools/submit_order",
            json={"user_id": "demo-user", "preview_id": preview_id, "confirmation_token": token},
        )
        assert submitted.status_code == 200
        assert submitted.json()["order"]["status"] == "submitted_mock_only"

        reused = client.post(
            "/api/tools/submit_order",
            json={"user_id": "demo-user", "preview_id": preview_id, "confirmation_token": token},
        )
        assert reused.status_code == 403


def test_blank_grocery_item_name_is_rejected() -> None:
    with make_client() as client:
        response = client.post(
            "/api/tools/search_grocery_options",
            json={"user_id": "demo-user", "items": [{"name": "   ", "quantity": "一份"}]},
        )

    assert response.status_code == 422


def test_order_preview_uses_saved_delivery_address() -> None:
    with make_client() as client:
        address_response = client.post(
            "/api/location/address",
            json={
                "user_id": "demo-user",
                "name": "上海人民广场",
                "district": "上海市黄浦区",
                "address": "人民大道",
                "location": "121.475,31.23",
                "detail": "1号楼2单元301",
            },
        )
        assert address_response.status_code == 200

        search = client.post(
            "/api/tools/search_grocery_options",
            json={"user_id": "demo-user", "items": [{"name": "土豆", "quantity": "适量"}]},
        )
        assert search.status_code == 200
        option_id = search.json()["options"][0]["id"]

        preview_response = client.post(
            "/api/tools/create_order_preview",
            json={"user_id": "demo-user", "option_id": option_id},
        )
        assert preview_response.status_code == 200
        preview = preview_response.json()["preview"]
        assert preview["address_masked"] == "上海市黄浦区 上海人民广场 人民大道 1号楼2单元301"


def test_realtime_token_requires_backend_key() -> None:
    with make_client() as client:
        response = client.post("/api/realtime/token")

    assert response.status_code == 500
    assert "OPENAI_API_KEY" in response.json()["detail"]
