"""
Unit tests for rule_engine.py using mocked metrics.
"""

import pytest
from unittest.mock import MagicMock
from rule_engine import HealthScorer, RuleResult
from providers import MetricsProvider


class MockedMetricsProvider(MetricsProvider):
    """Mocked metrics provider for deterministic rule engine testing."""

    def __init__(self, active_sessions=10, users_pct=90.0, blocked_count=0):
        self._active_sessions = active_sessions
        self._users_pct = users_pct
        self._blocked_count = blocked_count

    def get_active_sessions(self) -> int:
        return self._active_sessions

    def get_tablespace_usage(self):
        return [
            {"name": "SYSTEM", "used_pct": 50.0, "free_mb": 5000.0, "total_mb": 10000.0},
            {"name": "USERS", "used_pct": self._users_pct, "free_mb": 1000.0, "total_mb": 10000.0}
        ]

    def get_wait_events(self):
        return [{"event_name": "db file sequential read", "wait_count": 100, "total_wait_time_ms": 200.0}]

    def get_sysstat(self, stat_name: str) -> float:
        return 500000.0

    def get_blocked_sessions(self):
        return [{"blocked_sid": 101, "blocking_sid": 55}] if self._blocked_count > 0 else []

    def health_check(self) -> bool:
        return True


def test_health_scorer_healthy():
    mock_provider = MockedMetricsProvider(active_sessions=5, users_pct=60.0, blocked_count=0)
    scorer = HealthScorer(config_path="rules.yaml")
    report = scorer.evaluate_all(mock_provider)

    assert report.health_score == 100.0
    assert report.status == "HEALTHY"
    assert report.warning_count == 0
    assert report.critical_count == 0


def test_health_scorer_warning_threshold():
    # USERS tablespace at 88% triggers WARNING (threshold 85%)
    mock_provider = MockedMetricsProvider(active_sessions=5, users_pct=88.0, blocked_count=0)
    scorer = HealthScorer(config_path="rules.yaml")
    report = scorer.evaluate_all(mock_provider)

    assert report.health_score < 100.0
    assert report.warning_count >= 1
    assert report.status in ("DEGRADED", "HEALTHY")


def test_health_scorer_critical_threshold():
    # USERS tablespace at 98% triggers CRITICAL (threshold 95%)
    mock_provider = MockedMetricsProvider(active_sessions=60, users_pct=98.0, blocked_count=6)
    scorer = HealthScorer(config_path="rules.yaml")
    report = scorer.evaluate_all(mock_provider)

    assert report.health_score < 70.0
    assert report.status == "CRITICAL"
    assert report.critical_count >= 1
