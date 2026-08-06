import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
app.use(express.json());

const PORT = 3000;

// Application state for simulation
let currentProviderMode: "PROMETHEUS" | "ORACLE_SQL" | "FALLBACK_AUTO" = "FALLBACK_AUTO";
let activeProvider: "PrometheusProvider" | "OracleSQLProvider" = "PrometheusProvider";
let simulatedLoadScenario: "NORMAL" | "HIGH_IO_WAIT" | "LOCK_CONTENTION" | "TABLESPACE_CRITICAL" = "NORMAL";

// Base Mock Metrics Generator based on scenario
function getSimulatedMetrics() {
  switch (simulatedLoadScenario) {
    case "HIGH_IO_WAIT":
      return {
        active_sessions: 22,
        tablespaces: [
          { name: "SYSTEM", used_pct: 68.5, free_mb: 3150.0, total_mb: 10000.0 },
          { name: "SYSAUX", used_pct: 74.2, free_mb: 2580.0, total_mb: 10000.0 },
          { name: "USERS", used_pct: 82.1, free_mb: 1790.0, total_mb: 10000.0 },
          { name: "UNDOTBS1", used_pct: 45.0, free_mb: 5500.0, total_mb: 10000.0 }
        ],
        wait_events: [
          { event_name: "db file sequential read", wait_count: 34200, total_wait_time_ms: 1850.5 },
          { event_name: "log file sync", wait_count: 12400, total_wait_time_ms: 920.2 },
          { event_name: "latch: shared pool", wait_count: 2100, total_wait_time_ms: 210.0 }
        ],
        blocked_sessions: [],
        sysstat_execute_count: 3410200
      };

    case "LOCK_CONTENTION":
      return {
        active_sessions: 38,
        tablespaces: [
          { name: "SYSTEM", used_pct: 68.5, free_mb: 3150.0, total_mb: 10000.0 },
          { name: "SYSAUX", used_pct: 74.2, free_mb: 2580.0, total_mb: 10000.0 },
          { name: "USERS", used_pct: 84.0, free_mb: 1600.0, total_mb: 10000.0 }
        ],
        wait_events: [
          { event_name: "enq: TX - row lock contention", wait_count: 8500, total_wait_time_ms: 2400.0 },
          { event_name: "db file sequential read", wait_count: 9200, total_wait_time_ms: 410.0 }
        ],
        blocked_sessions: [
          { blocked_sid: 142, blocking_sid: 88, wait_event: "enq: TX - row lock contention", sec_in_wait: 120 },
          { blocked_sid: 145, blocking_sid: 88, wait_event: "enq: TX - row lock contention", sec_in_wait: 95 },
          { blocked_sid: 150, blocking_sid: 142, wait_event: "enq: TX - row lock contention", sec_in_wait: 45 },
          { blocked_sid: 162, blocking_sid: 88, wait_event: "enq: TX - row lock contention", sec_in_wait: 30 },
          { blocked_sid: 178, blocking_sid: 88, wait_event: "enq: TX - row lock contention", sec_in_wait: 15 },
          { blocked_sid: 189, blocking_sid: 142, wait_event: "enq: TX - row lock contention", sec_in_wait: 10 }
        ],
        sysstat_execute_count: 1820400
      };

    case "TABLESPACE_CRITICAL":
      return {
        active_sessions: 15,
        tablespaces: [
          { name: "SYSTEM", used_pct: 89.2, free_mb: 1080.0, total_mb: 10000.0 },
          { name: "SYSAUX", used_pct: 81.5, free_mb: 1850.0, total_mb: 10000.0 },
          { name: "USERS", used_pct: 96.8, free_mb: 320.0, total_mb: 10000.0 },
          { name: "UNDOTBS1", used_pct: 60.0, free_mb: 4000.0, total_mb: 10000.0 }
        ],
        wait_events: [
          { event_name: "db file sequential read", wait_count: 11200, total_wait_time_ms: 480.0 },
          { event_name: "log file sync", wait_count: 3200, total_wait_time_ms: 190.0 }
        ],
        blocked_sessions: [],
        sysstat_execute_count: 2150000
      };

    case "NORMAL":
    default:
      return {
        active_sessions: 11,
        tablespaces: [
          { name: "SYSTEM", used_pct: 68.5, free_mb: 3150.0, total_mb: 10000.0 },
          { name: "SYSAUX", used_pct: 74.2, free_mb: 2580.0, total_mb: 10000.0 },
          { name: "USERS", used_pct: 78.4, free_mb: 2160.0, total_mb: 10000.0 },
          { name: "UNDOTBS1", used_pct: 35.0, free_mb: 6500.0, total_mb: 10000.0 }
        ],
        wait_events: [
          { event_name: "db file sequential read", wait_count: 8420, total_wait_time_ms: 320.5 },
          { event_name: "log file sync", wait_count: 3100, total_wait_time_ms: 125.2 },
          { event_name: "latch: shared pool", wait_count: 920, total_wait_time_ms: 44.0 }
        ],
        blocked_sessions: [],
        sysstat_execute_count: 1250000
      };
  }
}

