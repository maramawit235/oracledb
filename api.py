"""
Oracle Database Health Monitoring & Performance Optimization Suite
Module: api.py
Description: FastAPI REST API exposing database health endpoints, metrics queries,
              active alert summaries, and automated HTML report generation.
Author: Bank of Abyssinia DB Monitoring Team
"""

import os
from typing import Any, Dict

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse

from alert_engine import AlertEngine
from providers import get_provider
from report_generator import generate_html_report
from rule_engine import HealthScorer

app = FastAPI(
    title="Oracle DB Health Monitoring API",
    description="REST API for Oracle DB Health Scores, Metrics, Alerts, and HTML Reports.",
    version="1.0.0"
)

# Load configuration
config = {
    "PROMETHEUS_URL": os.getenv("PROMETHEUS_URL", "http://localhost:9090"),
    "ORACLE_USER": os.getenv("ORACLE_USER", "monitor"),
    "ORACLE_PASSWORD": os.getenv("ORACLE_PASSWORD", "MonitorPass123#"),
    "ORACLE_DSN": os.getenv("ORACLE_DSN", "localhost:1521/XE")
}

scorer = HealthScorer(config_path="rules.yaml")
alert_engine = AlertEngine()


@app.get("/")
def read_root():
    return {
        "service": "Oracle Database Health Monitoring Suite",
        "status": "ONLINE",
        "endpoints": ["/health", "/metrics", "/alerts", "/report"]
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
