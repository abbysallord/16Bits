import os from 'os'
import crypto from 'crypto'
import { db } from '../db/database.js'
import { aiService } from './aiService.js'
import { runbookService } from './runbookService.js'

export interface AgentStepLog {
  agentName: string
  stepNumber: number
  thought: string
  action: string
  dataPayload?: any
  timestamp: string
}

export interface SwarmExecutionResult {
  incidentId: string
  title: string
  priority: string
  status: 'AWAITING_APPROVAL' | 'RESOLVED' | 'FAILED'
  requiresApproval: boolean
  matchedRunbookTitle: string
  logs: AgentStepLog[]
  finalResolution: string
  executionDurationMs: number
}

// Enterprise SLA Policy Matrix
const SlaPolicyMatrix = {
  getPolicy(priority: string) {
    switch (priority) {
      case 'CRITICAL':
        return { responseTarget: '15 minutes', resolutionTarget: '2 hours', escalationTarget: 'VP Operations & Incident Commander', maxAllowedDowntimeMin: 15 }
      case 'HIGH':
        return { responseTarget: '1 hour', resolutionTarget: '8 hours', escalationTarget: 'Lead Site Reliability Engineer', maxAllowedDowntimeMin: 60 }
      default:
        return { responseTarget: '4 hours', resolutionTarget: '24 hours', escalationTarget: 'Tier 2 Support', maxAllowedDowntimeMin: 240 }
    }
  }
}