// Rule Evaluator function
function evaluateHealthRules(metrics: ReturnType<typeof getSimulatedMetrics>) {
  const rules = [
    {
      id: "RULE_TABLESPACE_USERS",
      name: "USERS Tablespace Capacity",
      metric_type: "tablespace",
      target: "USERS",
      warn_t: 85.0,
      crit_t: 95.0,
      weight: 25.0,
      unit: "%",
      rec: "Resize datafile or add new datafile to USERS tablespace. Purge or compress historical partition data."
    },
    {
      id: "RULE_TABLESPACE_SYSTEM",
      name: "SYSTEM Tablespace Capacity",
      metric_type: "tablespace",
      target: "SYSTEM",
      warn_t: 85.0,
      crit_t: 92.0,
      weight: 20.0,
      unit: "%",
      rec: "Investigate audit trail growth (AUD$) or system object fragmentation. Do not allow SYSTEM tablespace to fill up."
    },
    {
      id: "RULE_ACTIVE_SESSIONS",
      name: "Active Database Sessions",
      metric_type: "active_sessions",
      target: "global",
      warn_t: 25.0,
      crit_t: 50.0,
      weight: 20.0,
      unit: "sessions",
      rec: "Check V$SESSION for unindexed queries, runaway loops, or connection pool leakage from application servers."
    },
    {
      id: "RULE_BLOCKED_SESSIONS",
      name: "Row Lock / Enqueue Contention",
      metric_type: "blocked_sessions",
      target: "global",
      warn_t: 1.0,
      crit_t: 5.0,
      weight: 25.0,
      unit: "blocked sessions",
      rec: "Identify blocking SID via V$LOCK and consider terminating blocking uncommitted session (ALTER SYSTEM KILL SESSION)."
    },
    {
      id: "RULE_WAIT_EVENT_LATENCY",
      name: "Top System Wait Event Latency",
      metric_type: "wait_event",
      target: "global",
      warn_t: 500.0,
      crit_t: 1500.0,
      weight: 10.0,
      unit: "ms",
      rec: "High I/O wait latency detected. Tune slow SQL_IDs causing excessive physical reads or optimize redo log buffer size."
    }
  ];

  let totalPenalty = 0;
  let warningCount = 0;
  let criticalCount = 0;

  const ruleResults = rules.map((r) => {
    let val = 0;
    if (r.metric_type === "active_sessions") {
      val = metrics.active_sessions;
    } else if (r.metric_type === "blocked_sessions") {
      val = metrics.blocked_sessions.length;
    } else if (r.metric_type === "tablespace") {
      const ts = metrics.tablespaces.find((t) => t.name === r.target);
      val = ts ? ts.used_pct : 0;
    } else if (r.metric_type === "wait_event") {
      val = Math.max(...metrics.wait_events.map((w) => w.total_wait_time_ms), 0);
    }

    let severity: "OK" | "WARNING" | "CRITICAL" = "OK";
    let msg = `OK: ${r.name} (${val}${r.unit}) is within normal operating threshold.`;

    if (val >= r.crit_t) {
      severity = "CRITICAL";
      criticalCount++;
      totalPenalty += r.weight * 1.0;
      msg = `CRITICAL: ${r.name} (${val}${r.unit}) exceeded critical threshold of ${r.crit_t}${r.unit}!`;
    } else if (val >= r.warn_t) {
      severity = "WARNING";
      warningCount++;
      totalPenalty += r.weight * 0.5;
      msg = `WARNING: ${r.name} (${val}${r.unit}) exceeded warning threshold of ${r.warn_t}${r.unit}.`;
    }

    return {
      rule_id: r.id,
      rule_name: r.name,
      metric_type: r.metric_type,
      current_value: Math.round(val * 10) / 10,
      unit: r.unit,
      warning_threshold: r.warn_t,
      critical_threshold: r.crit_t,
      weight: r.weight,
      severity,
      recommendation: severity !== "OK" ? r.rec : "No action required.",
      message: msg
    };
  });

  const healthScore = Math.max(0, Math.min(100, Math.round((100 - totalPenalty) * 10) / 10));
  let status: "HEALTHY" | "DEGRADED" | "CRITICAL" = "HEALTHY";
  if (healthScore < 70 || criticalCount > 0) status = "CRITICAL";
  else if (healthScore < 88 || warningCount > 0) status = "DEGRADED";

  return {
    health_score: healthScore,
    status,
    evaluated_at: new Date().toISOString(),
    total_rules: rules.length,
    warning_count: warningCount,
    critical_count: criticalCount,
    rule_results: ruleResults
  };
}

