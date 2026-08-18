"""
Oracle Database Health Monitoring & Performance Optimization Suite
Module: alert_engine.py
Description: Alert Engine filtering WARNING/CRITICAL breaches and dispatching notifications
              across Slack, Email (SMTP), and Generic Webhooks with stateful alert deduplication
              and configurable cooldown timers.
Author: Bank of Abyssinia DB Monitoring Team
"""

import abc
import json
import logging
import smtplib
import time
from email.mime.text import MIMEText
from typing import Any, Dict, List, Optional

import requests

from rule_engine import RuleResult

logger = logging.getLogger(__name__)


class NotificationChannel(abc.ABC):
    """Abstract Base Class interface for all notification dispatch channels."""

    @abc.abstractmethod
    def send_alert(self, rule_result: RuleResult, health_score: float) -> bool:
        """Dispatches an alert payload for a specific rule violation. Returns True if successful."""
        pass


class SlackNotificationChannel(NotificationChannel):
    """Notification channel sending formatted JSON cards to a Slack Webhook incoming endpoint."""

    def __init__(self, webhook_url: str):
        self.webhook_url = webhook_url

    def send_alert(self, rule_result: RuleResult, health_score: float) -> bool:
        if not self.webhook_url:
            logger.debug("[SlackChannel] Webhook URL not configured. Skipping Slack alert.")
            return False

        color = "#FF0000" if rule_result.severity == "CRITICAL" else "#FFA500"
        
        payload = {
            "attachments": [
                {
                    "color": color,
                    "title": f"🚨 Oracle DB Health Alert: {rule_result.rule_name} [{rule_result.severity}]",
                    "text": rule_result.message,
                    "fields": [
                        {"title": "Overall DB Health Score", "value": f"{health_score}/100", "short": True},
                        {"title": "Current Value", "value": f"{rule_result.current_value} {rule_result.unit}", "short": True},
                        {"title": "Thresholds", "value": f"Warn: {rule_result.warning_threshold} | Crit: {rule_result.critical_threshold}", "short": True},
                        {"title": "DBA Recommendation", "value": rule_result.recommendation, "short": False}
                    ],
                    "footer": "Bank of Abyssinia Oracle DB Health Suite",
                    "ts": int(time.time())
                }
            ]
        }

        try:
            res = requests.post(self.webhook_url, json=payload, timeout=5)
            if res.status_code == 200:
                logger.info(f"[SlackChannel] Successfully dispatched Slack alert for {rule_result.rule_id}.")
                return True
            else:
                logger.error(f"[SlackChannel] Slack HTTP {res.status_code}: {res.text}")
                return False
        except Exception as e:
            logger.error(f"[SlackChannel] Failed sending Slack webhook: {e}")
            return False


class EmailNotificationChannel(NotificationChannel):
    """Notification channel delivering HTML emails via SMTP server.

    Recipients come from two sources merged at SEND TIME (not just once at
    startup): the static `recipients` list (from ALERT_RECIPIENT_EMAILS in
    .env) plus whatever recipient_store.list_recipient_emails() returns.
    This is what lets a DBA add/remove their own email via the self-service
    endpoints without restarting the app -- the next alert just picks it up.
    """

    def __init__(self, smtp_host: str, smtp_port: int, sender: str, recipients: List[str], username: str = "", password: str = ""):
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.sender = sender
        self.recipients = recipients  # static baseline from .env
        self.username = username
        self.password = password

    def _effective_recipients(self) -> List[str]:
        try:
            import recipient_store
            dynamic = recipient_store.list_recipient_emails()
        except Exception as e:
            logger.error(f"[EmailChannel] Failed to load dynamic recipients, using static list only: {e}")
            dynamic = []
        # Merge, dedup case-insensitively, preserve order (static first)
        seen = set()
        merged = []
        for email in list(self.recipients) + dynamic:
            key = email.strip().lower()
            if key and key not in seen:
                seen.add(key)
                merged.append(email.strip())
        return merged

    def send_alert(self, rule_result: RuleResult, health_score: float) -> bool:
        recipients = self._effective_recipients()
        if not self.smtp_host or not recipients:
            logger.debug("[EmailChannel] SMTP host or recipients not configured. Skipping email.")
            return False

        subject = f"[{rule_result.severity}] Oracle DB Alert: {rule_result.rule_name} (Score: {health_score}/100)"
        
        html_body = f"""
        <html>
        <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
            <div style="background-color: {'#d9534f' if rule_result.severity == 'CRITICAL' else '#f0ad4e'}; color: white; padding: 15px; border-radius: 5px;">
                <h2 style="margin: 0;">Oracle Database Alert: {rule_result.rule_name}</h2>
                <p style="margin: 5px 0 0 0;">Severity: <strong>{rule_result.severity}</strong> | Database Health Score: <strong>{health_score}/100</strong></p>
            </div>
            <div style="padding: 15px; border: 1px solid #ddd; margin-top: 10px; border-radius: 5px;">
                <p><strong>Metric:</strong> {rule_result.metric_type}</p>
                <p><strong>Current Value:</strong> {rule_result.current_value} {rule_result.unit}</p>
                <p><strong>Thresholds:</strong> Warning: {rule_result.warning_threshold} | Critical: {rule_result.critical_threshold}</p>
                <hr style="border: 0; border-top: 1px solid #eee;" />
                <h4 style="color: #0275d8; margin-bottom: 5px;">DBA Action Plan & Recommendation:</h4>
                <p style="background: #f8f9fa; padding: 10px; border-left: 4px solid #0275d8;">{rule_result.recommendation}</p>
            </div>
        </body>
        </html>
        """

        msg = MIMEText(html_body, "html")
        msg["Subject"] = subject
        msg["From"] = self.sender
        msg["To"] = ", ".join(recipients)

        try:
            with smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=5) as server:
                if self.username and self.password:
                    server.starttls()
                    server.login(self.username, self.password)
                server.sendmail(self.sender, recipients, msg.as_string())
            logger.info(f"[EmailChannel] Email alert sent to {recipients} for {rule_result.rule_id}.")
            return True
        except Exception as e:
            logger.error(f"[EmailChannel] SMTP delivery error: {e}")
            return False


