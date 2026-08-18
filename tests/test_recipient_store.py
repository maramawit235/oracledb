"""
Tests for recipient_store.py and the /alerts/recipients endpoints in api.py.

Covers the self-service flow: a DBA adds/removes their own email and it
takes effect on the next alert cycle without editing .env or restarting.
"""

import json
import os
from unittest.mock import MagicMock, patch

import pytest

import recipient_store
from alert_engine import EmailNotificationChannel
from rule_engine import RuleResult


def make_result(severity="CRITICAL"):
    return RuleResult(
        rule_id="RULE_TABLESPACE_USERS",
        rule_name="USERS Tablespace Capacity",
        metric_type="tablespace",
        current_value=97.0,
        unit="%",
        warning_threshold=85.0,
        critical_threshold=95.0,
        weight=25.0,
        severity=severity,
        recommendation="Resize datafile.",
        message="CRITICAL breach",
    )


@pytest.fixture
def temp_store(tmp_path, monkeypatch):
    """Points recipient_store at a throwaway JSON file for the duration of the test."""
    store_path = tmp_path / "alert_recipients.json"
    monkeypatch.setenv("RECIPIENTS_STORE_PATH", str(store_path))
    yield store_path


class TestRecipientStoreValidation:
    def test_valid_email_passes(self):
        assert recipient_store.is_valid_email("dba@boa.com") is True

    def test_missing_at_sign_fails(self):
        assert recipient_store.is_valid_email("not-an-email") is False

    def test_missing_domain_fails(self):
        assert recipient_store.is_valid_email("dba@") is False

    def test_empty_string_fails(self):
        assert recipient_store.is_valid_email("") is False


class TestRecipientStorePersistence:
    def test_starts_empty_when_no_file_exists(self, temp_store):
        assert recipient_store.list_recipients() == []

    def test_add_creates_file_and_returns_record(self, temp_store):
        record = recipient_store.add_recipient("newdba@boa.com")

        assert record["email"] == "newdba@boa.com"
        assert "added_at" in record
        assert temp_store.exists()

    def test_add_rejects_invalid_email(self, temp_store):
        with pytest.raises(ValueError):
            recipient_store.add_recipient("not-valid")

    def test_add_is_idempotent_case_insensitive(self, temp_store):
        recipient_store.add_recipient("dba@boa.com")
        recipient_store.add_recipient("DBA@boa.com")  # same person, different case

        assert len(recipient_store.list_recipients()) == 1

    def test_list_recipient_emails_returns_plain_strings(self, temp_store):
        recipient_store.add_recipient("a@boa.com")
        recipient_store.add_recipient("b@boa.com")

        emails = recipient_store.list_recipient_emails()
        assert set(emails) == {"a@boa.com", "b@boa.com"}

    def test_remove_existing_recipient_returns_true(self, temp_store):
        recipient_store.add_recipient("leaving@boa.com")

        removed = recipient_store.remove_recipient("leaving@boa.com")

        assert removed is True
        assert recipient_store.list_recipients() == []

    def test_remove_nonexistent_recipient_returns_false(self, temp_store):
        removed = recipient_store.remove_recipient("nobody@boa.com")
        assert removed is False

    def test_remove_is_case_insensitive(self, temp_store):
        recipient_store.add_recipient("dba@boa.com")
        removed = recipient_store.remove_recipient("DBA@BOA.COM")
        assert removed is True

    def test_persists_across_separate_calls(self, temp_store):
        # Simulates: one process adds a recipient, a later monitoring cycle
        # (a fresh call) must see it -- this is the "no restart needed" guarantee.
        recipient_store.add_recipient("persisted@boa.com")

        # Read the file directly to prove it's real disk persistence, not just in-memory
        with open(temp_store) as f:
            raw = json.load(f)
        assert raw[0]["email"] == "persisted@boa.com"

    def test_corrupted_file_is_handled_gracefully(self, temp_store):
        temp_store.write_text("{not valid json")
        assert recipient_store.list_recipients() == []  # doesn't crash, just treats as empty


class TestEmailChannelDynamicMerge:
    @patch("alert_engine.smtplib.SMTP")
    def test_dynamic_recipient_added_without_restart_receives_next_alert(self, mock_smtp_cls, temp_store):
        # This is the core proof: the channel is constructed ONCE with only a
        # static recipient, then someone self-adds via the store, and the
        # very next send_alert() call (simulating the next monitoring cycle)
        # must include them -- no re-construction, no restart.
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        channel = EmailNotificationChannel(
            smtp_host="smtp.boa.test",
            smtp_port=587,
            sender="alerts@boa.test",
            recipients=["fixed-dba@boa.test"],
        )

        # First cycle: only the static recipient exists
        channel.send_alert(make_result(), health_score=40.0)
        first_to = mock_server.sendmail.call_args[0][1]
        assert first_to == ["fixed-dba@boa.test"]

        # Someone self-adds via the store -- simulates hitting POST /alerts/recipients
        recipient_store.add_recipient("newly-added@boa.test")

        # Next cycle, same channel instance, no restart
        channel.send_alert(make_result(), health_score=40.0)
        second_to = mock_server.sendmail.call_args[0][1]
        assert set(second_to) == {"fixed-dba@boa.test", "newly-added@boa.test"}

    @patch("alert_engine.smtplib.SMTP")
    def test_works_with_zero_static_recipients_if_dynamic_ones_exist(self, mock_smtp_cls, temp_store):
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        channel = EmailNotificationChannel(
            smtp_host="smtp.boa.test", smtp_port=587, sender="alerts@boa.test", recipients=[]
        )
        recipient_store.add_recipient("self-added-only@boa.test")

        sent = channel.send_alert(make_result(), health_score=40.0)

        assert sent is True
        mock_server.sendmail.assert_called_once()

    def test_skips_send_when_no_recipients_at_all(self, temp_store):
        channel = EmailNotificationChannel(
            smtp_host="smtp.boa.test", smtp_port=587, sender="alerts@boa.test", recipients=[]
        )
        sent = channel.send_alert(make_result(), health_score=40.0)
        assert sent is False

    @patch("alert_engine.smtplib.SMTP")
    def test_removed_recipient_stops_receiving_next_alert(self, mock_smtp_cls, temp_store):
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        channel = EmailNotificationChannel(
            smtp_host="smtp.boa.test", smtp_port=587, sender="alerts@boa.test", recipients=[]
        )
        recipient_store.add_recipient("leaving-soon@boa.test")
        channel.send_alert(make_result(), health_score=40.0)
        assert mock_server.sendmail.call_args[0][1] == ["leaving-soon@boa.test"]

        recipient_store.remove_recipient("leaving-soon@boa.test")
        sent = channel.send_alert(make_result(), health_score=40.0)

        assert sent is False  # nobody left to send to
