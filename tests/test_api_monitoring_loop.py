"""
Tests for the automatic background monitoring cycle in api.py.

These confirm the core requirement: alerts must fire on their own timer,
not only when someone manually tests a channel or opens the dashboard.
"""

from unittest.mock import MagicMock, patch

import pytest

import api
from alert_engine import EmailNotificationChannel, GenericWebhookChannel, SlackNotificationChannel
from providers import MetricsProvider


class MockedBreachingProvider(MetricsProvider):
    """Simulates a database with USERS tablespace at 98% -- a CRITICAL breach."""

    def get_active_sessions(self) -> int:
        return 5

    def get_tablespace_usage(self):
        return [
            {"name": "SYSTEM", "used_pct": 50.0, "free_mb": 5000.0, "total_mb": 10000.0},
            {"name": "USERS", "used_pct": 98.0, "free_mb": 200.0, "total_mb": 10000.0},
        ]

    def get_wait_events(self):
        return [{"event_name": "db file sequential read", "wait_count": 10, "total_wait_time_ms": 50.0}]

    def get_sysstat(self, stat_name: str) -> float:
        return 100000.0

    def get_blocked_sessions(self):
        return []

    def health_check(self) -> bool:
        return True


class MockedHealthyProvider(MetricsProvider):
    """Simulates a fully healthy database -- no rule should breach."""

    def get_active_sessions(self) -> int:
        return 3

    def get_tablespace_usage(self):
        return [
            {"name": "SYSTEM", "used_pct": 40.0, "free_mb": 6000.0, "total_mb": 10000.0},
            {"name": "USERS", "used_pct": 30.0, "free_mb": 7000.0, "total_mb": 10000.0},
        ]

    def get_wait_events(self):
        return [{"event_name": "db file sequential read", "wait_count": 5, "total_wait_time_ms": 10.0}]

    def get_sysstat(self, stat_name: str) -> float:
        return 50000.0

    def get_blocked_sessions(self):
        return []

    def health_check(self) -> bool:
        return True


@pytest.fixture(autouse=True)
def reset_alert_engine_state():
    """Each test gets a clean alert engine so cooldown state from one test
    doesn't leak into another."""
    api.alert_engine.channels = []
    api.alert_engine._alert_state = {}
    api.monitor_state.update(
        {
            "last_run_at": None,
            "last_health_score": None,
            "last_status": None,
            "last_alerts_sent": 0,
            "last_error": None,
            "cycle_count": 0,
        }
    )
    yield


class TestRegisterAlertChannels:
    def test_registers_nothing_when_env_is_empty(self, monkeypatch):
        for var in ("SLACK_WEBHOOK_URL", "SMTP_HOST", "ALERT_RECIPIENT_EMAILS", "GENERIC_WEBHOOK_URL"):
            monkeypatch.delenv(var, raising=False)

        count = api.register_alert_channels(api.alert_engine)

        assert count == 0
        assert api.alert_engine.channels == []

    def test_registers_slack_when_webhook_present(self, monkeypatch):
        monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.test/abc")
        monkeypatch.delenv("SMTP_HOST", raising=False)
        monkeypatch.delenv("GENERIC_WEBHOOK_URL", raising=False)

        count = api.register_alert_channels(api.alert_engine)

        assert count == 1
        assert isinstance(api.alert_engine.channels[0], SlackNotificationChannel)

    def test_registers_email_only_when_host_and_recipients_both_present(self, monkeypatch):
        monkeypatch.setenv("SMTP_HOST", "smtp.boa.test")
        monkeypatch.setenv("ALERT_RECIPIENT_EMAILS", "dba@boa.test, oncall@boa.test")
        monkeypatch.delenv("SLACK_WEBHOOK_URL", raising=False)
        monkeypatch.delenv("GENERIC_WEBHOOK_URL", raising=False)

        count = api.register_alert_channels(api.alert_engine)

        assert count == 1
        channel = api.alert_engine.channels[0]
        assert isinstance(channel, EmailNotificationChannel)
        assert channel.recipients == ["dba@boa.test", "oncall@boa.test"]

    def test_registers_email_with_smtp_host_even_if_static_recipients_missing(self, monkeypatch):
        # Static recipients are now optional -- the channel still registers
        # as long as SMTP_HOST is set, because recipients can also come from
        # the self-service recipient_store at send time (no restart needed).
        monkeypatch.setenv("SMTP_HOST", "smtp.boa.test")
        monkeypatch.delenv("ALERT_RECIPIENT_EMAILS", raising=False)
        monkeypatch.delenv("SLACK_WEBHOOK_URL", raising=False)
        monkeypatch.delenv("GENERIC_WEBHOOK_URL", raising=False)

        count = api.register_alert_channels(api.alert_engine)

        assert count == 1
        channel = api.alert_engine.channels[0]
        assert isinstance(channel, EmailNotificationChannel)
        assert channel.recipients == []  # no static baseline, dynamic-only

    def test_registers_all_three_when_fully_configured(self, monkeypatch):
        monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.test/abc")
        monkeypatch.setenv("SMTP_HOST", "smtp.boa.test")
        monkeypatch.setenv("ALERT_RECIPIENT_EMAILS", "dba@boa.test")
        monkeypatch.setenv("GENERIC_WEBHOOK_URL", "https://siem.boa.test/ingest")

        count = api.register_alert_channels(api.alert_engine)

        assert count == 3
        types = {type(c) for c in api.alert_engine.channels}
        assert types == {SlackNotificationChannel, EmailNotificationChannel, GenericWebhookChannel}


