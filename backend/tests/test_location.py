from tests.conftest import make_client


def test_location_suggestions_require_amap_key() -> None:
    with make_client() as client:
        response = client.post("/api/location/amap/address_suggestions", json={"query": "上海"})

    assert response.status_code == 500
    assert "AMAP_API_KEY" in response.json()["detail"]


def test_location_suggestions_reject_blank_query() -> None:
    with make_client() as client:
        response = client.post("/api/location/amap/address_suggestions", json={"query": "   "})

    assert response.status_code == 422


def test_save_delivery_address() -> None:
    with make_client() as client:
        response = client.post(
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

    assert response.status_code == 200
    assert response.json()["address"]["detail"] == "1号楼2单元301"


def test_save_delivery_address_rejects_blank_name() -> None:
    with make_client() as client:
        response = client.post(
            "/api/location/address",
            json={
                "user_id": "demo-user",
                "name": "   ",
                "detail": "1号楼2单元301",
            },
        )

    assert response.status_code == 422


def test_config_status_tracks_delivery_address() -> None:
    with make_client() as client:
        before = client.get("/api/dev/config/status", headers={"X-User-Id": "demo-user"})
        assert before.status_code == 200
        address_before = next(item for item in before.json()["items"] if item["name"] == "地址")
        assert not address_before["configured"]

        response = client.post(
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
        assert response.status_code == 200

        after = client.get("/api/dev/config/status", headers={"X-User-Id": "demo-user"})
        address_after = next(item for item in after.json()["items"] if item["name"] == "地址")
        assert address_after["configured"]
        assert address_after["source"] == "profile"


def test_config_status_address_is_scoped_by_user() -> None:
    with make_client() as client:
        response = client.post(
            "/api/location/address",
            json={
                "user_id": "user-a",
                "name": "上海人民广场",
                "district": "上海市黄浦区",
                "address": "人民大道",
                "location": "121.475,31.23",
                "detail": "1号楼2单元301",
            },
        )
        assert response.status_code == 200

        user_a = client.get("/api/dev/config/status", headers={"X-User-Id": "user-a"})
        user_b = client.get("/api/dev/config/status", headers={"X-User-Id": "user-b"})

    address_a = next(item for item in user_a.json()["items"] if item["name"] == "地址")
    address_b = next(item for item in user_b.json()["items"] if item["name"] == "地址")
    assert address_a["configured"]
    assert not address_b["configured"]
