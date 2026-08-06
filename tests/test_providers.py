"""
Unit tests for providers.py using mocked responses.
"""

import pytest
from unittest.mock import patch, MagicMock
from providers import PrometheusProvider, OracleSQLProvider, get_provider, MetricsUnavailableError


def test_prometheus_provider_health_check_success():
    with patch("requests.get") as mock_get:
        mock_get.return_value.status_code = 200
        provider = PrometheusProvider(prometheus_url="http://localhost:9090")
        assert provider.health_check() is True


def test_prometheus_provider_health_check_failure():
    with patch("requests.get") as mock_get:
        mock_get.side_effect = Exception("Connection refused")
        provider = PrometheusProvider(prometheus_url="http://localhost:9090")
        assert provider.health_check() is False


def test_provider_factory_fallback():
    # Simulate Prometheus unreachable -> falls back to OracleSQLProvider
    with patch.object(PrometheusProvider, "health_check", return_value=False):
        with patch.object(OracleSQLProvider, "health_check", return_value=True):
            config = {
                "PROMETHEUS_URL": "http://localhost:9090",
                "ORACLE_USER": "monitor",
                "ORACLE_PASSWORD": "MonitorPass123#",
                "ORACLE_DSN": "localhost:1521/XE"
            }
            provider = get_provider(config)
            assert isinstance(provider, OracleSQLProvider)
