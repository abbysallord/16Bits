# SOP-DB-018: PostgreSQL Connection Pool Exhaustion

## Trigger Condition
- Active client connections exceed 95% of `max_connections` (e.g. > 475/500).
- Application threads logging `FATAL: remaining connection slots are reserved for non-replication superuser connections`.

## Safety & Compliance Requirements
- **Financial Consistency**: Read replicas must not be forcefully terminated if replication lag is under active sync.
- **Failover Policy**: Automatic failover to standby replica only if primary database heartbeat misses 3 consecutive 10s probes.

## Approved Remediation Steps
1. Identify and terminate orphaned idle-in-transaction connections older than 300 seconds:
   `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND state_change < NOW() - INTERVAL '5 minutes';`
2. Temporarily adjust PgBouncer / connection pool max client limit by +25%.
3. Throttle asynchronous background analytical cron jobs to free connection slots for transactional checkout queries.

## Human Authorization Policy
- Terminating active user connections requires Database Administrator or Principal SRE sign-off.
