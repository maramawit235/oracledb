"""
Oracle Database Health Monitoring & Performance Optimization Suite
Module: api.py
Description: FastAPI REST API exposing database health endpoints, metrics queries,
              active alert summaries, and automated HTML report generation.
              Also runs a background monitoring loop that automatically evaluates
              rules and dispatches alerts (Slack/Email/Webhook) on a timer, so
              alerts fire without anyone opening the dashboard or hitting an endpoint.
Author: Bank of Abyssinia DB Monitoring Team
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import Any, Dict

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse

from alert_engine import AlertEngine, EmailNotificationChannel, GenericWebhookChannel, SlackNotificationChannel
from providers import get_provider
from report_generator import generate_html_report
from rule_engine import HealthScorer

load_dotenv()  # no-op if no .env is present (e.g. under docker-compose, which injects env vars directly)

logger = logging.getLogger("ohis.api")
logging.basicConfig(level=logging.INFO)

# Load configuration
config = {
    "PROMETHEUS_URL": os.getenv("PROMETHEUS_URL", ""),
    "ORACLE_HOST": os.getenv("ORACLE_HOST", "10.73.34.37"),
    "ORACLE_PORT": os.getenv("ORACLE_PORT", "1521"),
    "ORACLE_SERVICE_NAME": os.getenv("ORACLE_SERVICE_NAME", "XEPDB1"),
    "ORACLE_USER": os.getenv("ORACLE_USER", "monitor"),
    "ORACLE_PASSWORD": os.getenv("ORACLE_PASSWORD", ""),
    "ORACLE_DSN": os.getenv("ORACLE_DSN", "")
}

# How often the background loop evaluates rules and dispatches alerts, independent
# of any HTTP request. Separate from ALERT_COOLDOWN_SECONDS, which controls how
# often a REPEAT alert for the same rule is allowed to re-fire.
MONITOR_INTERVAL_SECONDS = int(os.getenv("MONITOR_INTERVAL_SECONDS", "60"))
ALERT_COOLDOWN_SECONDS = int(os.getenv("ALERT_COOLDOWN_SECONDS", "900"))

scorer = HealthScorer(config_path=os.getenv("RULES_CONFIG_FILE", "rules.yaml"))
alert_engine = AlertEngine(cooldown_seconds=ALERT_COOLDOWN_SECONDS)

# Tracks the most recent automatic monitoring cycle so /alerts/status can report
# on it -- useful for confirming the background loop is actually alive.
monitor_state: Dict[str, Any] = {
    "last_run_at": None,
    "last_health_score": None,
    "last_status": None,
    "last_alerts_sent": 0,
    "last_error": None,
    "cycle_count": 0,
}


def register_alert_channels(engine: AlertEngine) -> int:
    """Registers whichever notification channels have credentials present in the
    environment. Channels missing their required config are skipped, matching
    each channel's own no-op-when-unconfigured behavior."""
    registered = 0

    slack_url = os.getenv("SLACK_WEBHOOK_URL", "")
    if slack_url:
        engine.add_channel(SlackNotificationChannel(webhook_url=slack_url))
        registered += 1

    smtp_host = os.getenv("SMTP_HOST", "")
    recipients_raw = os.getenv("ALERT_RECIPIENT_EMAILS", "")
    if smtp_host and recipients_raw:
        recipients = [r.strip() for r in recipients_raw.split(",") if r.strip()]
        engine.add_channel(
            EmailNotificationChannel(
                smtp_host=smtp_host,
                smtp_port=int(os.getenv("SMTP_PORT", "587")),
                sender=os.getenv("ALERT_SENDER_EMAIL", "") or (os.getenv("SMTP_USER", "")),
                recipients=recipients,
                username=os.getenv("SMTP_USER", ""),
                password=os.getenv("SMTP_PASSWORD", ""),
            )
        )
        registered += 1

    webhook_url = os.getenv("GENERIC_WEBHOOK_URL", "")
    if webhook_url:
        engine.add_channel(GenericWebhookChannel(endpoint_url=webhook_url))
        registered += 1

    if registered == 0:
        logger.warning(
            "[AlertEngine] No notification channels configured (SLACK_WEBHOOK_URL / "
            "SMTP_HOST+ALERT_RECIPIENT_EMAILS / GENERIC_WEBHOOK_URL all empty). "
            "Rule breaches will be evaluated but nobody will be notified."
        )
    else:
        logger.info(f"[AlertEngine] Registered {registered} notification channel(s).")

    return registered


