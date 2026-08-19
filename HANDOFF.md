# Bank of Abyssinia — Oracle Database Health Monitoring & Alerting Suite
## Production Handoff & Technical Maintenance Guide

---

## 1. What This System Does

The **Oracle Database Health Monitoring & Performance Optimization Suite** is an automated monitoring, scoring, and alerting platform developed for the Bank of Abyssinia DBA team.

### Key Capabilities
- **0–100 Database Health Score**: Calculates a composite health score based on configurable, weighted rules evaluating tablespace utilization, session concurrency, lock contention, and wait event latencies.
- **Autonomous Background Alerting**: Evaluates metrics and dispatches notifications on a background scheduler (`AsyncIOScheduler`), operating independently of whether a user is logged into a dashboard or hitting an API endpoint.
- **Multi-Channel Notification Dispatch**: Routes alerts to Slack incoming webhooks, corporate SMTP email, and generic webhooks (SIEM/PagerDuty) with built-in deduplication cooldowns and immediate escalation on critical state transitions.
- **Self-Service Recipient Management**: DBAs can dynamically register or remove their email addresses for alerts via a REST API or a lightweight HTML interface (`/alerts/recipients/manage`) without restarting services or modifying configuration files.
- **Standalone Executive HTML Reports**: Generates styled, self-contained HTML executive health summaries ready for management distribution.

---

## 2. Architecture Overview

### Core Python Modules (`/`)

| Module | Primary Responsibility |
| :--- | :--- |
| `api.py` | FastAPI REST application, lifespan startup manager, background scheduler, and HTTP route handlers. |
| `providers.py` | Swappable data source layer (Provider Pattern) with Prometheus probing and automatic fallback to direct Oracle SQL via `python-oracledb` (Thin Mode). |
| `rule_engine.py` | Evaluates raw metrics against `rules.yaml`, computes weighted penalty deductions, and produces `HealthReport` and `RuleResult` models. |
| `alert_engine.py` | Multi-channel alert router (`SlackNotificationChannel`, `EmailNotificationChannel`, `GenericWebhookChannel`) with per-rule cooldown suppression and state escalation logic. |
| `recipient_store.py` | File-backed JSON persistence (`alert_recipients.json`) for dynamic email recipients with regex validation and case-insensitive deduplication. |
| `report_generator.py` | Builds standalone, styled HTML executive reports with strict HTML entity escaping (`html.escape`) to prevent injection vulnerabilities. |
| `verify_metrics.py` | Standalone CLI verification tool comparing metric consistency across Direct SQL, Exporter endpoints, PromQL API, and App Providers. |
| `rules.yaml` | Declarative configuration defining rule definitions, weights, thresholds, and actionable DBA recommendations. |
| `create_monitoring_user.sql` | Least-privilege SQL script to provision the Oracle `monitor` database user and required `V$` / `DBA_` view grants. |

---

### CRITICAL: The Two Separate Execution Tracks

A new engineer inspecting this repository must understand that there are **two distinct, decoupled execution tracks**:

```
+-----------------------------------------------------------------------------------+
| TRACK 1: Real Backend (Production Pipeline)                                       |
| Python 3.10+ / FastAPI / python-oracledb / Prometheus / APScheduler               |
| Entry point: api.py (Port 8000)                                                  |
| -> Connects to REAL Oracle DB / Prometheus                                        |
| -> Executes live queries, runs background scheduler, dispatches real alerts       |
+-----------------------------------------------------------------------------------+

+-----------------------------------------------------------------------------------+
| TRACK 2: Demo / Prototype Dashboard (Visual Showcase)                            |
| Node.js / Express / React / Vite / Tailwind CSS                                   |
| Entry point: server.ts (Port 3000)                                                |
| -> Runs on SIMULATED scenario data (Normal, Lock Contention, High I/O, etc.)       |
| -> NOT connected to api.py or the real database                                   |
| -> Designed for interactive UI demonstration only                                 |
+-----------------------------------------------------------------------------------+
```

