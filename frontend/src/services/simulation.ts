import type { AgentStepLog, SwarmResult } from './api'

/**
 * SKETCH-MODE SIMULATION
 * Mirrors the shape of the real backend's streaming swarm response
 * (Planner -> Investigator -> Verifier -> Synthesizer) with canned
 * reasoning so the frontend is demo-able before the backend exists.
 * When the backend is healthy the real API streams instead and this
 * library is only used as the offline fallback.
 */

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface Scenario {
  key: string
  label: string
  industry: string
  title: string
  description: string
  priority: Priority
}

export const SCENARIOS: Scenario[] = [
  {
    key: 'stripe-429',
    label: 'STRIPE WEBHOOK 429',
    industry: 'Fintech',
    title: 'Payment Webhook Ingestion Throttle on Stripe Gateway',
    description:
      'Production webhook consumer queue has accumulated 4,120 unacknowledged settlement events. Upstream rate limits returning HTTP 429 on settlement callbacks.',
    priority: 'CRITICAL',
  },
  {
    key: 'pg-lag',
    label: 'PG REPLICA LAG',
    industry: 'Data Platform',
    title: 'Database Read-Replica Replication Lag Exceeding 180s',
    description:
      'Analytics queries are reading stale financial transaction balances due to replication lag spike on PostgreSQL replica cluster.',
    priority: 'HIGH',
  },
  {
    key: 'icu-telemetry',
    label: 'ICU TELEMETRY DROP',
    industry: 'Healthcare',
    title: 'ICU Cardiac Telemetry Pipeline WebSocket Drop',
    description:
      'Hospital central monitoring hub dropped real-time ECG telemetry stream from 48 bedside cardiac monitors across Ward 3.',
    priority: 'CRITICAL',
  },
  {
    key: 'checkout-cart',
    label: 'CHECKOUT CART 500s',
    industry: 'E-commerce',
    title: 'Checkout Service Error Rate Spike During Flash Sale',
    description:
      'Cart-to-order conversion endpoint returning HTTP 500 for 31% of requests. Flash sale traffic 6x baseline, abandoned carts climbing.',
    priority: 'CRITICAL',
  },
  {
    key: 'kafka-lag',
    label: 'KAFKA CONSUMER LAG',
    industry: 'Platform Infra',
    title: 'Kafka Event Stream Consumer Group Lag Crossing 1M Messages',
    description:
      'Orders topic consumer group `fulfillment-prod` lag at 1.2M messages and rising. Downstream warehouse label printing stalled for 40 minutes.',
    priority: 'HIGH',
  },
  {
    key: 'redis-oom',
    label: 'REDIS OOM EVICTIONS',
    industry: 'Platform Infra',
    title: 'Redis Cache Node Eviction Storm and OOM Risk',
    description:
      'Session cache cluster node evicting 48k keys/min, memory at 97% of maxmemory. Login sessions dropped for 9% of active users.',
    priority: 'HIGH',
  },
  {
    key: 'auth-burst',
    label: 'CREDENTIAL STUFFING',
    industry: 'Security',
    title: 'Anomalous Auth Traffic Pattern Detected on Login Endpoint',
    description:
      'Login endpoint receiving 220 req/s from 3,400 distinct IPs with 97.4% failure rate. Signature matches credential-stuffing botnet.',
    priority: 'CRITICAL',
  },
  {
    key: 'cdn-outage',
    label: 'CDN EDGE OUTAGE',
    industry: 'Media Streaming',
    title: 'CDN Edge POP Failure Degrading Video Start Times',
    description:
      'Primary edge POP in Frankfurt failing health checks. EU viewers seeing 4.2s video start times (baseline 0.4s), rebuffer ratio 14%.',
    priority: 'MEDIUM',
  },
  {
    key: 'ml-drift',
    label: 'ML MODEL DRIFT',
    industry: 'AI Platform',
    title: 'Fraud Model Prediction Drift Beyond Alert Threshold',
    description:
      'Live fraud-scoring model PSI at 0.31 (threshold 0.2). False-negative rate on confirmed fraud cases doubled in the last 6 hours.',
    priority: 'MEDIUM',
  },
]

export const INDUSTRIES = ['All', ...Array.from(new Set(SCENARIOS.map((s) => s.industry)))]

function ts(offsetMs: number): string {
  return new Date(Date.now() - 10_000 + offsetMs).toISOString()
}

