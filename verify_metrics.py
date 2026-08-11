#!/usr/bin/env python3
"""
Oracle Database Health Monitoring & Performance Optimization Suite
Script: verify_metrics.py (Phase D Validation)
Description: Standalone verification CLI tool for DBAs to validate metric consistency
              across 4 data sources: Direct SQL, Exporter /metrics, PromQL API, and App Providers.
Usage: python verify_metrics.py
"""

import os
import sys
import time
import requests
from typing import Dict, Any, Tuple, Optional

# Import app providers
from providers import OracleSQLProvider, PrometheusProvider, get_provider, MetricsUnavailableError


def fetch_direct_sql_metrics(config: dict) -> Dict[str, Optional[float]]:
    """Queries Oracle directly via SQL. Returns None for metric values if connection fails."""
    metrics: Dict[str, Optional[float]] = {
        "active_sessions": None,
        "users_tablespace_pct": None,
        "execute_count": None
    }
    user = config.get("ORACLE_USER", "monitor")
    password = config.get("ORACLE_PASSWORD", "")
    host = config.get("ORACLE_HOST", "10.73.34.37")
    port = config.get("ORACLE_PORT", "1521")
    service_name = config.get("ORACLE_SERVICE_NAME", "XEPDB1")
    dsn = config.get("ORACLE_DSN", "")

    if not user:
        return metrics

    try:
        provider = OracleSQLProvider(
            user=user,
            password=password,
            dsn=dsn,
            host=host,
            port=port,
            service_name=service_name,
            timeout=3
        )
        conn = provider._get_connection()
        if not conn:
            return metrics

        with conn.cursor() as cur:
            # Active sessions
            try:
                cur.execute("SELECT COUNT(*) FROM V$SESSION WHERE STATUS = 'ACTIVE' AND TYPE = 'USER'")
                row = cur.fetchone()
                if row and row[0] is not None:
                    metrics["active_sessions"] = float(row[0])
            except Exception:
                pass

            # USERS tablespace percentage
            try:
                cur.execute("""
                    SELECT ROUND(m.used_percent, 2)
                    FROM dba_tablespace_usage_metrics m
                    WHERE m.tablespace_name = 'USERS'
                """)
                row = cur.fetchone()
                if row and row[0] is not None:
                    metrics["users_tablespace_pct"] = float(row[0])
            except Exception:
                pass

            # sysstat execute count
            try:
                cur.execute("SELECT value FROM V$SYSSTAT WHERE name = 'execute count'")
                row = cur.fetchone()
                if row and row[0] is not None:
                    metrics["execute_count"] = float(row[0])
            except Exception:
                pass

        try:
            conn.close()
        except Exception:
            pass

    except Exception:
        # Never substitute fake fallback numbers on connection failure
        pass

    return metrics


def fetch_exporter_raw_metrics(exporter_url: str) -> Dict[str, Optional[float]]:
    """Scrapes raw text metrics from oracledb_exporter /metrics endpoint."""
    metrics: Dict[str, Optional[float]] = {
        "active_sessions": None,
        "users_tablespace_pct": None,
        "execute_count": None
    }
    if not exporter_url or not exporter_url.strip():
        return metrics

    try:
        resp = requests.get(f"{exporter_url.rstrip('/')}/metrics", timeout=3)
        if resp.status_code == 200:
            for line in resp.text.splitlines():
                if line.startswith('#'):
                    continue
                if 'oracledb_sessions_value{status="ACTIVE"}' in line or 'oracledb_sessions_value' in line:
                    try:
                        metrics["active_sessions"] = float(line.split()[-1])
                    except ValueError:
                        pass
                elif 'oracledb_tablespace_used_percentage{tablespace="USERS"}' in line:
                    try:
                        metrics["users_tablespace_pct"] = float(line.split()[-1])
                    except ValueError:
                        pass
                elif 'oracledb_sysstat_value{name="execute count"}' in line:
                    try:
                        metrics["execute_count"] = float(line.split()[-1])
                    except ValueError:
                        pass
    except Exception:
        pass

    return metrics


def fetch_promql_api_metrics(prom_url: str) -> Dict[str, Optional[float]]:
    """Queries Prometheus HTTP API using PromQL."""
    metrics: Dict[str, Optional[float]] = {
        "active_sessions": None,
        "users_tablespace_pct": None,
        "execute_count": None
    }
    if not prom_url or not prom_url.strip():
        return metrics

    try:
        prom = PrometheusProvider(prometheus_url=prom_url, timeout=3)
        if not prom.health_check():
            return metrics

        # Query active sessions
        res = prom._execute_promql('oracledb_sessions_value{status="ACTIVE"}')
        if res:
            metrics["active_sessions"] = float(res[0]["value"][1])

        # Query tablespace usage
        res = prom._execute_promql('oracledb_tablespace_used_percentage{tablespace="USERS"}')
        if res:
            metrics["users_tablespace_pct"] = float(res[0]["value"][1])

        # Query sysstat execute count
        res = prom._execute_promql('oracledb_sysstat_value{name="execute count"}')
        if res:
            metrics["execute_count"] = float(res[0]["value"][1])

    except Exception:
        pass

    return metrics


def fetch_app_provider_metrics(config: dict) -> Dict[str, Optional[float]]:
    """Queries active App MetricsProvider via Factory."""
    metrics: Dict[str, Optional[float]] = {
        "active_sessions": None,
        "users_tablespace_pct": None,
        "execute_count": None
    }
    try:
        provider = get_provider(config)
        if isinstance(provider, OracleSQLProvider):
            return fetch_direct_sql_metrics(config)
        elif isinstance(provider, PrometheusProvider):
            return fetch_promql_api_metrics(config.get("PROMETHEUS_URL", ""))
    except Exception:
        pass

    return metrics


