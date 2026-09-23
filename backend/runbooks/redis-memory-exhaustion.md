# SOP-CACHE-007: Redis Memory Exhaustion & OOM Eviction Spike

## Trigger Condition
- Redis memory usage exceeds 90% of `maxmemory`.
- System logging `OOM command not allowed when used memory > maxmemory`.

## Safety & Compliance Requirements
- **Session Protection**: Do not flush key namespaces matching `session:*` or `auth:*` without multi-factor authorization.
- **Eviction Strategy**: Verify `volatile-lru` or `allkeys-lru` policy is active.

## Approved Remediation Steps
1. Scan and evict expired cache keys from analytical namespaces (`cache:analytics:*` and `cache:temp:*`).
2. Trigger memory defragmentation: `MEMORY PURGE`.
3. If memory pressure persists, increase instance memory allocation on cloud cache cluster by 1 tier.

## Human Authorization Policy
- Flushing entire database namespaces requires Lead Architect or DevSecOps approval.