interface SimStep {
  agentName: 'PLANNER' | 'INVESTIGATOR' | 'VERIFIER' | 'SYNTHESIZER'
  stepNumber: 1 | 2 | 3 | 4
  thought: string
  action: string
}

interface SimulationPlan {
  runbook: string
  runbookMatch: string
  immediate: string[]
  approval: string[]
  comms: string[]
  postIncident: string[]
  needsApproval: boolean
  status: 'AWAITING_APPROVAL' | 'RESOLVED'
}

const PLANS: Record<string, SimulationPlan> = {
  'stripe-429': {
    runbook: 'RB-042 Webhook Consumer Recovery',
    runbookMatch: '87%',
    immediate: [
      'Pause webhook consumer group "settlements-prod" to stop queue growth.',
      'Drain 4,120 backlog in batches of 250 with backoff on HTTP 429.',
      'Enable circuit breaker on settlement callbacks; reroute to fallback queue.',
    ],
    approval: [
      'Scale gateway from 4 -> 8 replicas (cost impact: ~$120/day).',
      'Rotate Stripe webhook signing secret (invalidates live endpoints briefly).',
    ],
    comms: [
      'Status page: "Degraded settlement processing — fix in progress"',
      'Platinum accounts notified via account managers.',
    ],
    postIncident: [
      'Add 429 backoff retry policy to consumer config (PR drafted).',
      'Post-incident review scheduled 48h after resolution.',
    ],
    needsApproval: true,
    status: 'AWAITING_APPROVAL',
  },
  'pg-lag': {
    runbook: 'RB-107 Replica Failover & Lag Recovery',
    runbookMatch: '91%',
    immediate: [
      'Route read traffic for balance queries to primary via feature flag (safe: read-only).',
      'Kill long-running analytics vacuum job holding replay lock on replica-02.',
    ],
    approval: [
      'Promote replica-02 to primary and fail over writer connections (brief write pause ~8s).',
    ],
    comms: [
      'Status page: "Read delays on transaction history — recovery underway"',
      'Finance ops lead paged for balance-reporting freeze.',
    ],
    postIncident: [
      'Add replay-lag SLO alert at 60s with auto read-rerouting.',
      'Cap analytics vacuum workers during trading hours (config change queued).',
    ],
    needsApproval: true,
    status: 'AWAITING_APPROVAL',
  },
  'icu-telemetry': {
    runbook: 'RB-210 Clinical Telemetry Continuity',
    runbookMatch: '94%',
    immediate: [
      'Fail over Ward 3 monitor gateway to standby WebSocket hub (zero-downtime path).',
      'Activate bedside nursing fallback: audible alarms switch to local monitor speakers.',
    ],
    approval: [
      'Restart telemetry ingestion service on hub-2 (clears corrupted session table).',
    ],
    comms: [
      'Clinical engineering notified; paper fallback protocol active in Ward 3.',
      'No patient-safety event logged; continuity maintained throughout.',
    ],
    postIncident: [
      'Add dual-path heartbeat check between monitor gateways and hubs.',
      'Quarterly failover drill scheduled with clinical engineering.',
    ],
    needsApproval: true,
    status: 'AWAITING_APPROVAL',
  },
  'checkout-cart': {
    runbook: 'RB-031 Flash Sale Traffic Mitigation',
    runbookMatch: '89%',
    immediate: [
      'Enable request shedding on non-critical endpoints (recommendations, reviews).',
      'Scale checkout pods 6 -> 14 via HPA override (verified within quota).',
      'Add 30s grace-period cache on inventory lookups to cut DB hot loops.',
    ],
    approval: [
      'Raise orders-db connection pool max 80 -> 140 (memory headroom verified 34%).',
    ],
    comms: [
      'Status banner: "Elevated checkout errors — fix deployed, monitoring"',
      'Growth team notified for abandoned-cart recovery email.',
    ],
    postIncident: [
      'Load-test checkout at 10x baseline before next sale event.',
      'Move flash-sale inventory checks to dedicated read pool.',
    ],
    needsApproval: true,
    status: 'AWAITING_APPROVAL',
  },
  'kafka-lag': {
    runbook: 'RB-055 Consumer Group Lag Recovery',
    runbookMatch: '92%',
    immediate: [
      'Add 4 consumer instances to `fulfillment-prod` group (partitions available: 12).',
      'Raise `max.poll.records` 500 -> 2000 for batch efficiency.',
    ],
    approval: [
      'Reset offset checkpoint for 3 stalled partitions after duplicate-check verification.',
    ],
    comms: [
      'Warehouse ops notified: label printing ETA 12 min to catch-up.',
      'Slack #logistics updated with live lag ticker.',
    ],
    postIncident: [
      'Auto-scaler for consumer groups based on lag-per-partition metric.',
      'Chaos drill: kill consumer pod under load to validate rebalance.',
    ],
    needsApproval: true,
    status: 'AWAITING_APPROVAL',
  },
  'redis-oom': {
    runbook: 'RB-073 Cache Node Memory Recovery',
    runbookMatch: '85%',
    immediate: [
      'Switch eviction policy to `allkeys-lru` on cache-03 (safe, hot-reload).',
      'Shunt login sessions to replica cache pool (capacity headroom 41%).',
    ],
    approval: [
      'Vertically scale cache-03 16GB -> 32GB during low-traffic window.',
    ],
    comms: [
      'Status: "Some users asked to re-log in — resolved"',
      'Identity team informed of session turnover.',
    ],
    postIncident: [
      'TTL audit: 62% of keys have no TTL set; owner teams notified.',
      'Memory-pressure alert added at 85% with auto-shunting.',
    ],
    needsApproval: true,
    status: 'AWAITING_APPROVAL',
  },
  'auth-burst': {
    runbook: 'RB-301 Credential Attack Containment',
    runbookMatch: '96%',
    immediate: [
      'Enable progressive rate-limit on /login: 5 attempts/IP/minute (top 50 offending IPs).',
      'Force step-up MFA for logins from Tor exit nodes and flagged ASN ranges.',
    ],
    approval: [
      'Activate WAF bot-management rule set (small false-positive risk on VPN users).',
      'Global password reset for 1,204 accounts with confirmed credential matches.',
    ],
    comms: [
      'Security advisory to all staff: expect MFA prompts.',
      'Legal/compliance informed of contained credential-stuffing attempt.',
    ],
    postIncident: [
      'Deploy breached-password screening at registration and reset flows.',
      'Add per-ASN anomaly baseline to fraud-scoring features.',
    ],
    needsApproval: true,
    status: 'AWAITING_APPROVAL',
  },
  'cdn-outage': {
    runbook: 'RB-140 Edge POP Failover',
    runbookMatch: '83%',
    immediate: [
      'Shift EU-traffic weight: Frankfurt POP 100 -> 0, Amsterdam + Paris absorb (headroom verified 2.1x).',
    ],
    approval: [],
    comms: [
      'Status: "Slow video start for some EU viewers — traffic rerouted"',
      'Content partners notified of regional degradation window.',
    ],
    postIncident: [
      'Ticket filed with CDN provider for Frankfurt POP hardware fault.',
      'Add synthetic video-start probe from 6 EU cities.',
    ],
    needsApproval: false,
    status: 'RESOLVED',
  },
  'ml-drift': {
    runbook: 'RB-360 Model Rollback & Drift Response',
    runbookMatch: '88%',
    immediate: [
      'Pin fraud scoring to last-stable model v14.2 (shadow scores still logged for v15.0).',
      'Freeze v15.0 promotion pipeline pending drift investigation.',
    ],
    approval: [
      'Retrain v15.1 with last 72h labeled data (GPU budget ~$85).',
    ],
    comms: [
      'Risk team briefed: elevated manual-review queue during rollback.',
      'No customer impact; fraud losses contained to $4.1k pre-rollback.',
    ],
    postIncident: [
      'Add PSI and false-negative rate gates to model promotion CI.',
      'Feature-store schema audit for upstream encoding change.',
    ],
    needsApproval: true,
    status: 'AWAITING_APPROVAL',
  },
}

