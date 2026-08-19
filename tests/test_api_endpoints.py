"""
Tests for FastAPI REST API endpoints in api.py.

Tests each route via actual HTTP requests using FastAPI's TestClient:
- GET /
- GET /health (healthy and failure cases)
- GET /metrics
- GET /alerts (healthy and breach cases)
- GET /alerts/status
- GET /alerts/recipients
- POST /alerts/recipients
- DELETE /alerts/recipients/{email}
- GET /alerts/recipients/manage
- GET /report
- 404 handler for nonexistent routes
"""

from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

import api
from tests.test_api_monitoring_loop import MockedBreachingProvider, MockedHealthyProvider


@pytest.fixture
def temp_recipients_file(tmp_path, monkeypatch):
    """Isolates recipient storage to a temporary file for API tests."""
    store_file = tmp_path / "test_api_recipients.json"
    monkeypatch.setenv("RECIPIENTS_STORE_PATH", str(store_file))
    monkeypatch.setenv("ALERT_RECIPIENT_EMAILS", "")
    return store_file


@pytest.fixture
def client(temp_recipients_file):
    """Provides a TestClient with api.get_provider patched to MockedHealthyProvider

    during the lifespan context manager startup and request execution.
    """
    with patch("api.get_provider", return_value=MockedHealthyProvider()):
        with TestClient(api.app) as test_client:
            yield test_client


class TestApiEndpoints:
    def test_get_root_returns_endpoint_list(self, client):
        """1. GET / returns 200 and its JSON body includes a list of endpoints."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ONLINE"
        assert "endpoints" in data
        assert isinstance(data["endpoints"], list)
        assert "/health" in data["endpoints"]
        assert "/metrics" in data["endpoints"]
        assert "/alerts" in data["endpoints"]
        assert "/report" in data["endpoints"]

    def test_get_health_healthy(self, client):
        """2. GET /health returns 200 when provider is healthy with health_score, status, rule_results."""
        with patch("api.get_provider", return_value=MockedHealthyProvider()):
            response = client.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert "health_score" in data
            assert "status" in data
            assert data["status"] == "HEALTHY"
            assert data["health_score"] >= 80.0
            assert "rule_results" in data
            assert isinstance(data["rule_results"], list)

    def test_get_health_error_status_on_failure(self, client):
        """3. GET /health returns 503 when get_provider raises an exception."""
        with patch("api.get_provider", side_effect=Exception("Database connection timeout")):
            response = client.get("/health")
            assert response.status_code == 503
            data = response.json()
            assert "detail" in data
            assert "Metrics collection failed" in data["detail"]
            assert "Database connection timeout" in data["detail"]

    def test_get_metrics_returns_raw_metrics(self, client):
        """4. GET /metrics returns 200 and includes raw metrics data from the provider."""
        with patch("api.get_provider", return_value=MockedHealthyProvider()):
            response = client.get("/metrics")
            assert response.status_code == 200
            data = response.json()
            assert "active_sessions" in data
            assert "tablespaces" in data
            assert "wait_events" in data
            assert "blocked_sessions" in data
            assert "sysstat_execute_count" in data
            assert data["active_sessions"] == 3
            assert isinstance(data["tablespaces"], list)

    def test_get_alerts_healthy_empty(self, client):
        """5. GET /alerts returns 200 and active alerts list is empty when no breaches occur."""
        with patch("api.get_provider", return_value=MockedHealthyProvider()):
            response = client.get("/alerts")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "HEALTHY"
            assert data["active_alert_count"] == 0
            assert data["alerts"] == []

    def test_get_alerts_with_breach(self, client):
        """6. GET /alerts returns 200 and a non-empty list when provider breaches a rule."""
        with patch("api.get_provider", return_value=MockedBreachingProvider()):
            response = client.get("/alerts")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "CRITICAL"
            assert data["active_alert_count"] > 0
            assert len(data["alerts"]) > 0
            # Confirm breach details
            alert_rule_ids = [a["rule_id"] for a in data["alerts"]]
            assert any("TABLESPACE" in rid for rid in alert_rule_ids)

    def test_get_alerts_status(self, client):
        """7. GET /alerts/status returns 200 and includes monitoring configuration and loop state."""
        response = client.get("/alerts/status")
        assert response.status_code == 200
        data = response.json()
        assert "monitor_interval_seconds" in data
        assert "alert_cooldown_seconds" in data
        assert "registered_channels" in data
        assert "cycle_count" in data
        assert isinstance(data["monitor_interval_seconds"], int)
        assert isinstance(data["cycle_count"], int)

    def test_get_report_returns_html(self, client):
        """8. GET /report returns 200 with text/html content containing valid HTML markup."""
        with patch("api.get_provider", return_value=MockedHealthyProvider()):
            response = client.get("/report")
            assert response.status_code == 200
            assert "text/html" in response.headers.get("content-type", "")
            assert "<!DOCTYPE html>" in response.text
            assert "<html" in response.text
            assert "</html>" in response.text
            assert "Oracle DB Executive Health & Performance Report" in response.text

    def test_get_recipients_starts_empty(self, client):
        """9. GET /alerts/recipients returns 200 with static and dynamic keys, starting empty."""
        response = client.get("/alerts/recipients")
        assert response.status_code == 200
        data = response.json()
        assert "static_recipients" in data
        assert "dynamic_recipients" in data
        assert data["static_recipients"] == []
        assert data["dynamic_recipients"] == []

    def test_recipients_crud_cycle_end_to_end(self, client):
        """10. Confirms full request cycle: POST /alerts/recipients to add, then GET /alerts/recipients."""
        new_email = "dba.oncall@bankofabyssinia.com"

        # 1. Add recipient via POST
        post_response = client.post("/alerts/recipients", json={"email": new_email})
        assert post_response.status_code == 200
        post_data = post_response.json()
        assert "added" in post_data
        assert post_data["added"]["email"] == new_email

        # 2. Confirm recipient appears via GET
        get_response = client.get("/alerts/recipients")
        assert get_response.status_code == 200
        get_data = get_response.json()
        dynamic_emails = [r["email"] for r in get_data["dynamic_recipients"]]
        assert new_email in dynamic_emails

        # 3. Clean up / Delete recipient via DELETE
        del_response = client.delete(f"/alerts/recipients/{new_email}")
        assert del_response.status_code == 200
        assert del_response.json() == {"removed": new_email}

        # 4. Verify list is empty again
        verify_response = client.get("/alerts/recipients")
        assert verify_response.status_code == 200
        assert verify_response.json()["dynamic_recipients"] == []

    def test_nonexistent_route_returns_404(self, client):
        """11. GET /this-route-does-not-exist returns 404."""
        response = client.get("/this-route-does-not-exist")
        assert response.status_code == 404
        assert response.json() == {"detail": "Not Found"}
