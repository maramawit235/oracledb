# Oracle Database Health Monitoring & Performance Optimization Suite

Production-grade, enterprise-ready Oracle Database Monitoring, Health Scoring, Alerting, and Reporting Suite developed for Bank of Abyssinia (Oracle 19c & XE environments).

---

## Architecture Overview

```
Oracle Database (XE / 19c)
       │
       ▼
oracledb_exporter  ──(PromQL)──►  Prometheus Server
       │                                │
       └──────────────┐                 │
                      ▼                 ▼
             OracleSQLProvider   PrometheusProvider
                      │                 │
                      └────────┬────────┘
                               ▼
                   MetricsProvider (Factory)
                               │
                               ▼
                        RuleEngine (rules.yaml)
                               │
                      ┌────────┴────────┐
                      ▼                 ▼
                 AlertEngine       FastAPI REST Service
             (Slack, Email, Webhook) (/health, /metrics, /report)
```

---

## Quick Start & Setup Instructions

### 1. Provision Monitoring User in Oracle Database
Run `create_monitoring_user.sql` as `SYSDBA` or `SYSTEM` user on your Oracle XE or 19c instance:

```bash
sqlplus sys/YourSysPassword@localhost:1521/XE as sysdba @create_monitoring_user.sql
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in your Oracle DSN and alert credentials:

```bash
cp .env.example .env
```

### 3. Switch Between Oracle XE and Oracle 19c
To target Oracle XE or 19c, simply update `ORACLE_DSN` in your `.env` file:
- **Oracle XE**: `ORACLE_DSN=localhost:1521/XE` (or `localhost:1521/XEPDB1`)
- **Oracle 19c Enterprise**: `ORACLE_DSN=10.10.20.50:1521/ORCLPDB1`

### 4. Direct SQL Fallback vs Prometheus Mode
The suite automatically detects if Prometheus is reachable on `PROMETHEUS_URL`:
- If **Prometheus is ONLINE**: Queries metrics via PromQL instant query API.
- If **Prometheus is OFFLINE**: Automatically falls back to querying Oracle directly via thin-mode `python-oracledb` using the `monitor` account.

### 5. Automatic Alerting (No Manual Trigger Required)
`api.py` runs a background scheduler (APScheduler) that evaluates every rule and dispatches
alerts on its own timer, independent of the dashboard being open or any endpoint being called.
This is what lets a DBA step away from the screen without missing a breach.

- Configure `MONITOR_INTERVAL_SECONDS` (default `60`) in `.env` to control how often the loop runs.
- Configure `ALERT_COOLDOWN_SECONDS` (default `900` / 15 min) to control how often a *repeat*
  breach of the same rule is allowed to re-alert. Escalation (WARNING → CRITICAL) always
  bypasses the cooldown and fires immediately.
- Notification channels are only registered if their credentials are present in `.env`:
  `SLACK_WEBHOOK_URL`, or `SMTP_HOST` + `ALERT_RECIPIENT_EMAILS`, or `GENERIC_WEBHOOK_URL`.
  If none are set, rules still get evaluated but nobody is notified — a warning is logged
  at startup so this misconfiguration isn't silent.
- Check `GET /alerts/status` at any time to confirm the loop is alive: it reports the last
  cycle's timestamp, health score, alerts sent, and any error from the last run.

---

## Running Verification & Phase D Checks

To run standalone verification comparing metrics across Direct SQL, Exporter `/metrics`, PromQL, and App Providers:

```bash
python verify_metrics.py
```

Expected Output:
```
+----------------------------+---------------+---------------+---------------+---------------+--------+
| Metric Name                | Direct SQL    | Exporter Text | PromQL API    | App Provider  | Status |
+----------------------------+---------------+---------------+---------------+---------------+--------+
| Active Sessions (Count)    | 12.0          | 12.0          | 12.0          | 12.0          | ✅ PASS|
| USERS Tablespace Used (%)  | 88.4          | 88.4          | 88.4          | 88.4          | ✅ PASS|
| SYSSTAT Execute Count      | 1250000.0     | 1250000.0     | 1250000.0     | 1250000.0     | ✅ PASS|
+----------------------------+---------------+---------------+---------------+---------------+--------+
```

---

## Running the Complete Stack with Docker Compose

To start the Oracle DB Exporter, Prometheus server, and FastAPI Monitoring App with a single command:

```bash
docker-compose up -d
```

Access Points:
- **Monitoring Web Dashboard**: `http://localhost:3000`
- **FastAPI REST Endpoints**: `http://localhost:8000/docs`
- **Prometheus UI**: `http://localhost:9090`
- **Exporter Raw Metrics**: `http://localhost:9161/metrics`

---

## Two Ways to View This Project

This repo has two separate, independently runnable pieces — worth understanding up front:

1. **The real backend (`api.py`)** — connects to an actual Oracle XE/19c instance (or Prometheus),
   evaluates real rules, and runs the automatic background alerting loop described below. This is
   the actual production deliverable.
2. **The visual dashboard (`src/`, `server.ts`)** — a React demo UI with simulated metric
   scenarios (NORMAL/WARNING/CRITICAL) for presenting the project's behavior without needing a
   live bank database on hand. It does **not** call the real Python backend — it runs its own
   mock evaluation in `server.ts`. Useful for demos; not proof the real pipeline works.

### Running the real backend
```bash
pip install -r requirements.txt
cp env.example .env        # fill in ORACLE_DSN and/or alert channel credentials
python api.py               # or: uvicorn api:app --reload
```
Then visit:
- `http://localhost:8000/docs` — interactive Swagger UI for every endpoint
- `http://localhost:8000/health` — current health score and rule evaluation
- `http://localhost:8000/alerts/status` — confirms the background monitoring loop is alive

### Running the demo dashboard
```bash
npm install
npm run dev
```
Then visit `http://localhost:3000` (or the port printed in the terminal) and use the scenario
switcher to preview HEALTHY/DEGRADED/CRITICAL states without touching a real database.

---

## Running Unit Tests

Run test suites with pytest (uses mocked data):

```bash
pytest tests/
```
