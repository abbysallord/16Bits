import type { AgentStepLog, SwarmResult } from './api'

/**
 * SKETCH-MODE SIMULATION
 * Mirrors the shape of the real backend's streaming swarm response
 * (Planner -> Investigator -> Verifier -> Synthesizer) with canned
 * reasoning so the frontend is demo-able before the backend exists.
 * Delete or gate this behind a flag once the real API is wired.
 */

function ts(offsetMs: number): string {
  return new Date(Date.now() - 10_000 + offsetMs).toISOString()
}

export function buildSimulation(title: string, priority: string) {
  const steps: AgentStepLog[] = [
    {
      agentName: 'PLANNER',
      stepNumber: 1,
      thought: `Incident classified as ${priority}. Decomposing "${title}" into an execution DAG: (1) identify blast radius, (2) query telemetry + SLA contracts, (3) rank remediation options, (4) gate high-risk actions behind human approval.`,
      action: 'PLAN_CREATED — 4 subtasks, 2 blocking dependencies',
      timestamp: ts(0),
    },
    {
      agentName: 'INVESTIGATOR',
      stepNumber: 2,
      thought:
        'Querying monitoring APIs: error rate +420% over baseline, queue depth 4,120 events, affected downstream services: settlements, notifications. Platinum-tier customer SLA breach window opens in 12 minutes. Matching against runbook corpus... 2 candidate runbooks found.',
      action: 'TELEMETRY_QUERIED — 3 sources, 2 runbook matches',
      timestamp: ts(1_600),
    },
    {
      agentName: 'VERIFIER',
      stepNumber: 3,
      thought:
        'Evaluating remediation options against safety constraints: option A (restart consumer group) is low-risk and reversible; option B (scale gateway + rotate credentials) touches infrastructure and REQUIRES human sign-off per compliance policy CP-7. Selecting A + B with approval gate on B.',
      action: 'SAFETY_CHECK_PASSED — 1 action flagged for approval',
      timestamp: ts(3_200),
    },
    {
      agentName: 'SYNTHESIZER',
      stepNumber: 4,
      thought:
        'Composing remediation playbook, stakeholder comms, and post-incident review notes. Routing infrastructure action to approval queue.',
      action: 'RESOLUTION_SYNTHESIZED — playbook ready, approval requested',
      timestamp: ts(4_800),
    },
  ]

  const finalResolution = `OMNIOPS REMEDIATION PLAYBOOK
============================
Incident : ${title}
Priority : ${priority}
Runbook  : RB-042 (Webhook Consumer Recovery) — 87% match

IMMEDIATE ACTIONS (autonomous)
  1. Pause webhook consumer group "settlements-prod" to stop queue growth.
  2. Drain 4,120 backlog in batches of 250 with backoff on HTTP 429.
  3. Enable circuit breaker on settlement callbacks; reroute to fallback queue.

REQUIRES HUMAN APPROVAL
  4. Scale gateway from 4 -> 8 replicas (cost impact: ~$120/day).
  5. Rotate Stripe webhook signing secret (invalidates live endpoints briefly).

STAKEHOLDER COMMS
  - Status page: "Degraded settlement processing — fix in progress"
  - Platinum accounts notified via account managers.

POST-INCIDENT
  - Add 429 backoff retry policy to consumer config (PR drafted).
  - Post-incident review scheduled 48h after resolution.`

  const result: SwarmResult = {
    incidentId: `sim-${Date.now()}`,
    title,
    priority,
    status: priority === 'CRITICAL' || priority === 'HIGH' ? 'AWAITING_APPROVAL' : 'RESOLVED',
    requiresApproval: true,
    matchedRunbookTitle: 'RB-042 Webhook Consumer Recovery',
    logs: steps,
    finalResolution,
    executionDurationMs: 4_800,
  }

  return { steps, result }
}