class GenericWebhookChannel(NotificationChannel):
    """Notification channel posting raw JSON metrics to a custom API monitoring system."""

    def __init__(self, endpoint_url: str):
        self.endpoint_url = endpoint_url

    def send_alert(self, rule_result: RuleResult, health_score: float) -> bool:
        if not self.endpoint_url:
            return False

        payload = {
            "event": "ORACLE_DB_ALERT",
            "health_score": health_score,
            "rule": rule_result.to_dict(),
            "timestamp": time.time()
        }

        try:
            res = requests.post(self.endpoint_url, json=payload, timeout=5)
            return res.status_code in (200, 201, 202)
        except Exception as e:
            logger.error(f"[GenericWebhookChannel] HTTP Post error: {e}")
            return False


class AlertEngine:
    """Stateful Alert Manager with Deduplication & Cooldown logic."""

    def __init__(self, cooldown_seconds: int = 900): # 15 min default cooldown
        self.channels: List[NotificationChannel] = []
        self.cooldown_seconds = cooldown_seconds
        # State tracking: rule_id -> {'last_sent_time': float, 'last_severity': str}
        self._alert_state: Dict[str, Dict[str, Any]] = {}

    def add_channel(self, channel: NotificationChannel):
        """Registers a new notification channel."""
        self.channels.append(channel)

    def _should_suppress_alert(self, rule_id: str, severity: str) -> bool:
        """Determines if an alert should be suppressed due to cooldown or unchanged severity state."""
        now = time.time()
        if rule_id not in self._alert_state:
            return False  # Brand new alert, do not suppress

        state = self._alert_state[rule_id]
        last_time = state["last_sent_time"]
        last_sev = state["last_severity"]

        # If severity escalated from WARNING to CRITICAL, fire immediately!
        if severity == "CRITICAL" and last_sev == "WARNING":
            logger.info(f"[AlertEngine] Alert {rule_id} escalated to CRITICAL. Re-alerting immediately.")
            return False

        # If still within cooldown window and severity hasn't escalated, suppress
        if (now - last_time) < self.cooldown_seconds:
            logger.info(f"[AlertEngine] Suppressing duplicate alert for {rule_id} (Cooldown active for next {int(self.cooldown_seconds - (now - last_time))}s).")
            return True

        return False

    def process_rule_results(self, rule_results: List[RuleResult], health_score: float) -> int:
        """Filters WARNING/CRITICAL results, applies deduplication, and sends alerts."""
        alerts_sent = 0
        now = time.time()

        for result in rule_results:
            if result.severity in ("WARNING", "CRITICAL"):
                if not self._should_suppress_alert(result.rule_id, result.severity):
                    # Dispatch to all registered channels
                    sent_any = False
                    for channel in self.channels:
                        if channel.send_alert(result, health_score):
                            sent_any = True

                    # Update state
                    self._alert_state[result.rule_id] = {
                        "last_sent_time": now,
                        "last_severity": result.severity
                    }
                    if sent_any or not self.channels:
                        alerts_sent += 1

        return alerts_sent