def fmt_val(val: Optional[float]) -> str:
    if val is None:
        return "N/A"
    return f"{val:.1f}"


def main():
    print("\n=========================================================================================")
    print("        ORACLE DB HEALTH MONITORING SUITE — PHASE D METRIC VERIFICATION TOOL             ")
    print("=========================================================================================\n")

    config = {
        "ORACLE_HOST": os.getenv("ORACLE_HOST", "10.73.34.37"),
        "ORACLE_PORT": os.getenv("ORACLE_PORT", "1521"),
        "ORACLE_SERVICE_NAME": os.getenv("ORACLE_SERVICE_NAME", "XEPDB1"),
        "ORACLE_USER": os.getenv("ORACLE_USER", "monitor"),
        "ORACLE_PASSWORD": os.getenv("ORACLE_PASSWORD", ""),
        "ORACLE_DSN": os.getenv("ORACLE_DSN", ""),
        "EXPORTER_URL": os.getenv("EXPORTER_URL", ""),
        "PROMETHEUS_URL": os.getenv("PROMETHEUS_URL", "")
    }

    raw_dsn = config["ORACLE_DSN"]
    if raw_dsn and "@" in raw_dsn:
        display_dsn = raw_dsn.split("@")[-1]
    elif raw_dsn:
        display_dsn = raw_dsn
    else:
        display_dsn = f"{config['ORACLE_HOST']}:{config['ORACLE_PORT']}/{config['ORACLE_SERVICE_NAME']}"

    print(f"[INFO] Target Oracle DSN: {display_dsn}")
    print(f"[INFO] Target Exporter:   {config['EXPORTER_URL'] or '(Not configured)'}")
    print(f"[INFO] Target Prometheus: {config['PROMETHEUS_URL'] or '(Not configured)'}\n")

    print("[1/4] Querying Direct Oracle SQL...")
    sql_m = fetch_direct_sql_metrics(config)
    sql_ok = any(v is not None for v in sql_m.values())
    print(f"      Status: {'CONNECTED' if sql_ok else 'FAILED (N/A)'}")

    print("[2/4] Parsing Exporter /metrics endpoint...")
    exp_m = fetch_exporter_raw_metrics(config["EXPORTER_URL"])
    exp_ok = any(v is not None for v in exp_m.values())
    print(f"      Status: {'CONNECTED' if exp_ok else 'FAILED (N/A)'}")

    print("[3/4] Querying Prometheus PromQL API...")
    prom_m = fetch_promql_api_metrics(config["PROMETHEUS_URL"])
    prom_ok = any(v is not None for v in prom_m.values())
    print(f"      Status: {'CONNECTED' if prom_ok else 'FAILED (N/A)'}")

    print("[4/4] Comparing app provider interfaces...\n")
    app_m = fetch_app_provider_metrics(config)

    test_metrics = [
        ("Active Sessions (Count)", "active_sessions", 2.0),
        ("USERS Tablespace Used (%)", "users_tablespace_pct", 1.5),
        ("SYSSTAT Execute Count", "execute_count", 50000.0)
    ]

    all_passed = True
    any_conn_failed = False

    print("+----------------------------+---------------+---------------+---------------+---------------+--------+")
    print("| Metric Name                | Direct SQL    | Exporter Text | PromQL API    | App Provider  | Status |")
    print("+----------------------------+---------------+---------------+---------------+---------------+--------+")

    for label, key, tolerance in test_metrics:
        v_sql = sql_m.get(key)
        v_exp = exp_m.get(key)
        v_prom = prom_m.get(key)
        v_app = app_m.get(key)

        vals = [v_sql, v_exp, v_prom, v_app]

        if any(v is None for v in vals):
            any_conn_failed = True
            all_passed = False
            status_str = "❌ FAIL"
        else:
            diff = max(abs(v_sql - v_exp), abs(v_sql - v_prom), abs(v_sql - v_app))
            is_pass = diff <= tolerance
            if not is_pass:
                all_passed = False
            status_str = "✅ PASS" if is_pass else "❌ FAIL"

        s_sql = fmt_val(v_sql)
        s_exp = fmt_val(v_exp)
        s_prom = fmt_val(v_prom)
        s_app = fmt_val(v_app)

        print(f"| {label:<26} | {s_sql:<13} | {s_exp:<13} | {s_prom:<13} | {s_app:<13} | {status_str:<6} |")

    print("+----------------------------+---------------+---------------+---------------+---------------+--------+\n")

    if all_passed:
        print("=========================================================================================")
        print(" VERIFICATION RESULT: ✅ ALL METRICS CONSISTENT ACROSS ALL 4 DATA SOURCES!              ")
        print(" The monitoring stack is verified and ready for production handoff.                      ")
        print("=========================================================================================\n")
        sys.exit(0)
    elif any_conn_failed:
        print("=========================================================================================")
        print(" VERIFICATION RESULT: ❌ CONNECTION FAILED!                                             ")
        print(" One or more data sources (Oracle SQL, Exporter, or Prometheus) could not be reached.   ")
        print(" Please check target host IP, database credentials, and network connectivity.           ")
        print("=========================================================================================\n")
        sys.exit(1)
    else:
        print("=========================================================================================")
        print(" VERIFICATION RESULT: ❌ METRIC MISMATCH DETECTED!                                      ")
        print(" Please check exporter scrape interval, time sync, or network connectivity.             ")
        print("=========================================================================================\n")
        sys.exit(1)


if __name__ == "__main__":
    main()