> **Warning for Maintainers:** Do not assume the React frontend is calling `api.py`. The frontend (`src/`, `server.ts`) is a client demo prototype that generates synthetic telemetry. All real monitoring and alerting logic resides in the Python modules (`api.py`, `rule_engine.py`, `alert_engine.py`, `providers.py`).

---

## 3. How to Run It

### Prerequisites
- Python 3.10+ with `pip`
- Node.js 18+ (only if running the demo dashboard)
- Oracle Database (19c or XE) accessible via network, with `monitor` user created

---

### Running the Real Backend (`api.py`)

1. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   pip install httpx
   ```

2. **Configure Environment (`.env`):**
   Copy `env.example` to `.env` and fill in connection details:
   ```bash
   cp env.example .env
   ```
   Key environment variables:
   ```env
   # Oracle Database
   ORACLE_HOST=10.73.34.37
   ORACLE_PORT=1521
   ORACLE_SERVICE_NAME=XEPDB1
   ORACLE_USER=monitor
   ORACLE_PASSWORD=your_secure_password
   ORACLE_DSN=monitor/your_secure_password@10.73.34.37:1521/XEPDB1

   # Prometheus (Optional - if blank, auto-falls back to Direct SQL)
   PROMETHEUS_URL=http://localhost:9090

   # Alert Channels
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
   SMTP_HOST=smtp.bankofabyssinia.com
   SMTP_PORT=587
   SMTP_USER=alerts@bankofabyssinia.com
   SMTP_PASSWORD=smtp_password
   ALERT_SENDER_EMAIL=alerts@bankofabyssinia.com
   ALERT_RECIPIENT_EMAILS=dba-oncall@bankofabyssinia.com
   GENERIC_WEBHOOK_URL=https://siem.bankofabyssinia.com/alerts

   # Engine Timing
   MONITOR_INTERVAL_SECONDS=60
   ALERT_COOLDOWN_SECONDS=900
   RULES_CONFIG_FILE=rules.yaml
   ```

3. **Start the API Server:**
   ```bash
   uvicorn api:app --host 0.0.0.0 --port 8000 --reload
   ```

4. **Verify Active Endpoints:**
   - **Interactive API Documentation:** `http://localhost:8000/docs`
   - **Current Health Summary:** `http://localhost:8000/health`
   - **Raw Telemetry Metrics:** `http://localhost:8000/metrics`
   - **Active Alert Listing:** `http://localhost:8000/alerts`
   - **Scheduler & Loop Status:** `http://localhost:8000/alerts/status`
   - **Recipient Self-Service Form:** `http://localhost:8000/alerts/recipients/manage`
   - **Executive HTML Report:** `http://localhost:8000/report`

---

### Running the Metric Verification Tool (`verify_metrics.py`)

To validate metric accuracy across Direct SQL, Prometheus Exporter, PromQL, and App Providers:
```bash
python verify_metrics.py
```

---

### Running the Demo Dashboard (`server.ts` + React)

```bash
npm install
npm run dev
```
Access the UI at `http://localhost:3000`.

---

## 4. How Automatic Alerting Works

### 1. The Autonomous Background Scheduler
When `api.py` boots, its `lifespan` handler initializes an `AsyncIOScheduler` instance:
- Every `MONITOR_INTERVAL_SECONDS` (default: 60s), `run_monitoring_cycle()` executes.
- It queries the active `MetricsProvider`, passes metrics through `HealthScorer.evaluate_all()`, and hands the `RuleResult` list to `AlertEngine.process_rule_results()`.
- It executes immediately on boot to initialize `monitor_state` so `/alerts/status` is populated instantly.

```
 [AsyncIOScheduler (every 60s)]
             |
             v
   run_monitoring_cycle()
             |
     +-------+-------+
     |               |
     v               v
get_provider()    HealthScorer.evaluate_all()
(Prometheus/SQL)     (rules.yaml weights)
     |               |
     +-------+-------+
             |
             v
   AlertEngine.process_rule_results()
             |
     +-------+-------+-------------------+
     |               |                   |
     v               v                   v
[Slack Channel] [Email Channel] [Generic Webhook]
```