def run_monitoring_cycle() -> None:
    """Evaluates all rules against live metrics and dispatches alerts as needed.
    This is what makes alerting automatic: it runs on the scheduler's own timer,
    not in response to a dashboard being open or an endpoint being hit."""
    try:
        provider = get_provider(config)
        report = scorer.evaluate_all(provider)
        alerts_sent = alert_engine.process_rule_results(report.rule_results, report.health_score)

        monitor_state["last_run_at"] = report.evaluated_at
        monitor_state["last_health_score"] = report.health_score
        monitor_state["last_status"] = report.status
        monitor_state["last_alerts_sent"] = alerts_sent
        monitor_state["last_error"] = None
        monitor_state["cycle_count"] += 1

        if alerts_sent > 0:
            logger.info(
                f"[Monitor] Cycle complete: score={report.health_score} status={report.status} "
                f"alerts_sent={alerts_sent}"
            )
        else:
            logger.debug(f"[Monitor] Cycle complete: score={report.health_score} status={report.status}")
    except Exception as e:
        monitor_state["last_error"] = str(e)
        monitor_state["cycle_count"] += 1
        logger.error(f"[Monitor] Monitoring cycle failed: {e}")


scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    register_alert_channels(alert_engine)
    scheduler.add_job(
        run_monitoring_cycle,
        "interval",
        seconds=MONITOR_INTERVAL_SECONDS,
        id="ohis_monitoring_cycle",
        next_run_time=None,  # first run fires after the first interval, not instantly at startup
    )
    scheduler.start()
    # Kick off one immediate cycle too, so /alerts/status isn't empty right after boot
    run_monitoring_cycle()
    logger.info(f"[Monitor] Background monitoring loop started (every {MONITOR_INTERVAL_SECONDS}s).")
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="Oracle DB Health Monitoring API",
    description="REST API for Oracle DB Health Scores, Metrics, Alerts, and HTML Reports.",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/")
def read_root():
    return {
        "service": "Oracle Database Health Monitoring Suite",
        "status": "ONLINE",
        "endpoints": ["/health", "/metrics", "/alerts", "/alerts/status", "/report"]
    }


@app.get("/health")
def get_health_score():
    """Returns current database health score (0-100), status, and rule evaluation summary."""
    try:
        provider = get_provider(config)
        report = scorer.evaluate_all(provider)
        return report.to_dict()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Metrics collection failed: {str(e)}")


@app.get("/metrics")
def get_raw_metrics():
    """Returns raw current database metrics (sessions, tablespaces, wait events, sysstat)."""
    try:
        provider = get_provider(config)
        return {
            "active_sessions": provider.get_active_sessions(),
            "tablespaces": provider.get_tablespace_usage(),
            "wait_events": provider.get_wait_events(),
            "blocked_sessions": provider.get_blocked_sessions(),
            "sysstat_execute_count": provider.get_sysstat("execute count")
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Error fetching metrics: {str(e)}")


@app.get("/alerts")
def get_active_alerts():
    """Returns currently active WARNING and CRITICAL alerts."""
    try:
        provider = get_provider(config)
        report = scorer.evaluate_all(provider)
        alerts = [r.to_dict() for r in report.rule_results if r.severity in ("WARNING", "CRITICAL")]
        return {
            "health_score": report.health_score,
            "status": report.status,
            "active_alert_count": len(alerts),
            "alerts": alerts
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Error evaluating alerts: {str(e)}")


@app.get("/alerts/status")
def get_monitor_status():
    """Reports on the background monitoring loop itself -- confirms it's alive,
    when it last ran, and how many alerts it dispatched last cycle. Useful for
    proving to a DBA (or during handoff) that alerting is running automatically
    and isn't dependent on the dashboard or the /alerts endpoint being called."""
    return {
        "monitor_interval_seconds": MONITOR_INTERVAL_SECONDS,
        "alert_cooldown_seconds": ALERT_COOLDOWN_SECONDS,
        "registered_channels": len(alert_engine.channels),
        **monitor_state,
    }


@app.get("/report", response_class=HTMLResponse)
def get_executive_report():
    """Generates and returns standalone HTML Executive Report."""
    try:
        provider = get_provider(config)
        report = scorer.evaluate_all(provider)
        raw_metrics = {
            "tablespaces": provider.get_tablespace_usage(),
            "active_sessions": provider.get_active_sessions()
        }
        return generate_html_report(report, raw_metrics)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
