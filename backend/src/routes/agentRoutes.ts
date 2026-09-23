import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db/database.js'
import { swarmService } from '../services/swarmService.js'
import { runbookService } from '../services/runbookService.js'
import { runAgentSchema } from '../schemas/incidentSchemas.js'
import { validate } from '../middleware/validate.js'
import { normalizeAlert, webhookAuthorized } from '../services/alertIntake.js'
import { notifyIncidentApproved } from '../services/slackService.js'
import { AuthenticatedRequest, requireAuth, verifyToken } from '../middleware/auth.js'

export const agentRouter = Router()

// List available SOP runbooks
agentRouter.get('/runbooks', async (req: Request, res: Response): Promise<void> => {
  const runbooks = await runbookService.getAvailableRunbooks()
  res.json({ count: runbooks.length, storage: 'database', runbooks })
})

// Search runbooks: /api/agents/runbooks/search?q=redis+oom (add &rerank=false to skip the LLM pick)
agentRouter.get('/runbooks/search', async (req: Request, res: Response): Promise<void> => {
  const q = String(req.query.q || '').slice(0, 2000)
  if (!q.trim()) {
    res.status(400).json({ error: 'q is required' })
    return
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 10)
  const result = await runbookService.search(q, limit, { rerank: req.query.rerank !== 'false' })
  res.json({
    query: result.query,
    method: result.method,
    chosen: result.chosen ? { filename: result.chosen.runbook.filename, title: result.chosen.runbook.title } : null,
    rerankReason: result.rerankReason || null,
    matches: result.matches.map(m => ({ filename: m.runbook.filename, title: m.runbook.title, score: m.score, signals: m.signals, snippet: m.snippet })),
  })
})

// Upload a custom team runbook (Markdown SOP). Signed-in operators only.
agentRouter.post('/runbooks', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { filename, content } = req.body
  if (!filename || !content) {
    res.status(400).json({ error: 'filename and content are required' })
    return
  }
  try {
    if (typeof filename !== 'string' || typeof content !== 'string') {
      res.status(400).json({ error: 'filename and content must be strings' })
      return
    }
    const saved = await runbookService.saveRunbook(filename, content)
    res.status(201).json({ message: 'Runbook saved to the database and indexed for search', runbook: saved })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save runbook' })
  }
})

// Delete a team-uploaded runbook. Signed-in operators only; built-in runbooks cannot be deleted.
agentRouter.delete('/runbooks/:filename', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const filename = String(req.params.filename)
  const outcome = await runbookService.deleteRunbook(filename)
  if (outcome === 'not_found') {
    res.status(404).json({ error: 'Runbook not found' })
  } else if (outcome === 'builtin') {
    res.status(403).json({ error: 'Built-in runbooks ship with the repo and cannot be deleted' })
  } else {
    res.json({ message: 'Runbook deleted', filename })
  }
})

