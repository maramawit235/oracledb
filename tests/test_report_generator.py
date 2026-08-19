"""
Unit tests for report_generator.py HTML Executive Report generator.
"""

import pytest
from typing import Any, Dict
from report_generator import generate_html_report
from rule_engine import HealthReport, RuleResult


def make_rule_result(
    rule_id: str = "RULE_TABLESPACE_USERS",
    rule_name: str = "USERS Tablespace Capacity",
    metric_type: str = "tablespace",
    current_value: float = 88.0,
    unit: str = "%",
    warning_threshold: float = 85.0,
    critical_threshold: float = 95.0,
    weight: float = 25.0,
    severity: str = "WARNING",
    recommendation: str = "Resize datafile or purge historical partitions in USERS tablespace.",
    message: str = "WARNING: USERS Tablespace Capacity (88.0%) breached threshold.",
) -> RuleResult:
    """Helper to construct RuleResult objects with realistic defaults."""
    return RuleResult(
        rule_id=rule_id,
        rule_name=rule_name,
        metric_type=metric_type,
        current_value=current_value,
        unit=unit,
        warning_threshold=warning_threshold,
        critical_threshold=critical_threshold,
        weight=weight,
        severity=severity,
        recommendation=recommendation,
        message=message,
    )


def make_health_report(
    health_score: float = 100.0,
    status: str = "HEALTHY",
    evaluated_at: str = "2026-08-18T14:30:00Z",
    total_rules: int = 1,
    warning_count: int = 0,
    critical_count: int = 0,
    rule_results: list = None,
) -> HealthReport:
    """Helper to construct HealthReport objects with realistic defaults."""
    if rule_results is None:
        rule_results = []
    return HealthReport(
        health_score=health_score,
        status=status,
        evaluated_at=evaluated_at,
        total_rules=total_rules,
        warning_count=warning_count,
        critical_count=critical_count,
        rule_results=rule_results,
    )