### 2. Deduplication & Escalation Logic
`AlertEngine` tracks the last alert timestamp and severity for each `rule_id` in an in-memory state dictionary:
- **First Breach**: When a rule breaches `WARNING` or `CRITICAL` for the first time, it alerts immediately.
- **Repeat Breach (Within Cooldown)**: Subsequent breaches of the same rule at the same severity within `ALERT_COOLDOWN_SECONDS` (default: 900s / 15 min) are **suppressed** to prevent notification storms.
- **Severity Escalation (Bypasses Cooldown)**: If a rule was previously alerting as `WARNING` and escalates to `CRITICAL`, **the cooldown is bypassed immediately** and a new alert fires at once.
- **Cooldown Expiry**: If a breach persists past `ALERT_COOLDOWN_SECONDS`, a repeat reminder alert is dispatched.

### 3. Dynamic Recipient Merging
When `EmailNotificationChannel` dispatches an alert:
1. It reads the static baseline configured in `ALERT_RECIPIENT_EMAILS` (`.env`).
2. It queries `recipient_store.list_recipient_emails()` to load dynamic self-service recipients from `alert_recipients.json`.
3. It merges and deduplicates both sets into a single distribution list.
4. **No service restart or container redeployment is required** when DBAs add or remove their emails.

---

## 5. Test Coverage

The test suite contains **75 automated unit and integration tests** with 100% pass rate (`pytest tests/ -v`).

```
============================= test session starts ==============================
rootdir: /app/applet, configfile: pytest.ini
collected 75 items

tests/test_alert_engine.py (21 tests) .....................             [ 28%]
tests/test_api_endpoints.py (11 tests) ...........                      [ 42%]
tests/test_api_monitoring_loop.py (10 tests) ..........                 [ 56%]
tests/test_providers.py (3 tests) ...                                   [ 60%]
tests/test_recipient_store.py (18 tests) ..................            [ 84%]
tests/test_report_generator.py (9 tests) .........                      [ 96%]
tests/test_rule_engine.py (3 tests) ...                                 [100%]

======================== 75 passed, 1 warning in 1.94s =========================
```

### Test Suite Breakdown

1. **`tests/test_alert_engine.py` (21 tests)**:
   - Verifies Slack, Email, and Webhook notification dispatchers handle HTTP 200, HTTP errors, and network exceptions gracefully.
   - Tests SMTP authentication vs. unauthenticated relay behavior.
   - Validates alert suppression during cooldown and immediate firing on critical escalation.
   - Tests independent tracking across multiple rules.

2. **`tests/test_api_endpoints.py` (11 tests)**:
   - Tests FastAPI endpoints via HTTP `TestClient` (`/`, `/health`, `/metrics`, `/alerts`, `/alerts/status`, `/report`, `/alerts/recipients`).
   - Confirms `GET /health` returns 200 on healthy metrics and 503 on provider exceptions.
   - Tests complete recipient CRUD lifecycle (`POST` -> `GET` -> `DELETE` -> `GET`).
   - Tests 404 response on nonexistent routes.

3. **`tests/test_api_monitoring_loop.py` (10 tests)**:
   - Tests environment-based channel auto-registration.
   - Verifies the scheduler loop evaluates rules and fires alerts without manual HTTP triggers.
   - Verifies exceptions in the monitoring cycle are caught and logged without crashing the scheduler.

4. **`tests/test_providers.py` (3 tests)**:
   - Tests Prometheus health check success and failure handling.
   - Tests `get_provider()` automatic fallback from Prometheus to `OracleSQLProvider`.

5. **`tests/test_recipient_store.py` (18 tests)**:
   - Tests email validation regex (rejecting empty strings, missing `@`, missing domains).
   - Tests file persistence, corruption recovery, and case-insensitive email deduplication.
   - Tests dynamic merging into active email notifications.

6. **`tests/test_report_generator.py` (9 tests)**:
   - Tests generation of standalone HTML executive reports with valid `<!DOCTYPE html>` structure.
   - Tests status badge color assignments and tablespace usage bar calculations.
   - Tests strict HTML entity escaping and verified immunity against HTML/XSS injection payloads (`<script>`, `<img>`).

