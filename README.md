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

## Running Unit Tests

Run test suites with pytest (uses mocked data):

```bash
pytest tests/
```
