"""
Oracle Database Health Monitoring & Performance Optimization Suite
Module: rule_engine.py
Description: Evaluates metrics against rules defined in rules.yaml,
              calculates a 0-100 overall database health score, and provides
              actionable DBA recommendations for any breaches.
Author: Bank of Abyssinia DB Monitoring Team
"""

import json
import logging
import os
from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional

import yaml

from providers import MetricsProvider

logger = logging.getLogger(__name__)


@dataclass
class RuleResult:
    rule_id: str
    rule_name: str
    metric_type: str
    current_value: float
    unit: str
    warning_threshold: float
    critical_threshold: float
    weight: float
    severity: str  # "OK", "WARNING", "CRITICAL"
    recommendation: str
    message: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class HealthReport:
    health_score: float  # 0 to 100
    status: str          # "HEALTHY", "DEGRADED", "CRITICAL"
    evaluated_at: str
    total_rules: int
    warning_count: int
    critical_count: int
    rule_results: List[RuleResult]

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["rule_results"] = [r.to_dict() for r in self.rule_results]
        return d


class HealthScorer:
    """Evaluates rules against provider metrics and calculates overall DB Health Score."""

    def __init__(self, config_path: str = "rules.yaml"):
        self.config_path = config_path
        self.rules_config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        """Loads rules configuration from YAML or JSON file."""
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r") as f:
                    if self.config_path.endswith(".json"):
                        return json.load(f)
                    return yaml.safe_load(f)
            except Exception as e:
                logger.error(f"[HealthScorer] Failed loading {self.config_path}: {e}")

        # Fallback default configuration if file read fails
        return {
            "settings": {"base_health_score": 100, "warning_penalty_factor": 0.5, "critical_penalty_factor": 1.0},
            "rules": [
                {
                    "id": "RULE_TABLESPACE_USERS",
                    "name": "USERS Tablespace Capacity",
                    "metric_type": "tablespace",
                    "target": "USERS",
                    "warning_threshold": 85.0,
                    "critical_threshold": 95.0,
                    "weight": 25.0,
                    "unit": "%",
                    "recommendation": "Resize datafile or purge historical partitions in USERS tablespace."
                },
                {
                    "id": "RULE_ACTIVE_SESSIONS",
                    "name": "Active Sessions Count",
                    "metric_type": "active_sessions",
                    "target": "global",
                    "warning_threshold": 25.0,
                    "critical_threshold": 50.0,
                    "weight": 20.0,
                    "unit": "sessions",
                    "recommendation": "Check V$SESSION for long-running unindexed queries."
                },
                {
                    "id": "RULE_BLOCKED_SESSIONS",
                    "name": "Locking / Enqueue Contention",
                    "metric_type": "blocked_sessions",
                    "target": "global",
                    "warning_threshold": 1.0,
                    "critical_threshold": 5.0,
                    "weight": 25.0,
                    "unit": "blocked sessions",
                    "recommendation": "Identify blocking SID via V$LOCK and consider killing session."
                }
            ]
        }

    def evaluate_all(self, provider: MetricsProvider) -> HealthReport:
        """Runs every configured rule against the metrics provider and calculates the overall health score."""
        import datetime
        
        rules = self.rules_config.get("rules", [])
        results: List[RuleResult] = []

        # Fetch provider metrics
        try:
            active_sessions = provider.get_active_sessions()
            tablespaces = provider.get_tablespace_usage()
            wait_events = provider.get_wait_events()
            blocked_sessions = provider.get_blocked_sessions()
        except Exception as e:
            logger.error(f"[HealthScorer] Error gathering metrics from provider: {e}")
            active_sessions = 0
            tablespaces = []
            wait_events = []
            blocked_sessions = []

        total_penalty = 0.0
        warning_count = 0
        critical_count = 0

        for r in rules:
            rule_id = r["id"]
            metric_type = r["metric_type"]
            target = r.get("target", "global")
            warn_t = float(r["warning_threshold"])
            crit_t = float(r["critical_threshold"])
            weight = float(r["weight"])
            unit = r.get("unit", "")
            rec = r["recommendation"]

            val = 0.0
            if metric_type == "active_sessions":
                val = float(active_sessions)
            elif metric_type == "blocked_sessions":
                val = float(len(blocked_sessions))
            elif metric_type == "tablespace":
                ts_match = next((t for t in tablespaces if t["name"] == target), None)
                val = float(ts_match["used_pct"]) if ts_match else 0.0
            elif metric_type == "wait_event":
                top_wait = max((w["total_wait_time_ms"] for w in wait_events), default=0.0)
                val = float(top_wait)

            # Determine severity
            severity = "OK"
            if val >= crit_t:
                severity = "CRITICAL"
                critical_count += 1
                total_penalty += weight * 1.0
                msg = f"CRITICAL: {r['name']} ({val}{unit}) exceeded critical threshold of {crit_t}{unit}!"
            elif val >= warn_t:
                severity = "WARNING"
                warning_count += 1
                total_penalty += weight * 0.5
                msg = f"WARNING: {r['name']} ({val}{unit}) exceeded warning threshold of {warn_t}{unit}."
            else:
                msg = f"OK: {r['name']} ({val}{unit}) is within normal operating threshold."

            results.append(
                RuleResult(
                    rule_id=rule_id,
                    rule_name=r["name"],
                    metric_type=metric_type,
                    current_value=round(val, 2),
                    unit=unit,
                    warning_threshold=warn_t,
                    critical_threshold=crit_t,
                    weight=weight,
                    severity=severity,
                    recommendation=rec if severity != "OK" else "No action required.",
                    message=msg
                )
            )

        # Health score calculation: 100 - penalties, bounded [0, 100]
        health_score = max(0.0, min(100.0, 100.0 - total_penalty))
        
        status = "HEALTHY"
        if health_score < 70.0 or critical_count > 0:
            status = "CRITICAL"
        elif health_score < 88.0 or warning_count > 0:
            status = "DEGRADED"

        return HealthReport(
            health_score=round(health_score, 1),
            status=status,
            evaluated_at=datetime.datetime.now().isoformat(),
            total_rules=len(rules),
            warning_count=warning_count,
            critical_count=critical_count,
            rule_results=results
        )
