import os

import pytest

from tests.conftest import make_client


pytestmark = pytest.mark.skipif(
    os.getenv("RUN_OPENAI_LIVE_TESTS") != "1",
    reason="Set RUN_OPENAI_LIVE_TESTS=1 to run live OpenAI API tests",
)


def test_create_realtime_client_secret_live() -> None:
    with make_client() as client:
        response = client.post("/api/realtime/token", headers={"X-User-Id": "demo-user"})

    assert response.status_code == 200, response.text
    data = response.json()
    assert "value" in data
    assert isinstance(data["value"], str)
    assert len(data["value"]) > 20