// ------------------------------------------------------------------------------
// API ENDPOINTS
// ------------------------------------------------------------------------------

app.get("/api/health", (req, res) => {
  const metrics = getSimulatedMetrics();
  const evaluation = evaluateHealthRules(metrics);
  res.json({
    provider_mode: currentProviderMode,
    active_provider: activeProvider,
    scenario: simulatedLoadScenario,
    ...evaluation
  });
});

app.get("/api/metrics", (req, res) => {
  const metrics = getSimulatedMetrics();
  res.json({
    provider_mode: currentProviderMode,
    active_provider: activeProvider,
    scenario: simulatedLoadScenario,
    ...metrics
  });
});

app.post("/api/metrics/scenario", (req, res) => {
  const { scenario } = req.body;
  if (["NORMAL", "HIGH_IO_WAIT", "LOCK_CONTENTION", "TABLESPACE_CRITICAL"].includes(scenario)) {
    simulatedLoadScenario = scenario;
    res.json({ success: true, scenario: simulatedLoadScenario });
  } else {
    res.status(400).json({ error: "Invalid scenario" });
  }
});

app.get("/api/provider/status", (req, res) => {
  res.json({
    mode: currentProviderMode,
    active_provider: activeProvider,
    prometheus_reachable: currentProviderMode !== "ORACLE_SQL",
    oracle_reachable: true
  });
});

app.post("/api/provider/toggle", (req, res) => {
  const { mode } = req.body;
  if (["PROMETHEUS", "ORACLE_SQL", "FALLBACK_AUTO"].includes(mode)) {
    currentProviderMode = mode;
    activeProvider = mode === "ORACLE_SQL" ? "OracleSQLProvider" : "PrometheusProvider";
    res.json({ success: true, mode: currentProviderMode, active_provider: activeProvider });
  } else {
    res.status(400).json({ error: "Invalid provider mode" });
  }
});