export class SwarmService {
  public async executeSwarm(
    incidentId: string,
    title: string,
    description: string,
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    category: string,
    onProgress?: (step: AgentStepLog) => void
  ): Promise<SwarmExecutionResult> {
    const startTime = Date.now()
    const logs: AgentStepLog[] = []

    const recordStep = (agentName: string, stepNumber: number, thought: string, action: string, dataPayload?: any) => {
      const step: AgentStepLog = {
        agentName,
        stepNumber,
        thought,
        action,
        dataPayload,
        timestamp: new Date().toISOString()
      }
      logs.push(step)

      // Save to SQLite
      const logId = crypto.randomUUID()
      db.prepare(`
        INSERT INTO agent_logs (id, incident_id, agent_name, step_number, thought, action, data_payload)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        logId,
        incidentId,
        agentName,
        stepNumber,
        thought,
        action,
        dataPayload ? JSON.stringify(dataPayload) : null
      )

      if (onProgress) {
        onProgress(step)
      }
    }

    // Update status to ANALYZING in DB
    db.prepare(`UPDATE incidents SET status = 'ANALYZING', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(incidentId)

    // ==========================================
    // AGENT 1: PLANNER AGENT
    // ==========================================
    const planPrompt = `
You are the Lead Planning Agent in an autonomous enterprise operations swarm.
Incident Details:
- Title: ${title}
- Description: ${description}
- Priority: ${priority}
- Category: ${category}

Decompose this incident into a concrete 3-stage tactical resolution plan:
1. Telemetry & Root Cause Investigation Plan
2. Safety & SLA Compliance Guardrail Requirements
3. Formulation of Remediation Actions & Customer Communication

Be concise, technical, and objective. Maximum 140 words.
`
    const planThought = await aiService.complete(planPrompt, "You are an expert enterprise operations planning coordinator.")
    recordStep(
      'Planner Agent',
      1,
      planThought,
      'Decomposed incident into structured execution DAG and investigative vectors.'
    )

    // ==========================================
    // AGENT 2: INVESTIGATOR & TOOL AGENT
    // ==========================================
    // 1. Fetch real hardware & host telemetry
    const hostTelemetry = {
      platform: os.platform(),
      hostname: os.hostname(),
      cpuCores: os.cpus().length,
      freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
      totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
      processUptimeSeconds: Math.round(process.uptime()),
      systemLoad: os.loadavg().map(n => Number(n.toFixed(2)))
    }

    // 2. Fetch matched SOP runbook from local disk
    const matchedRunbook = runbookService.findBestRunbook(title + ' ' + description)
    const slaPolicy = SlaPolicyMatrix.getPolicy(priority)

    const toolPrompt = `
You are the Investigator Agent with access to live host telemetry and enterprise SOP runbooks.
You retrieved:
- Host Telemetry: ${JSON.stringify(hostTelemetry)}
- Enterprise SLA: ${JSON.stringify(slaPolicy)}
- Matched SOP Runbook: "${matchedRunbook?.title}"
- Runbook Procedures:
${matchedRunbook?.content.slice(0, 600)}

Incident: "${title}" - "${description}"

Synthesize the failure mechanism based on the telemetry and the matching SOP runbook. Maximum 120 words.
`
    const toolThought = await aiService.complete(toolPrompt, "You are a senior site reliability and systems investigator.")
    recordStep(
      'Investigator Agent',
      2,
      toolThought,
      `Queried live OS telemetry and retrieved SOP Runbook: "${matchedRunbook?.title}".`,
      { hostTelemetry, slaPolicy, runbookTitle: matchedRunbook?.title }
    )

    // ==========================================
    // AGENT 3: VERIFICATION & GUARDRAIL AGENT (The Safety Gate)
    // ==========================================
    const verifierPrompt = `
You are the Safety & Compliance Verification Guardrail Gate.
Evaluate the proposed investigation against enterprise safety:
- Root Cause: ${toolThought}
- Runbook Constraints: "${matchedRunbook?.title}"
- Contractual SLA Deadline: ${slaPolicy.resolutionTarget}
- Incident Severity: ${priority}

Evaluate:
1. Does the action require human confirmation before executing?
2. Does it risk breaching the ${slaPolicy.resolutionTarget} SLA window?
3. Are safety guardrails satisfied?

Return an explicit verdict: [CONDITIONAL APPROVAL: OPERATOR AUTHORIZATION REQUIRED] or [VERIFIED & SAFE TO EXECUTE]. Maximum 100 words.
`
    const verifierThought = await aiService.complete(verifierPrompt, "You are a strict enterprise compliance and risk verification officer.")
    recordStep(
      'Verification Agent',
      3,
      verifierThought,
      'Audited action against enterprise SLA constraints, security boundaries, and authorization gates.'
    )

    // ==========================================
    // AGENT 4: SYNTHESIZER & DISPATCHER AGENT
    // ==========================================
    const synthPrompt = `
You are the Synthesizer & Dispatcher Agent.
Synthesize the final resolution for: "${title}".
Inputs:
- Priority: ${priority}
- Telemetry & Root Cause: ${toolThought}
- Matching Runbook: ${matchedRunbook?.title}
- Compliance Gate: ${verifierThought}

Produce a structured markdown resolution containing:
1. **Executive Incident Summary** (Plain English)
2. **Immediate Remediation Playbook** (Numbered technical action steps from runbook)
3. **Automated Stakeholder Communication Message** (Client-ready update email)
4. **Post-Mortem Preventive Rules** (Long-term architectural defense)

Keep it crisp, professional, and ready for immediate deployment.
`
    const finalResolution = await aiService.complete(synthPrompt, "You are the chief operations synthesizer and communications dispatcher.")
    
    const requiresApproval = priority === 'CRITICAL' || priority === 'HIGH'
    const finalStatus = requiresApproval ? 'AWAITING_APPROVAL' : 'RESOLVED'

    recordStep(
      'Synthesizer Agent',
      4,
      `Final resolution synthesized. Security status: ${finalStatus}.`,
      requiresApproval ? 'Action staged. Waiting for Human Operator authorization.' : 'Remediation dispatched and incident marked resolved.'
    )

    // Save final resolution in DB
    db.prepare(`
      UPDATE incidents
      SET status = ?, resolution = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(finalStatus, finalResolution, incidentId)

    const executionDurationMs = Date.now() - startTime

    return {
      incidentId,
      title,
      priority,
      status: finalStatus,
      requiresApproval,
      matchedRunbookTitle: matchedRunbook?.title || 'Standard Enterprise SOP',
      logs,
      finalResolution,
      executionDurationMs
    }
  }

  public approveIncident(incidentId: string, approvedBy: string): void {
    db.prepare(`
      UPDATE incidents
      SET status = 'RESOLVED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(incidentId)

    const logId = crypto.randomUUID()
    db.prepare(`
      INSERT INTO agent_logs (id, incident_id, agent_name, step_number, thought, action)
      VALUES (?, ?, 'Human Operator', 5, ?, 'Remediation executed and incident closed.')
    `).run(
      logId,
      incidentId,
      `Human Operator (${approvedBy}) digitally authorized remediation plan after inspecting agent consensus.`
    )
  }
}

export const swarmService = new SwarmService()