class TestReportGenerator:
    """Test suite for generate_html_report."""

    def test_generate_report_healthy(self):
        """1. Test generating a report from a HEALTHY result (no breaches)."""
        rule_ok = make_rule_result(
            rule_id="RULE_TABLESPACE_USERS",
            rule_name="USERS Tablespace Capacity",
            current_value=65.0,
            severity="OK",
            recommendation="No action required.",
            message="OK: USERS Tablespace Capacity (65.0%) is within normal operating threshold.",
        )
        report = make_health_report(
            health_score=100.0,
            status="HEALTHY",
            evaluated_at="2026-08-18T10:00:00Z",
            total_rules=1,
            warning_count=0,
            critical_count=0,
            rule_results=[rule_ok],
        )
        metrics = {
            "tablespaces": [
                {"name": "SYSTEM", "used_pct": 60.0, "free_mb": 4000.0, "total_mb": 10000.0},
                {"name": "USERS", "used_pct": 65.0, "free_mb": 3500.0, "total_mb": 10000.0},
            ]
        }

        html = generate_html_report(report, metrics)

        assert isinstance(html, str)
        assert len(html) > 0
        assert "HEALTHY" in html
        assert "100" in html
        assert "USERS Tablespace Capacity" in html

    def test_generate_report_warning_breach(self):
        """2. Test generating a report with at least one WARNING-severity rule breach."""
        rule_warn = make_rule_result(
            rule_id="RULE_TABLESPACE_USERS",
            rule_name="USERS Tablespace Capacity",
            current_value=88.5,
            severity="WARNING",
            recommendation="Add datafile to USERS tablespace immediately.",
            message="WARNING: USERS Tablespace Capacity (88.5%) exceeded warning threshold of 85.0%.",
        )
        report = make_health_report(
            health_score=87.5,
            status="DEGRADED",
            evaluated_at="2026-08-18T11:00:00Z",
            total_rules=1,
            warning_count=1,
            critical_count=0,
            rule_results=[rule_warn],
        )
        metrics = {"tablespaces": [{"name": "USERS", "used_pct": 88.5, "free_mb": 1150.0, "total_mb": 10000.0}]}

        html = generate_html_report(report, metrics)

        assert "USERS Tablespace Capacity" in html
        assert "WARNING" in html
        assert "88.5" in html
        assert "Add datafile to USERS tablespace immediately." in html

    def test_generate_report_critical_breach(self):
        """3. Test generating a report with at least one CRITICAL-severity rule breach."""
        rule_crit = make_rule_result(
            rule_id="RULE_ACTIVE_SESSIONS",
            rule_name="Active Database Sessions",
            metric_type="active_sessions",
            current_value=92.0,
            unit="sessions",
            warning_threshold=40.0,
            critical_threshold=80.0,
            severity="CRITICAL",
            recommendation="Check V$SESSION for runaway queries and terminate blocking sessions.",
            message="CRITICAL: Active Database Sessions (92.0 sessions) exceeded critical threshold of 80.0 sessions!",
        )
        report = make_health_report(
            health_score=55.0,
            status="CRITICAL",
            evaluated_at="2026-08-18T12:00:00Z",
            total_rules=1,
            warning_count=0,
            critical_count=1,
            rule_results=[rule_crit],
        )
        metrics = {"active_sessions": 92}

        html = generate_html_report(report, metrics)

        assert "Active Database Sessions" in html
        assert "CRITICAL" in html
        assert "92.0" in html
        assert "Check V$SESSION for runaway queries and terminate blocking sessions." in html

    def test_generate_report_zero_rule_breaches(self):
        """4. Test generating a report with ZERO rule results (empty list) without crashing."""
        report = make_health_report(
            health_score=100.0,
            status="HEALTHY",
            evaluated_at="2026-08-18T13:00:00Z",
            total_rules=0,
            warning_count=0,
            critical_count=0,
            rule_results=[],
        )
        metrics: Dict[str, Any] = {}

        html = generate_html_report(report, metrics)

        assert isinstance(html, str)
        assert len(html) > 0
        assert "HEALTHY" in html
        assert "100" in html

    def test_generate_report_multiple_simultaneous_breaches(self):
        """5. Test report with MULTIPLE simultaneous breaches (mixed WARNING and CRITICAL)."""
        rule_1 = make_rule_result(
            rule_id="RULE_TABLESPACE_USERS",
            rule_name="USERS Tablespace Capacity",
            current_value=87.0,
            severity="WARNING",
            recommendation="Purge historical partitions in USERS tablespace.",
        )
        rule_2 = make_rule_result(
            rule_id="RULE_BLOCKED_SESSIONS",
            rule_name="Row Lock Contention",
            metric_type="blocked_sessions",
            current_value=6.0,
            unit="blocked sessions",
            warning_threshold=1.0,
            critical_threshold=3.0,
            severity="CRITICAL",
            recommendation="Identify blocking SID via V$LOCK and terminate blocking session immediately.",
        )
        rule_3 = make_rule_result(
            rule_id="RULE_WAIT_EVENT_LATENCY",
            rule_name="Top System Wait Event Latency",
            metric_type="wait_event",
            current_value=320.5,
            unit="ms",
            severity="OK",
            recommendation="No action required.",
        )
        report = make_health_report(
            health_score=62.5,
            status="CRITICAL",
            evaluated_at="2026-08-18T14:00:00Z",
            total_rules=3,
            warning_count=1,
            critical_count=1,
            rule_results=[rule_1, rule_2, rule_3],
        )
        metrics = {
            "tablespaces": [
                {"name": "USERS", "used_pct": 87.0, "free_mb": 1300.0, "total_mb": 10000.0},
            ]
        }

        html = generate_html_report(report, metrics)

        # Confirm all 3 rules appear
        assert "USERS Tablespace Capacity" in html
        assert "Row Lock Contention" in html
        assert "Top System Wait Event Latency" in html

        # Confirm severities appear
        assert "WARNING" in html
        assert "CRITICAL" in html
        assert "OK" in html

        # Confirm values appear
        assert "87.0" in html
        assert "6.0" in html
        assert "320.5" in html

        # Confirm recommendations appear
        assert "Purge historical partitions in USERS tablespace." in html
        assert "Identify blocking SID via V$LOCK and terminate blocking session immediately." in html

    def test_generate_report_html_structure_validity(self):
        """6. Test confirming the output is valid, well-formed HTML."""
        report = make_health_report()
        metrics = {"tablespaces": [{"name": "SYSTEM", "used_pct": 50.0, "free_mb": 5000.0, "total_mb": 10000.0}]}

        html = generate_html_report(report, metrics)

        assert html.strip().startswith("<!DOCTYPE html>")
        assert "<html" in html
        assert "</html>" in html
        assert "<head>" in html
        assert "</head>" in html
        assert "<body>" in html
        assert "</body>" in html
        assert "<table" in html
        assert "</table>" in html

    def test_generate_report_special_characters_handling(self):
        """7. Test special characters (quotes, ampersands, percent signs) in rules."""
        rule_special = make_rule_result(
            rule_id="RULE_SPECIAL_TEST",
            rule_name="SYSTEM & USERS Tablespace's Storage",
            current_value=99.9,
            unit="%",
            severity="CRITICAL",
            recommendation="Don't allow SYSTEM & USERS storage to reach 100% capacity; execute 'ALTER TABLESPACE ADD DATAFILE'.",
            message="CRITICAL: SYSTEM & USERS storage reached 99.9% > 90.0% threshold.",
        )
        report = make_health_report(
            health_score=40.0,
            status="CRITICAL",
            evaluated_at="2026-08-18T15:00:00Z",
            total_rules=1,
            warning_count=0,
            critical_count=1,
            rule_results=[rule_special],
        )
        metrics = {}

        html = generate_html_report(report, metrics)

        import html as html_module
        assert html_module.escape("SYSTEM & USERS Tablespace's Storage") in html
        assert html_module.escape("Don't allow SYSTEM & USERS storage to reach 100% capacity; execute 'ALTER TABLESPACE ADD DATAFILE'.") in html
        # Also confirm the RAW unescaped ampersand does NOT appear on its own (would indicate escaping failed)
        assert "Tablespace's Storage" not in html or "Tablespace&#x27;s Storage" in html or "Tablespace&#39;s Storage" in html
        assert "99.9 %" in html or "99.9" in html
        assert "CRITICAL" in html

    def test_generate_report_prevents_html_injection(self):
        """Confirms a rule name/recommendation containing HTML tags can't inject markup into the report."""
        malicious_rule = make_rule_result(
            rule_id="RULE_INJECTION_TEST",
            rule_name="<script>alert('xss')</script>",
            current_value=50.0,
            unit="%",
            severity="WARNING",
            recommendation="<img src=x onerror=alert(1)>",
            message="test",
        )
        report = make_health_report(
            health_score=70.0,
            status="DEGRADED",
            evaluated_at="2026-08-18T15:00:00Z",
            total_rules=1,
            warning_count=1,
            critical_count=0,
            rule_results=[malicious_rule],
        )
        html_output = generate_html_report(report, {})

        # The raw, unescaped tag must NOT appear -- if it does, injection succeeded
        assert "<script>alert('xss')</script>" not in html_output
        assert "<img src=x onerror=alert(1)>" not in html_output
        # The escaped, harmless version should appear instead
        assert "&lt;script&gt;" in html_output

    def test_generate_report_evaluated_at_timestamp(self):
        """8. Test confirming timestamp / evaluated_at appears in the rendered output."""
        custom_timestamp = "2026-08-18T23:59:59.999999Z"
        report = make_health_report(evaluated_at=custom_timestamp)
        metrics = {}

        html = generate_html_report(report, metrics)

        assert custom_timestamp in html
        assert f"Evaluated: {custom_timestamp}" in html