app.get("/api/verify", (req, res) => {
  const metrics = getSimulatedMetrics();

  const comparison = [
    {
      label: "Active Sessions (Count)",
      direct_sql: metrics.active_sessions,
      exporter_text: metrics.active_sessions,
      promql_api: metrics.active_sessions,
      app_provider: metrics.active_sessions,
      tolerance: 2.0,
      status: "PASS"
    },
    {
      label: "USERS Tablespace Used (%)",
      direct_sql: metrics.tablespaces.find((t) => t.name === "USERS")?.used_pct || 78.4,
      exporter_text: metrics.tablespaces.find((t) => t.name === "USERS")?.used_pct || 78.4,
      promql_api: metrics.tablespaces.find((t) => t.name === "USERS")?.used_pct || 78.4,
      app_provider: metrics.tablespaces.find((t) => t.name === "USERS")?.used_pct || 78.4,
      tolerance: 1.5,
      status: "PASS"
    },
    {
      label: "SYSSTAT Execute Count",
      direct_sql: metrics.sysstat_execute_count,
      exporter_text: metrics.sysstat_execute_count,
      promql_api: metrics.sysstat_execute_count,
      app_provider: metrics.sysstat_execute_count,
      tolerance: 50000.0,
      status: "PASS"
    }
  ];

  res.json({
    verified_at: new Date().toISOString(),
    all_passed: true,
    sources_checked: [
      "Direct Oracle SQL (thin mode)",
      "Exporter /metrics endpoint",
      "Prometheus PromQL API",
      "App MetricsProvider Interface"
    ],
    comparison
  });
});

app.get("/api/alerts", (req, res) => {
  const metrics = getSimulatedMetrics();
  const evalReport = evaluateHealthRules(metrics);
  const activeAlerts = evalReport.rule_results.filter((r) => r.severity !== "OK");

  res.json({
    health_score: evalReport.health_score,
    status: evalReport.status,
    active_alert_count: activeAlerts.length,
    alerts: activeAlerts
  });
});

app.post("/api/alerts/test", (req, res) => {
  const { channel, rule_id } = req.body;
  const metrics = getSimulatedMetrics();
  const evalReport = evaluateHealthRules(metrics);
  const targetRule = evalReport.rule_results.find((r) => r.rule_id === rule_id) || evalReport.rule_results[0];

  res.json({
    success: true,
    channel,
    timestamp: new Date().toISOString(),
    rule_id: targetRule.rule_id,
    severity: targetRule.severity,
    dispatch_status: "DELIVERED",
    cooldown_active: false,
    message: `Alert dispatched successfully via ${channel} for ${targetRule.rule_name}.`
  });
});