// Alert ingestion webhook. Accepts Prometheus Alertmanager, PagerDuty V3 and Datadog payloads as-is
// (auto-detected, or forced with ?source=alertmanager|pagerduty|datadog), plus a generic JSON shape.
// If WEBHOOK_SECRET is set, send it as x-webhook-secret, Authorization: Bearer, or ?token=.
agentRouter.post('/webhook/alert', async (req: Request, res: Response): Promise<void> => {
  if (!webhookAuthorized(req)) {
    res.status(401).json({ error: 'Invalid or missing webhook secret (x-webhook-secret header, Bearer token, or ?token=)' })
    return
  }

  const alert = normalizeAlert(req.body, typeof req.query.source === 'string' ? req.query.source : undefined)

  if (alert.resolved) {
    res.status(202).json({ message: `Resolved/non-trigger ${alert.source} notification acknowledged; no swarm run needed`, source: alert.source, ignored: true })
    return
  }

  // Monitoring tools re-send the same alert (repeat_interval, retries). Don't re-run the swarm for an
  // alert that already has an open incident.
  if (alert.externalRef) {
    const open = await db.get<{ id: string; status: string }>(
      `SELECT id, status FROM incidents WHERE external_ref = ? AND status NOT IN ('RESOLVED', 'FAILED') ORDER BY created_at DESC LIMIT 1`,
      [alert.externalRef]
    )
    if (open) {
      res.status(202).json({ message: 'Duplicate alert: incident already open', source: alert.source, incidentId: open.id, status: open.status, duplicate: true })
      return
    }
  }

  const incidentId = crypto.randomUUID()
  await db.run(`
    INSERT INTO incidents (id, title, description, priority, category, status, source, external_ref)
    VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)
  `, [incidentId, alert.title, alert.description, alert.priority, alert.category, alert.source, alert.externalRef])

  const run = () => swarmService.executeSwarm(incidentId, alert.title, alert.description, alert.priority, alert.category)

  // Monitoring tools expect a fast 2xx and retry on timeouts, so their payloads are processed in the
  // background. Generic/curl callers get the full result back (add ?async=1 to skip waiting).
  if (alert.source !== 'generic' || req.query.async === '1') {
    run().catch(async (err) => {
      console.error(`[Webhook] Swarm failed for ${incidentId}:`, err)
      await db.run(`UPDATE incidents SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [incidentId]).catch(() => {})
    })
    res.status(202).json({
      message: `Alert accepted from ${alert.source}; swarm triage started`,
      source: alert.source,
      incidentId,
      priority: alert.priority,
      status: 'ANALYZING'
    })
    return
  }

  try {
    const result = await run()
    res.status(202).json({
      message: 'Alert ingested and processed by 16Bits OmniOps Swarm',
      source: alert.source,
      incidentId,
      status: result.status,
      executionDurationMs: result.executionDurationMs,
      resolutionPreview: result.finalResolution.slice(0, 300) + '...',
      langsmithTraceId: result.langsmithTraceId,
      langsmithTraceUrl: result.langsmithTraceUrl
    })
  } catch (err: any) {
    console.error('[Webhook Error]:', err)
    await db.run(`UPDATE incidents SET status = 'FAILED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [incidentId]).catch(() => {})
    res.status(500).json({ error: err.message || 'Webhook processing failed', incidentId })
  }
})

// Human-in-the-Loop Operator Authorization
// Human approval gate. Signed-in operators only; the approver comes from the verified JWT.
agentRouter.post('/approve', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { incidentId } = req.body
  if (!incidentId || typeof incidentId !== 'string') {
    res.status(400).json({ error: 'incidentId is required' })
    return
  }

  const existing = await db.get('SELECT status FROM incidents WHERE id = ?', [incidentId]) as { status: string } | undefined
  if (!existing) {
    res.status(404).json({ error: 'Incident not found' })
    return
  }
  if (existing.status !== 'AWAITING_APPROVAL') {
    res.status(409).json({ error: `Incident is ${existing.status}, not awaiting approval` })
    return
  }

  const approvedBy = `${req.user!.name} (${req.user!.email})`

  try {
    const approved = await swarmService.approveIncident(incidentId, approvedBy)
    if (!approved) {
      res.status(409).json({ error: 'Incident is no longer awaiting approval' })
      return
    }
    const updated = await db.get('SELECT * FROM incidents WHERE id = ?', [incidentId])
    void notifyIncidentApproved({ incidentId, title: (updated as any)?.title || incidentId, approvedBy })
    res.json({
      message: `Remediation plan authorized by authenticated operator: ${approvedBy}. Status updated to RESOLVED.`,
      incident: updated,
      authorizedBy: approvedBy
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Synchronous Swarm Execution
agentRouter.post('/execute', validate(runAgentSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, description, priority, category } = req.body
    let incidentId = req.body.incidentId

    if (!incidentId) {
      incidentId = crypto.randomUUID()
      await db.run(`
        INSERT INTO incidents (id, title, description, priority, category, status)
        VALUES (?, ?, ?, ?, ?, 'PENDING')
      `, [incidentId, title, description, priority || 'HIGH', category || 'Enterprise Workflow'])
    }

    const result = await swarmService.executeSwarm(
      incidentId,
      title,
      description,
      priority || 'HIGH',
      category || 'Enterprise Workflow'
    )

    res.json({
      message: 'Agent Swarm completed execution successfully',
      result
    })
  } catch (err: any) {
    console.error('[AgentRouter] Swarm execution failed:', err)
    res.status(500).json({ error: err.message || 'Swarm execution failed' })
  }
})

// Real-Time Server-Sent Events (SSE) Streaming Execution
agentRouter.post('/stream', validate(runAgentSchema), async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  try {
    const { title, description, priority, category } = req.body
    let incidentId = req.body.incidentId

    if (!incidentId) {
      incidentId = crypto.randomUUID()
      await db.run(`
        INSERT INTO incidents (id, title, description, priority, category, status)
        VALUES (?, ?, ?, ?, ?, 'PENDING')
      `, [incidentId, title, description, priority || 'HIGH', category || 'Enterprise Workflow'])
    }

    res.write(`data: ${JSON.stringify({ type: 'INIT', incidentId, title })}\n\n`)

    const result = await swarmService.executeSwarm(
      incidentId,
      title,
      description,
      priority || 'HIGH',
      category || 'Enterprise Workflow',
      (step) => {
        res.write(`data: ${JSON.stringify({ type: 'STEP', step })}\n\n`)
      }
    )

    res.write(`data: ${JSON.stringify({ type: 'COMPLETE', result })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: 'ERROR', error: err.message })}\n\n`)
    res.end()
  }
})
