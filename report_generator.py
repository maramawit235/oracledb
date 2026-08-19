"""
Oracle Database Health Monitoring & Performance Optimization Suite
Module: report_generator.py
Description: Generates clean, production-grade standalone HTML executive reports
              summarizing Oracle DB Health Score, rule evaluation results,
              and metrics overview for management and DBAs.
Author: Bank of Abyssinia DB Monitoring Team
"""

import datetime
import html
from typing import Any, Dict, List

from rule_engine import HealthReport


def generate_html_report(report: HealthReport, metrics: Dict[str, Any]) -> str:
    """Generates a styled, standalone HTML Executive Report string."""

    badge_color = "#28a745" if report.status == "HEALTHY" else ("#ffc107" if report.status == "DEGRADED" else "#dc3545")
    
    # Format rule rows
    rule_rows_html = ""
    for r in report.rule_results:
        sev_class = "badge-ok" if r.severity == "OK" else ("badge-warn" if r.severity == "WARNING" else "badge-crit")
        rule_rows_html += f"""
        <tr>
            <td><strong>{html.escape(str(r.rule_name))}</strong><br/><small style="color:#666">{html.escape(str(r.rule_id))}</small></td>
            <td>{r.current_value} {html.escape(str(r.unit))}</td>
            <td>Warn: {r.warning_threshold}{html.escape(str(r.unit))} | Crit: {r.critical_threshold}{html.escape(str(r.unit))}</td>
            <td><span class="badge {sev_class}">{html.escape(str(r.severity))}</span></td>
            <td>{html.escape(str(r.recommendation))}</td>
        </tr>
        """

    # Format tablespaces
    tablespace_html = ""
    for ts in metrics.get("tablespaces", []):
        pct = ts["used_pct"]
        bar_color = "#28a745" if pct < 80 else ("#ffc107" if pct < 90 else "#dc3545")
        tablespace_html += f"""
        <div style="margin-bottom: 12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-weight:bold;">
                <span>{html.escape(str(ts['name']))}</span>
                <span>{pct}% Used ({ts['free_mb']} MB Free)</span>
            </div>
            <div style="background:#e9ecef; border-radius:4px; height:18px; width:100%; overflow:hidden;">
                <div style="background:{bar_color}; width:{pct}%; height:100%;"></div>
            </div>
        </div>
        """

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Oracle Database Health & Performance Report</title>
    <style>
        body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f7f6; color: #333; margin: 0; padding: 30px; }}
        .container {{ max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }}
        .header {{ display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eaeeef; padding-bottom: 20px; }}
        .title h1 {{ margin: 0; color: #1a252f; font-size: 24px; }}
        .title p {{ margin: 5px 0 0 0; color: #7f8c8d; font-size: 14px; }}
        .score-box {{ text-align: center; background: #f8f9fa; border: 2px solid #e2e8f0; border-radius: 8px; padding: 15px 25px; }}
        .score-num {{ font-size: 36px; font-weight: bold; color: {badge_color}; }}
        .status-badge {{ background: {badge_color}; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 12px; display: inline-block; margin-top: 5px; }}
        .section {{ margin-top: 30px; }}
        .section-title {{ font-size: 18px; font-weight: bold; color: #2c3e50; border-left: 4px solid #3498db; padding-left: 10px; margin-bottom: 15px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #eef2f5; font-size: 14px; }}
        th {{ background: #f8fafc; color: #475569; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }}
        .badge {{ padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; color: white; }}
        .badge-ok {{ background: #28a745; }}
        .badge-warn {{ background: #ffc107; color: #333; }}
        .badge-crit {{ background: #dc3545; }}
        .footer {{ text-align: center; margin-top: 40px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 15px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">
                <h1>Oracle DB Executive Health & Performance Report</h1>
                <p>Bank of Abyssinia Oracle 19c & XE Monitoring Suite | Evaluated: {html.escape(str(report.evaluated_at))}</p>
            </div>
            <div class="score-box">
                <div class="score-num">{report.health_score} <span style="font-size:18px; color:#999;">/100</span></div>
                <div class="status-badge">{html.escape(str(report.status))}</div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Rule Evaluation & DBA Action Items</div>
            <table>
                <thead>
                    <tr>
                        <th>Rule Name</th>
                        <th>Current Value</th>
                        <th>Thresholds</th>
                        <th>Severity</th>
                        <th>Action Plan & Recommendation</th>
                    </tr>
                </thead>
                <tbody>
                    {rule_rows_html}
                </tbody>
            </table>
        </div>

        <div class="section">
            <div class="section-title">Tablespace Capacity Utilization</div>
            {tablespace_html}
        </div>

        <div class="footer">
            Generated automatically by Bank of Abyssinia Oracle DB Health Monitoring Suite &bull; Confidential &bull; Internal Use Only
        </div>
    </div>
</body>
</html>
"""
    return html_content
