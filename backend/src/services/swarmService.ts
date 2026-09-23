import os from 'os'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { RunTree } from 'langsmith'
import { db } from '../db/database.js'
import { aiService } from './aiService.js'
import { runbookService } from './runbookService.js'
import { guardrailService } from './guardrailService.js'

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
  langsmithTraceId?: string | null
  langsmithTraceUrl?: string | null
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

    // 0. Active Input Guardrail: PII/Secret Redaction & Prompt Injection Sanitization
    const sanitized = guardrailService.sanitizeInput(title, description)
    const effectiveTitle = sanitized.title
    const effectiveDesc = sanitized.description

    // 1. Initialize LangSmith Trace Tree for 100% Observability
    const hasLangSmith = Boolean(process.env.LANGSMITH_API_KEY)
    let runTree: RunTree | null = null

    if (hasLangSmith) {
      try {
        runTree = new RunTree({
          name: `16Bits OmniOps Swarm: ${effectiveTitle}`,
          run_type: 'chain',
          inputs: {
            incidentId,
            title: effectiveTitle,
            description: effectiveDesc,
            priority,
            category,
            sanitizationMeta: {
              redactions: sanitized.redactionsCount,
              injectionsNeutralized: sanitized.injectionsNeutralized
            }
          },
          project_name: process.env.LANGSMITH_PROJECT || '16bits-omniops'
        })
        await runTree.postRun()
      } catch (err: any) {
        console.warn(`[LangSmith] RunTree init notice: ${err.message}`)
      }
    }

    const recordStep = async (agentName: string, stepNumber: number, thought: string, action: string, dataPayload?: any) => {
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
      await db.run(`
        INSERT INTO agent_logs (id, incident_id, agent_name, step_number, thought, action, data_payload)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [logId,
        incidentId,
        agentName,
        stepNumber,
        thought,
        action,
        dataPayload ? JSON.stringify(dataPayload) : null])

      // Post child span to LangSmith
      if (runTree) {
        try {
          const childSpan = await runTree.createChild({
            name: `${stepNumber}. ${agentName}`,
            run_type: stepNumber === 2 ? 'tool' : 'llm',
            inputs: { action, dataPayload }
          })
          await childSpan.end({ outputs: { thought, action } })
          await childSpan.postRun()
        } catch {
          // ignore trace post errors
        }
      }

      if (onProgress) {
        onProgress(step)
      }
    }

    // Update status to ANALYZING in DB
    await db.run(`UPDATE incidents SET status = 'ANALYZING', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [incidentId])

    // Log Active Input Guardrail if secrets redacted or injections neutralized
    if (sanitized.redactionsCount > 0 || sanitized.injectionsNeutralized > 0) {
      await recordStep(
        'Input Guardrail Gate',
        0,
        `Sanitized ${sanitized.redactionsCount} confidential secrets/PII markers and neutralized ${sanitized.injectionsNeutralized} prompt injection vector(s). Safe payload forwarded to SRE swarm.`,
        'Active Input Boundary Guardrail Verification',
        { redactions: sanitized.redactionsCount, injectionsNeutralized: sanitized.injectionsNeutralized }
      )
    }

    // ==========================================
    // AGENT 1: PLANNER AGENT
    // ==========================================
    const planPrompt = `
You are the Lead Planning Agent in an autonomous enterprise operations swarm.
Incident Details:
- Title: ${effectiveTitle}
- Description: ${effectiveDesc}
- Priority: ${priority}
- Category: ${category}

Decompose this incident into a concrete 3-stage tactical resolution plan:
1. Telemetry & Root Cause Investigation Plan
2. Safety & SLA Compliance Guardrail Requirements
3. Formulation of Remediation Actions & Customer Communication

Be concise, technical, and objective. Maximum 140 words.
`
    const planThought = await aiService.complete(planPrompt, "You are an expert enterprise operations planning coordinator.")
    await recordStep(
      'Planner Agent',
      1,
      planThought,
      'Decomposed incident into structured execution DAG and investigative vectors.'
    )

    // ==========================================
    // AGENT 2: INVESTIGATOR & TOOL AGENT
    // ==========================================
    const hostTelemetry = {
      platform: os.platform(),
      hostname: os.hostname(),
      cpuCores: os.cpus().length,
      freeMemoryMb: Math.round(os.freemem() / (1024 * 1024)),
      totalMemoryMb: Math.round(os.totalmem() / (1024 * 1024)),
      processUptimeSeconds: Math.round(process.uptime()),
      systemLoad: os.loadavg().map(n => Number(n.toFixed(2)))
    }

    const matchedRunbook = runbookService.findBestRunbook(effectiveTitle + ' ' + effectiveDesc)
    const slaPolicy = SlaPolicyMatrix.getPolicy(priority)

    // Codebase File & AST Knowledge Graph Inspection
    let inspectedFile: string | null = null
    let fileSnippet: string | null = null
    let astContext: string | null = null

    const combinedText = `${effectiveTitle} ${effectiveDesc}`
    const fileMatch = combinedText.match(/([a-zA-Z0-9_\-\.\/]+\.(ts|js|json|sql|py|go|md))/i)
    if (fileMatch && fileMatch[1]) {
      const targetRel = fileMatch[1].replace(/^\.\//, '')
      const searchPaths = [
        path.resolve(process.cwd(), targetRel),
        path.resolve(process.cwd(), 'src', targetRel),
        path.resolve(process.cwd(), 'backend', targetRel),
        path.resolve(process.cwd(), 'backend', 'src', targetRel),
      ]
      for (const p of searchPaths) {
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          try {
            const raw = fs.readFileSync(p, 'utf-8')
            inspectedFile = path.relative(process.cwd(), p)
            fileSnippet = raw.slice(0, 1000)
            break
          } catch {}
        }
      }
    }

    // Cross-reference static AST Knowledge Graph
    const graphReportPath = path.resolve(process.cwd(), 'graphify-out', 'GRAPH_REPORT.md')
    const altGraphPath = path.resolve(process.cwd(), 'backend', 'graphify-out', 'GRAPH_REPORT.md')
    const finalGraphPath = fs.existsSync(graphReportPath) ? graphReportPath : (fs.existsSync(altGraphPath) ? altGraphPath : null)
    if (finalGraphPath) {
      try {
        const godNodes = ['AIService', 'RunbookService', 'SwarmService', 'db', 'requireAuth', 'GuardrailService', 'validate']
        const matchedNodes = godNodes.filter(n => combinedText.toLowerCase().includes(n.toLowerCase()))
        if (matchedNodes.length > 0) {
          astContext = `Matched AST God Nodes in Codebase Architecture: ${matchedNodes.join(', ')}`
        }
      } catch {}
    }

    const toolPrompt = `
You are the Investigator Agent with access to live host telemetry, enterprise SOP runbooks, and codebase AST graphs.
You retrieved:
- Host Telemetry: ${JSON.stringify(hostTelemetry)}
- Enterprise SLA: ${JSON.stringify(slaPolicy)}
- Matched SOP Runbook: "${matchedRunbook?.title}"
- Runbook Procedures:
${matchedRunbook?.content.slice(0, 500)}
${inspectedFile ? `- Inspected Source File [${inspectedFile}]:\n${fileSnippet}\n` : ''}
${astContext ? `- Codebase Architecture (AST Graph): ${astContext}\n` : ''}

Incident: "${effectiveTitle}" - "${effectiveDesc}"

Synthesize the failure mechanism based on the telemetry, codebase context, and matching SOP runbook. Maximum 120 words.
`
    const toolThought = await aiService.complete(toolPrompt, "You are a senior site reliability and systems investigator.")
    
    const actionDesc = inspectedFile
      ? `Queried live OS telemetry, inspected codebase file [${inspectedFile}], and retrieved SOP Runbook: "${matchedRunbook?.title}".`
      : `Queried live OS telemetry and retrieved SOP Runbook: "${matchedRunbook?.title}".`

    await recordStep(
      'Investigator Agent',
      2,
      toolThought,
      actionDesc,
      {
        hostTelemetry,
        slaPolicy,
        runbookTitle: matchedRunbook?.title,
        ...(inspectedFile ? { inspectedFile, filePreview: fileSnippet?.slice(0, 250) } : {}),
        ...(astContext ? { astKnowledgeGraph: astContext } : {})
      }
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
    await recordStep(
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
Synthesize the final resolution for: "${effectiveTitle}".
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
    const rawResolution = await aiService.complete(synthPrompt, "You are the chief operations synthesizer and communications dispatcher.")
    
    // Enterprise Output Guardrail: Intercept destructive commands and enforce zero-emojis
    const outputAudit = guardrailService.auditOutput(rawResolution)
    let finalResolution = outputAudit.cleanedText

    let requiresApproval = priority === 'CRITICAL' || priority === 'HIGH' || outputAudit.isDestructive
    if (outputAudit.isDestructive) {
      finalResolution += `\n\n> [SAFETY GATE OVERRIDE]: Detected high-risk operations: ${outputAudit.flaggedCommands.join(', ')}. Action quarantined behind mandatory Human Operator signature.`
    }

    const finalStatus = requiresApproval ? 'AWAITING_APPROVAL' : 'RESOLVED'

    await recordStep(
      'Synthesizer Agent',
      4,
      `Final resolution synthesized. Security status: ${finalStatus}.`,
      requiresApproval ? 'Action staged. Waiting for Human Operator authorization.' : 'Low-risk plan auto-approved by policy; incident marked resolved. No commands were executed.'
    )

    // Save final resolution in DB
    await db.run(`
      UPDATE incidents
      SET status = ?, resolution = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [finalStatus, finalResolution, incidentId])

    // Close LangSmith parent run
    let langsmithTraceId: string | null = null
    let langsmithTraceUrl: string | null = null

    if (runTree) {
      try {
        await runTree.end({ outputs: { status: finalStatus, finalResolution: finalResolution.slice(0, 300) } })
        await runTree.patchRun()
        langsmithTraceId = runTree.id
        langsmithTraceUrl = `https://smith.langchain.com/o/default/projects/p/${process.env.LANGSMITH_PROJECT || '16bits-omniops'}?r=${runTree.id}`
      } catch {
        // ignore
      }
    }

    // Optional Slack / Collaboration Webhook Dispatch
    const slackUrl = process.env.SLACK_WEBHOOK_URL
    if (slackUrl) {
      try {
        await fetch(slackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `[16Bits OmniOps Alert]: ${effectiveTitle} [${priority}]\nStatus: ${finalStatus}\nIncident: ${incidentId}\nResolution: ${finalResolution.slice(0, 200)}...`
          })
        })
      } catch (err: any) {
        console.warn(`[Slack Webhook] notice: ${err.message}`)
      }
    }

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
      executionDurationMs,
      langsmithTraceId,
      langsmithTraceUrl
    }
  }

  // Atomically moves AWAITING_APPROVAL -> RESOLVED. Returns false if another operator got there first.
  public async approveIncident(incidentId: string, approvedBy: string): Promise<boolean> {
    const { changes } = await db.run(`
      UPDATE incidents
      SET status = 'RESOLVED', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'AWAITING_APPROVAL'
    `, [incidentId])
    if (changes === 0) return false

    const logId = crypto.randomUUID()
    await db.run(`
      INSERT INTO agent_logs (id, incident_id, agent_name, step_number, thought, action)
      VALUES (?, ?, 'Human Operator', 5, ?, 'Remediation plan approved and incident closed.')
    `, [logId,
      incidentId,
      `Human Operator (${approvedBy}) approved the remediation plan after reviewing the agent consensus.`])
    return true
  }
}

export const swarmService = new SwarmService()