app.get("/api/report/html", (req, res) => {
  const metrics = getSimulatedMetrics();
  const report = evaluateHealthRules(metrics);

  const badgeColor = report.status === "HEALTHY" ? "#28a745" : report.status === "DEGRADED" ? "#ffc107" : "#dc3545";

  let ruleRows = "";
  report.rule_results.forEach((r) => {
    const sevClass = r.severity === "OK" ? "badge-ok" : r.severity === "WARNING" ? "badge-warn" : "badge-crit";
    ruleRows += `
    <tr>
        <td><strong>${r.rule_name}</strong><br/><small style="color:#666">${r.rule_id}</small></td>
        <td>${r.current_value} ${r.unit}</td>
        <td>Warn: ${r.warning_threshold}${r.unit} | Crit: ${r.critical_threshold}${r.unit}</td>
        <td><span class="badge ${sevClass}">${r.severity}</span></td>
        <td>${r.recommendation}</td>
    </tr>
    `;
  });

  let tsRows = "";
  metrics.tablespaces.forEach((ts) => {
    const barColor = ts.used_pct < 80 ? "#28a745" : ts.used_pct < 90 ? "#ffc107" : "#dc3545";
    tsRows += `
    <div style="margin-bottom: 12px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-weight:bold;">
            <span>${ts.name}</span>
            <span>${ts.used_pct}% Used (${ts.free_mb} MB Free)</span>
        </div>
        <div style="background:#e9ecef; border-radius:4px; height:18px; width:100%; overflow:hidden;">
            <div style="background:${barColor}; width:${ts.used_pct}%; height:100%;"></div>
        </div>
    </div>
    `;
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Oracle Database Health & Performance Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f4f7f6; color: #333; margin: 0; padding: 30px; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eaeeef; padding-bottom: 20px; }
        .title h1 { margin: 0; color: #1a252f; font-size: 24px; }
        .title p { margin: 5px 0 0 0; color: #7f8c8d; font-size: 14px; }
        .score-box { text-align: center; background: #f8f9fa; border: 2px solid #e2e8f0; border-radius: 8px; padding: 15px 25px; }
        .score-num { font-size: 36px; font-weight: bold; color: ${badgeColor}; }
        .status-badge { background: ${badgeColor}; color: white; padding: 4px 12px; border-radius: 12px; font-weight: bold; font-size: 12px; display: inline-block; margin-top: 5px; }
        .section { margin-top: 30px; }
        .section-title { font-size: 18px; font-weight: bold; color: #2c3e50; border-left: 4px solid #3498db; padding-left: 10px; margin-bottom: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eef2f5; font-size: 14px; }
        th { background: #f8fafc; color: #475569; text-transform: uppercase; font-size: 12px; letter-spacing: 0.5px; }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; color: white; }
        .badge-ok { background: #28a745; }
        .badge-warn { background: #ffc107; color: #333; }
        .badge-crit { background: #dc3545; }
        .footer { text-align: center; margin-top: 40px; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">
                <h1>Oracle DB Executive Health & Performance Report</h1>
                <p>Bank of Abyssinia Oracle 19c & XE Monitoring Suite | Evaluated: ${report.evaluated_at}</p>
            </div>
            <div class="score-box">
                <div class="score-num">${report.health_score} <span style="font-size:18px; color:#999;">/100</span></div>
                <div class="status-badge">${report.status}</div>
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
                    ${ruleRows}
                </tbody>
            </table>
        </div>

        <div class="section">
            <div class="section-title">Tablespace Capacity Utilization</div>
            ${tsRows}
        </div>

        <div class="footer">
            Generated automatically by Bank of Abyssinia Oracle DB Health Monitoring Suite &bull; Confidential &bull; Internal Use Only
        </div>
    </div>
</body>
</html>`;

  res.send(html);
});

// File list endpoint
app.get("/api/files", (req, res) => {
  const projectFiles = [
    { name: "create_monitoring_user.sql", path: "/create_monitoring_user.sql", type: "sql", category: "Part 1: SQL User Script" },
    { name: "providers.py", path: "/providers.py", type: "python", category: "Part 2: MetricsProvider Layer" },
    { name: "verify_metrics.py", path: "/verify_metrics.py", type: "python", category: "Part 3: Phase D Verification CLI" },
    { name: "rules.yaml", path: "/rules.yaml", type: "yaml", category: "Part 4: Rule Engine Config" },
    { name: "rule_engine.py", path: "/rule_engine.py", type: "python", category: "Part 4: Rule Engine Logic" },
    { name: "alert_engine.py", path: "/alert_engine.py", type: "python", category: "Part 5: Alert Engine" },
    { name: "report_generator.py", path: "/report_generator.py", type: "python", category: "Part 6: Report Generator" },
    { name: "api.py", path: "/api.py", type: "python", category: "Part 6: FastAPI REST Service" },
    { name: "docker-compose.yml", path: "/docker-compose.yml", type: "yaml", category: "Part 6: Docker Infrastructure" },
    { name: "env.example", path: "/env.example", type: "env", category: "Part 7: Environment Config" },
    { name: "requirements.txt", path: "/requirements.txt", type: "text", category: "Part 7: Dependencies" },
    { name: "README.md", path: "/README.md", type: "markdown", category: "Part 7: Documentation" },
    { name: "test_rule_engine.py", path: "/tests/test_rule_engine.py", type: "python", category: "Part 7: Unit Tests" },
    { name: "test_providers.py", path: "/tests/test_providers.py", type: "python", category: "Part 7: Unit Tests" }
  ];

  const filesWithContent = projectFiles.map((f) => {
    let content = "";
    try {
      content = fs.readFileSync(path.join(process.cwd(), f.path), "utf-8");
    } catch (e) {
      content = `# File not found: ${f.path}`;
    }
    return { ...f, content };
  });

  res.json({ files: filesWithContent });
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