7. **`tests/test_rule_engine.py` (3 tests)**:
   - Tests `HealthScorer` evaluation against `rules.yaml` rules and weight penalty deductions across Healthy, Warning, and Critical threshold states.

---

## 6. Known Limitations

This section provides an honest assessment of architectural constraints and limitations:

1. **Mocked Testing vs. Live Oracle Database in CI**:
   All 75 automated tests execute against mocked/simulated `MetricsProvider` instances. While `OracleSQLProvider` uses standard `python-oracledb` Thin Mode queries, the suite has **not** been executed end-to-end against a real Oracle 19c RAC / Exadata production instance in an automated CI/CD pipeline.

2. **No Authentication or Authorization on API Endpoints**:
   `api.py` has no authentication layer (no API keys, Basic Auth, or OAuth2/JWT). Any client on the network that can reach port 8000 can view metrics, trigger reports, or add/delete alert recipient emails.

3. **In-Memory Cooldown State**:
   Alert deduplication state (`_alert_state` in `AlertEngine`) is stored in Python memory. If the `api.py` process is restarted or redeployed, all cooldown history is lost, meaning an ongoing breach may re-alert immediately after a restart.

4. **Plaintext Credentials in `.env`**:
   Oracle passwords, SMTP credentials, and webhook URLs reside in plaintext `.env` files. For production deployment, these must be migrated to a secure secrets manager (HashiCorp Vault, CyberArk, or AWS/GCP Secrets Manager).

5. **Untuned Default Rule Thresholds**:
   The thresholds in `rules.yaml` (e.g. 80%/90% tablespace usage, 40/80 active sessions, 500ms/1500ms wait latency) are baseline estimates and have not been calibrated against Bank of Abyssinia's historical transaction workloads (e.g. month-end batch processing).

6. **Demo React Frontend is Disconnected**:
   The React dashboard (`src/`, `server.ts`) is a frontend prototype powered by mock scenario generators. It does not communicate with `api.py` and must not be used as operational tooling without connecting it to the backend.

7. **Single-Node In-Process Scheduler**:
   `AsyncIOScheduler` runs inside the single Python process. If `api.py` is scaled out to multiple container replicas behind a load balancer, each replica will run its own monitoring loop, causing duplicate alerts.

8. **No Alert Resolution (Recovery) Notifications**:
   While the engine alerts when a rule enters `WARNING` or `CRITICAL`, it does not currently dispatch an "ALL CLEAR / RESOLVED" message when a metric recovers back to `OK`.

---

## 7. Suggested Next Steps (Not Yet Built)

To take this platform from a working prototype to an enterprise-grade production service, the DBA and Platform teams should prioritize the following enhancements:

### 1. Security & Access Control
- **Add JWT / API Key Authentication**: Protect `/alerts/recipients` and administrative routes using FastAPI security dependencies (`HTTPBearer` or `APIKeyHeader`).
- **Secrets Management**: Replace `.env` loading with environment injection from Bank of Abyssinia's enterprise secrets vault.

### 2. High Availability & State Persistence
- **Externalize Cooldown State**: Move `AlertEngine._alert_state` to a Redis instance or lightweight SQLite/PostgreSQL store so that cooldowns survive application restarts and multi-instance deployments.
- **Distributed Lock for Scheduler**: Use Redis/database locks (`Redlock` or similar) if scaling `api.py` to multiple container replicas.

### 3. Monitoring & Alerting Enhancements
- **Recovery Notifications**: Implement state-transition detection to send "RESOLVED: USERS tablespace back to 74%" messages when metrics normalize.
- **Historical Telemetry Persistence**: Periodically persist `HealthReport` evaluations into a relational or time-series table for 30-day/90-day SLA and capacity trend analysis.

### 4. Integration of UI with Real API
- **Connect Dashboard to Backend**: Update the React frontend to fetch live data from `http://<api-host>:8000/health`, `/metrics`, and `/alerts` instead of simulated Express scenarios.

### 5. Rule Calibration with DBAs
- Review `rules.yaml` with Senior Oracle DBAs to adjust weights and thresholds according to specific database tiering (Core Banking OLTP vs. Data Warehouse vs. Reporting Replicas).
