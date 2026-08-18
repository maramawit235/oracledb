"""
Unit tests for alert_engine.py using mocked network/SMTP calls.
"""

import time
from unittest.mock import MagicMock, patch

import pytest

from alert_engine import (
    AlertEngine,
    EmailNotificationChannel,
    GenericWebhookChannel,
    SlackNotificationChannel,
)
from rule_engine import RuleResult


def make_result(rule_id="RULE_TABLESPACE_USERS", severity="WARNING", value=88.0):
    return RuleResult(
        rule_id=rule_id,
        rule_name="USERS Tablespace Capacity",
        metric_type="tablespace",
        current_value=value,
        unit="%",
        warning_threshold=85.0,
        critical_threshold=95.0,
        weight=25.0,
        severity=severity,
        recommendation="Resize datafile or purge historical partitions in USERS tablespace.",
        message=f"{severity}: USERS Tablespace Capacity ({value}%) breached threshold.",
    )


# ---------------------------------------------------------------------------
# SlackNotificationChannel
# ---------------------------------------------------------------------------

class TestSlackNotificationChannel:
    def test_skips_when_no_webhook_configured(self):
        channel = SlackNotificationChannel(webhook_url="")
        sent = channel.send_alert(make_result(), health_score=75.0)
        assert sent is False

    @patch("alert_engine.requests.post")
    def test_sends_successfully_on_200(self, mock_post):
        mock_post.return_value = MagicMock(status_code=200, text="ok")
        channel = SlackNotificationChannel(webhook_url="https://hooks.slack.test/xyz")
        sent = channel.send_alert(make_result(), health_score=75.0)

        assert sent is True
        mock_post.assert_called_once()
        _, kwargs = mock_post.call_args
        payload = kwargs["json"]
        assert payload["attachments"][0]["title"].startswith("🚨 Oracle DB Health Alert")
        assert "RULE_TABLESPACE_USERS" not in payload["attachments"][0]["title"]  # uses rule_name, not id

    @patch("alert_engine.requests.post")
    def test_returns_false_on_non_200(self, mock_post):
        mock_post.return_value = MagicMock(status_code=500, text="server error")
        channel = SlackNotificationChannel(webhook_url="https://hooks.slack.test/xyz")
        sent = channel.send_alert(make_result(), health_score=75.0)
        assert sent is False

    @patch("alert_engine.requests.post", side_effect=Exception("connection refused"))
    def test_returns_false_on_exception(self, mock_post):
        channel = SlackNotificationChannel(webhook_url="https://hooks.slack.test/xyz")
        sent = channel.send_alert(make_result(), health_score=75.0)
        assert sent is False


# ---------------------------------------------------------------------------
# EmailNotificationChannel
# ---------------------------------------------------------------------------

class TestEmailNotificationChannel:
    def test_skips_when_no_host_or_recipients(self):
        channel = EmailNotificationChannel(
            smtp_host="", smtp_port=587, sender="a@b.com", recipients=[]
        )
        sent = channel.send_alert(make_result(), health_score=75.0)
        assert sent is False

    @patch("alert_engine.smtplib.SMTP")
    def test_sends_successfully_without_auth(self, mock_smtp_cls):
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        channel = EmailNotificationChannel(
            smtp_host="smtp.boa.test",
            smtp_port=587,
            sender="dba@boa.test",
            recipients=["oncall@boa.test"],
        )
        sent = channel.send_alert(make_result(), health_score=75.0)

        assert sent is True
        mock_server.sendmail.assert_called_once()
        mock_server.login.assert_not_called()

    @patch("alert_engine.smtplib.SMTP")
    def test_authenticates_when_credentials_present(self, mock_smtp_cls):
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        channel = EmailNotificationChannel(
            smtp_host="smtp.boa.test",
            smtp_port=587,
            sender="dba@boa.test",
            recipients=["oncall@boa.test"],
            username="dba",
            password="secret",
        )
        sent = channel.send_alert(make_result(), health_score=75.0)

        assert sent is True
        mock_server.starttls.assert_called_once()
        mock_server.login.assert_called_once_with("dba", "secret")

    @patch("alert_engine.smtplib.SMTP", side_effect=Exception("smtp timeout"))
    def test_returns_false_on_smtp_exception(self, mock_smtp_cls):
        channel = EmailNotificationChannel(
            smtp_host="smtp.boa.test",
            smtp_port=587,
            sender="dba@boa.test",
            recipients=["oncall@boa.test"],
        )
        sent = channel.send_alert(make_result(), health_score=75.0)
        assert sent is False


# ---------------------------------------------------------------------------
# GenericWebhookChannel
# ---------------------------------------------------------------------------

