-- ==============================================================================
-- Oracle Database Health Monitoring Suite - User Provisioning Script
-- Target Environments: Oracle XE (18c/21c) and Oracle 19c Enterprise Edition
-- Author: Bank of Abyssinia DB Health & Performance Optimization Team
-- Description: Creates a dedicated, read-only 'monitor' user with explicit
--              SELECT privileges on dynamic performance views (V$ views) required
--              for health metrics, session tracking, wait events, and tablespace stats.
-- ==============================================================================

SET SERVEROUTPUT ON SIZE UNLIMITED;
SET FEEDBACK ON;

-- ------------------------------------------------------------------------------
-- 1. IDEMPOTENT USER CLEANUP
-- ------------------------------------------------------------------------------
-- Safely drop user if it already exists to allow clean re-execution of script.
-- WARNING: Dropping user removes any existing session grants/locks.
PROMPT [INFO] Checking if user 'MONITOR' already exists...

DECLARE
    v_user_exists NUMBER := 0;
BEGIN
    SELECT COUNT(*) INTO v_user_exists 
    FROM dba_users 
    WHERE username = 'MONITOR';

    IF v_user_exists > 0 THEN
        DBMS_OUTPUT.PUT_LINE('[WARNING] User MONITOR exists. Dropping existing user...');
        EXECUTE IMMEDIATE 'DROP USER MONITOR CASCADE';
        DBMS_OUTPUT.PUT_LINE('[SUCCESS] User MONITOR dropped successfully.');
    ELSE
        DBMS_OUTPUT.PUT_LINE('[INFO] User MONITOR does not exist. Proceeding with creation.');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('[ERROR] Failed during user cleanup: ' || SQLERRM);
        RAISE;
END;
/

-- ------------------------------------------------------------------------------
-- 2. CREATE MONITOR USER
-- ------------------------------------------------------------------------------
-- Password policy compliant password; default tablespace set to USERS / TEMP
PROMPT [INFO] Creating user 'MONITOR'...

CREATE USER MONITOR IDENTIFIED BY "MonitorPass123#"
    DEFAULT TABLESPACE USERS
    TEMPORARY TABLESPACE TEMP
    QUOTA 0M ON USERS
    ACCOUNT UNLOCK;

-- ------------------------------------------------------------------------------
-- 3. GRANT SYSTEM PRIVILEGES & ROLES
-- ------------------------------------------------------------------------------
-- CREATE SESSION: Allows the monitoring service to connect via SQL / JDBC / OCI
GRANT CREATE SESSION TO MONITOR;

-- SELECT_CATALOG_ROLE: Grants SELECT on data dictionary views (DBA_*, USER_*, ALL_*)
-- Needed for querying DBA_TABLESPACES, DBA_DATA_FILES, DBA_FREE_SPACE, DBA_OBJECTS.
GRANT SELECT_CATALOG_ROLE TO MONITOR;

-- ------------------------------------------------------------------------------
-- 4. GRANT EXPLICIT SELECT ON V$ DYNAMIC PERFORMANCE VIEWS
-- ------------------------------------------------------------------------------
-- Note: SELECT_CATALOG_ROLE does NOT automatically grant SELECT on V_$ base views
-- when querying through PL/SQL or thin-mode direct connections unless explicitly granted.
-- We grant SELECT on SYS.V_$... view definitions explicitly below with explanations.

-- Session & Connection Monitoring
-- Needed to count active/inactive sessions, long-running queries, and client metadata.
GRANT SELECT ON SYS.V_$SESSION TO MONITOR;

-- System Statistics & Performance Counter Monitoring
-- Needed for CPU usage, hard parses, physical reads/writes, commits, execute counts.
GRANT SELECT ON SYS.V_$SYSSTAT TO MONITOR;

-- Wait Event & Performance Bottleneck Analysis
-- Needed for wait event latency breakdown (e.g. 'db file sequential read', 'log file sync').
GRANT SELECT ON SYS.V_$SYSTEM_EVENT TO MONITOR;
GRANT SELECT ON SYS.V_$SESSION_WAIT TO MONITOR;
GRANT SELECT ON SYS.V_$SYSTEM_WAIT_CLASS TO MONITOR;

-- Lock & Blocked Session Analysis
-- Needed to identify blocking SQL_IDs, locking chains, and root cause lock holders.
GRANT SELECT ON SYS.V_$LOCK TO MONITOR;
GRANT SELECT ON SYS.V_$LOCKED_OBJECT TO MONITOR;

-- Tablespace & Datafile Capacity Monitoring
-- Needed to compute exact free MB, used MB, total MB, and auto-extensible limits.
GRANT SELECT ON SYS.V_$TABLESPACE TO MONITOR;
GRANT SELECT ON SYS.V_$DATAFILE TO MONITOR;
GRANT SELECT ON SYS.V_$SYS_FILE_STAT TO MONITOR;
GRANT SELECT ON SYS.V_$ASM_DISKGROUP TO MONITOR; -- Needed if Oracle 19c uses ASM storage

-- SQL Execution Performance Stats
-- Needed to inspect high-impact SQL IDs causing CPU or I/O spikes.
GRANT SELECT ON SYS.V_$SQL TO MONITOR;
GRANT SELECT ON SYS.V_$SQLAREA TO MONITOR;
GRANT SELECT ON SYS.V_$SQL_PLAN TO MONITOR;

-- System & Instance Health Info
-- Needed for database uptime, instance status (OPEN/MOUNTED), database name.
GRANT SELECT ON SYS.V_$INSTANCE TO MONITOR;
GRANT SELECT ON SYS.V_$DATABASE TO MONITOR;

-- ------------------------------------------------------------------------------
-- 5. VERIFICATION OF GRANTS
-- ------------------------------------------------------------------------------
PROMPT [INFO] Verifying grants for user 'MONITOR'...

SELECT privilege 
FROM dba_sys_privs 
WHERE grantee = 'MONITOR'
UNION ALL
SELECT granted_role 
FROM dba_role_privs 
WHERE grantee = 'MONITOR';

PROMPT [SUCCESS] User 'MONITOR' successfully created and configured for Oracle XE and Oracle 19c!
