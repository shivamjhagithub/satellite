from fastapi.testclient import TestClient

from app.main import app


def test_health_contract_is_stable():
    client = TestClient(app)
    response = client.get("/health", headers={"X-Correlation-Id": "phase1-test"})
    assert response.status_code == 200
    assert response.headers["X-Correlation-Id"] == "phase1-test"
    body = response.json()
    assert body["status"] == "UP"
    assert body["service"] == "ai-service"
    assert isinstance(body["modelLoaded"], bool)
    assert body["model"].startswith("Qwen/Qwen3-VL-")
    assert "pythonVersion" in body
    assert "rasterioAvailable" in body
    assert "gdalAvailable" in body
    assert "gpuAvailable" in body