function plannerThought(sc: Scenario): string {
  return `Incident classified as ${sc.priority} in domain "${sc.industry}". Decomposing "${sc.title}" into an execution DAG: (1) identify blast radius, (2) query telemetry + SLA contracts, (3) rank remediation options, (4) gate high-risk actions behind human approval.`
}

function buildSteps(sc: Scenario, plan: SimulationPlan): SimStep[] {
  const flagged = plan.approval.length
  return [
    {
      agentName: 'PLANNER',
      stepNumber: 1,
      thought: plannerThought(sc),
      action: 'PLAN_CREATED — 4 subtasks, 2 blocking dependencies',
    },
    {
      agentName: 'INVESTIGATOR',
      stepNumber: 2,
      thought: `Querying monitoring APIs for "${sc.industry}" domain. Cross-referencing error signatures, queue depths, and downstream service health. Matching against runbook corpus... top match confidence ${plan.runbookMatch}.`,
      action: `TELEMETRY_QUERIED — 3 sources, runbook ${plan.runbookMatch} match`,
    },
    {
      agentName: 'VERIFIER',
      stepNumber: 3,
      thought: `Evaluating remediation options against safety constraints: ${flagged} proposed action(s) touch production state and REQUIRE human sign-off per compliance policy CP-7. Autonomous actions are reversible and low-risk; proceeding with those.`,
      action: `SAFETY_CHECK_PASSED — ${flagged} action${flagged === 1 ? '' : 's'} flagged for approval`,
    },
    {
      agentName: 'SYNTHESIZER',
      stepNumber: 4,
      thought: 'Composing remediation playbook, stakeholder comms, and post-incident review notes. Routing infrastructure actions to approval queue.',
      action: plan.needsApproval
        ? 'RESOLUTION_SYNTHESIZED — playbook ready, approval requested'
        : 'RESOLUTION_SYNTHESIZED — fully autonomous, no approval required',
    },
  ]
}

