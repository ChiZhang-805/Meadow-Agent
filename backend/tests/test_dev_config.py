from tests.conftest import make_client


def test_dev_config_can_set_runtime_openai_key() -> None:
    with make_client() as client:
        status_before = client.get("/api/dev/config/status")
        assert status_before.status_code == 200
        openai_item_before = next(item for item in status_before.json()["items"] if item["name"] == "OPENAI_API_KEY")
        assert not openai_item_before["configured"]

        response = client.post(
            "/api/dev/config/openai-api-key",
            json={"openai_api_key": "sk-test_abcdefghijklmnopqrstuvwxyz"},
        )
        assert response.status_code == 200

        status_after = client.get("/api/dev/config/status")
        openai_item_after = next(item for item in status_after.json()["items"] if item["name"] == "OPENAI_API_KEY")
        assert openai_item_after["configured"]
        assert openai_item_after["source"] == "runtime_memory"


def test_dev_config_rejects_non_openai_key_shape() -> None:
    with make_client() as client:
        response = client.post(
            "/api/dev/config/openai-api-key",
            json={"openai_api_key": "not-an-openai-key-value"},
        )

    assert response.status_code == 400


def test_dev_config_can_set_runtime_amap_key() -> None:
    with make_client() as client:
        response = client.post(
            "/api/dev/config/amap-api-key",
            json={"amap_api_key": "amap-test-key"},
        )
        assert response.status_code == 200

        status = client.get("/api/dev/config/status")
        amap_item = next(item for item in status.json()["items"] if item["name"] == "AMAP_API_KEY")
        assert amap_item["configured"]
        assert amap_item["source"] == "runtime_memory"