class TestGenericWebhookChannel:
    def test_skips_when_no_endpoint(self):
        channel = GenericWebhookChannel(endpoint_url="")
        sent = channel.send_alert(make_result(), health_score=75.0)
        assert sent is False

    @patch("alert_engine.requests.post")
    def test_sends_successfully_on_2xx(self, mock_post):
        mock_post.return_value = MagicMock(status_code=202)
        channel = GenericWebhookChannel(endpoint_url="https://siem.boa.test/ingest")
        sent = channel.send_alert(make_result(), health_score=75.0)
        assert sent is True

    @patch("alert_engine.requests.post")
    def test_returns_false_on_bad_status(self, mock_post):
        mock_post.return_value = MagicMock(status_code=404)
        channel = GenericWebhookChannel(endpoint_url="https://siem.boa.test/ingest")
        sent = channel.send_alert(make_result(), health_score=75.0)
        assert sent is False

    @patch("alert_engine.requests.post", side_effect=Exception("dns failure"))
    def test_returns_false_on_exception(self, mock_post):
        channel = GenericWebhookChannel(endpoint_url="https://siem.boa.test/ingest")
        sent = channel.send_alert(make_result(), health_score=75.0)
        assert sent is False


# ---------------------------------------------------------------------------
# AlertEngine — dedup / cooldown / escalation / fan-out logic
# ---------------------------------------------------------------------------

class TestAlertEngine:
    def _fake_channel(self, name="chan", ok=True):
        chan = MagicMock()
        chan.send_alert = MagicMock(return_value=ok)
        chan.name = name
        return chan

    def test_ignores_ok_severity_results(self):
        engine = AlertEngine(cooldown_seconds=900)
        engine.add_channel(self._fake_channel())
        ok_result = make_result(severity="OK")

        count = engine.process_rule_results([ok_result], health_score=100.0)

        assert count == 0
        assert ok_result.rule_id not in engine._alert_state

    def test_sends_first_alert_for_new_rule(self):
        engine = AlertEngine(cooldown_seconds=900)
        chan = self._fake_channel()
        engine.add_channel(chan)

        count = engine.process_rule_results([make_result(severity="WARNING")], health_score=75.0)

        assert count == 1
        chan.send_alert.assert_called_once()
        assert engine._alert_state["RULE_TABLESPACE_USERS"]["last_severity"] == "WARNING"

    def test_suppresses_duplicate_within_cooldown(self):
        engine = AlertEngine(cooldown_seconds=900)
        engine.add_channel(self._fake_channel())

        first = engine.process_rule_results([make_result(severity="WARNING")], health_score=75.0)
        second = engine.process_rule_results([make_result(severity="WARNING")], health_score=75.0)

        assert first == 1
        assert second == 0  # suppressed, still within cooldown

    def test_fires_immediately_on_escalation_to_critical(self):
        engine = AlertEngine(cooldown_seconds=900)
        engine.add_channel(self._fake_channel())

        engine.process_rule_results([make_result(severity="WARNING")], health_score=75.0)
        # Escalate to CRITICAL right away, well within the cooldown window
        count = engine.process_rule_results(
            [make_result(severity="CRITICAL", value=98.0)], health_score=50.0
        )

        assert count == 1
        assert engine._alert_state["RULE_TABLESPACE_USERS"]["last_severity"] == "CRITICAL"

    def test_resends_after_cooldown_expires(self):
        engine = AlertEngine(cooldown_seconds=1)
        engine.add_channel(self._fake_channel())

        engine.process_rule_results([make_result(severity="WARNING")], health_score=75.0)
        time.sleep(1.1)
        count = engine.process_rule_results([make_result(severity="WARNING")], health_score=75.0)

        assert count == 1

    def test_dispatches_to_all_registered_channels(self):
        engine = AlertEngine(cooldown_seconds=900)
        chan_a = self._fake_channel("slack", ok=True)
        chan_b = self._fake_channel("email", ok=True)
        chan_c = self._fake_channel("webhook", ok=False)  # fails, but others succeed
        engine.add_channel(chan_a)
        engine.add_channel(chan_b)
        engine.add_channel(chan_c)

        count = engine.process_rule_results([make_result(severity="WARNING")], health_score=75.0)

        assert count == 1
        chan_a.send_alert.assert_called_once()
        chan_b.send_alert.assert_called_once()
        chan_c.send_alert.assert_called_once()

    def test_counts_alert_even_if_all_channels_fail(self):
        # Current behavior: state still updates and alerts_sent increments only
        # when sent_any is True OR there are no channels at all. With channels
        # present but all failing, the alert should NOT count as sent.
        engine = AlertEngine(cooldown_seconds=900)
        engine.add_channel(self._fake_channel(ok=False))

        count = engine.process_rule_results([make_result(severity="WARNING")], health_score=75.0)

        assert count == 0
        # State is still recorded even though dispatch failed, preventing retry storms
        assert "RULE_TABLESPACE_USERS" in engine._alert_state

    def test_counts_alert_when_no_channels_registered(self):
        engine = AlertEngine(cooldown_seconds=900)  # no channels added

        count = engine.process_rule_results([make_result(severity="WARNING")], health_score=75.0)

        assert count == 1  # falls back to "not self.channels" branch

    def test_multiple_independent_rules_tracked_separately(self):
        engine = AlertEngine(cooldown_seconds=900)
        engine.add_channel(self._fake_channel())

        results = [
            make_result(rule_id="RULE_TABLESPACE_USERS", severity="WARNING"),
            make_result(rule_id="RULE_ACTIVE_SESSIONS", severity="CRITICAL", value=60.0),
        ]
        count = engine.process_rule_results(results, health_score=40.0)

        assert count == 2
        assert set(engine._alert_state.keys()) == {"RULE_TABLESPACE_USERS", "RULE_ACTIVE_SESSIONS"}