function buildResolution(sc: Scenario, plan: SimulationPlan): string {
  const lines: string[] = []
  lines.push('OMNIOPS REMEDIATION PLAYBOOK')
  lines.push('============================')
  lines.push(`Incident : ${sc.title}`)
  lines.push(`Domain   : ${sc.industry}`)
  lines.push(`Priority : ${sc.priority}`)
  lines.push(`Runbook  : ${plan.runbook} — ${plan.runbookMatch} match`)
  lines.push('')
  lines.push('IMMEDIATE ACTIONS (autonomous)')
  plan.immediate.forEach((a, i) => lines.push(`  ${i + 1}. ${a}`))
  if (plan.approval.length > 0) {
    lines.push('')
    lines.push('REQUIRES HUMAN APPROVAL')
    plan.approval.forEach((a, i) => lines.push(`  ${plan.immediate.length + i + 1}. ${a}`))
  }
  lines.push('')
  lines.push('STAKEHOLDER COMMS')
  plan.comms.forEach((c) => lines.push(`  - ${c}`))
  lines.push('')
  lines.push('POST-INCIDENT')
  plan.postIncident.forEach((p) => lines.push(`  - ${p}`))
  return lines.join('\n')
}

const STEP_DELAYS_MS: number[] = [0, 1600, 1600, 1600]
const RESULT_DELAY_MS = 900

export interface Simulation {
  steps: AgentStepLog[]
  result: SwarmResult
  /** Wall-clock delays (ms) between step emissions, for the sketch-mode ticker. */
  stepDelays: number[]
  resultDelay: number
}

export function buildSimulation(title: string, priority: string): Simulation {
  const sc = SCENARIOS.find((s) => s.title === title)
  const plan: SimulationPlan = (sc && PLANS[sc.key]) || {
    runbook: 'RB-GEN Generic Incident Response',
    runbookMatch: '41%',
    immediate: [
      'Snapshot current system state and error metrics for baseline.',
      'Apply low-risk mitigation: enable enhanced logging + throttle suspect endpoints.',
    ],
    approval: ['Escalate to domain on-call for targeted remediation review.'],
    comms: ['Status page updated with investigation notice.'],
    postIncident: ['Route incident to runbook-authoring backlog for coverage gap.'],
    needsApproval: true,
    status: 'AWAITING_APPROVAL',
  }

  const raw = buildSteps(
    sc || {
      key: 'custom',
      label: 'CUSTOM',
      industry: 'General',
      title,
      description: '',
      priority: (priority as Priority) || 'MEDIUM',
    },
    plan,
  )

  const steps: AgentStepLog[] = raw.map((s) => ({ ...s, timestamp: ts(STEP_DELAYS_MS[s.stepNumber - 1]) }))

  const result: SwarmResult = {
    incidentId: `sim-${Date.now()}`,
    title,
    priority,
    status: plan.needsApproval ? 'AWAITING_APPROVAL' : 'RESOLVED',
    requiresApproval: plan.needsApproval,
    matchedRunbookTitle: `${plan.runbook} (${plan.runbookMatch})`,
    logs: steps,
    finalResolution: buildResolution(
      sc || { key: 'custom', label: 'CUSTOM', industry: 'General', title, description: '', priority: 'MEDIUM' },
      plan,
    ),
    executionDurationMs: STEP_DELAYS_MS.reduce((a, b) => a + b, 0),
  }

  return { steps, result, stepDelays: [...STEP_DELAYS_MS], resultDelay: RESULT_DELAY_MS }
}