class TestRunMonitoringCycle:
    @patch("api.get_provider")
    def test_healthy_db_triggers_no_dispatch(self, mock_get_provider):
        mock_get_provider.return_value = MockedHealthyProvider()
        mock_channel = MagicMock()
        mock_channel.send_alert.return_value = True
        api.alert_engine.add_channel(mock_channel)

        api.run_monitoring_cycle()

        mock_channel.send_alert.assert_not_called()
        assert api.monitor_state["last_alerts_sent"] == 0
        assert api.monitor_state["last_status"] == "HEALTHY"
        assert api.monitor_state["cycle_count"] == 1
        assert api.monitor_state["last_error"] is None

    @patch("api.get_provider")
    def test_breach_automatically_dispatches_without_manual_trigger(self, mock_get_provider):
        # This is the core proof: no test button, no HTTP call to /alerts --
        # calling run_monitoring_cycle() alone (as the scheduler does on its
        # own timer) must reach the notification channel.
        mock_get_provider.return_value = MockedBreachingProvider()
        mock_channel = MagicMock()
        mock_channel.send_alert.return_value = True
        api.alert_engine.add_channel(mock_channel)

        api.run_monitoring_cycle()

        mock_channel.send_alert.assert_called()
        assert api.monitor_state["last_alerts_sent"] >= 1
        assert api.monitor_state["last_status"] == "CRITICAL"

    @patch("api.get_provider")
    def test_second_cycle_within_cooldown_is_suppressed(self, mock_get_provider):
        mock_get_provider.return_value = MockedBreachingProvider()
        mock_channel = MagicMock()
        mock_channel.send_alert.return_value = True
        api.alert_engine.add_channel(mock_channel)

        api.run_monitoring_cycle()
        first_call_count = mock_channel.send_alert.call_count
        api.run_monitoring_cycle()  # runs immediately after, within cooldown

        assert mock_channel.send_alert.call_count == first_call_count  # no new dispatch
        assert api.monitor_state["last_alerts_sent"] == 0  # second cycle sent nothing new

    @patch("api.get_provider", side_effect=Exception("Oracle instance unreachable"))
    def test_provider_failure_is_captured_not_raised(self, mock_get_provider):
        # The scheduler must never crash the loop -- a single bad cycle should
        # be logged and retried next interval, not kill the background job.
        api.run_monitoring_cycle()

        assert api.monitor_state["last_error"] == "Oracle instance unreachable"
        assert api.monitor_state["cycle_count"] == 1

    @patch("api.get_provider")
    def test_dispatches_end_to_end_through_real_email_channel(self, mock_get_provider, monkeypatch):
        # Full stack: env-configured EmailNotificationChannel, SMTP mocked so
        # no real network call happens, but the actual send path is exercised.
        mock_get_provider.return_value = MockedBreachingProvider()
        monkeypatch.setenv("SMTP_HOST", "smtp.boa.test")
        monkeypatch.setenv("ALERT_RECIPIENT_EMAILS", "dba@boa.test")
        monkeypatch.delenv("SLACK_WEBHOOK_URL", raising=False)
        monkeypatch.delenv("GENERIC_WEBHOOK_URL", raising=False)
        api.register_alert_channels(api.alert_engine)

        with patch("alert_engine.smtplib.SMTP") as mock_smtp_cls:
            mock_server = MagicMock()
            mock_smtp_cls.return_value.__enter__.return_value = mock_server
            api.run_monitoring_cycle()

        mock_server.sendmail.assert_called_once()
        assert api.monitor_state["last_alerts_sent"] >= 1
