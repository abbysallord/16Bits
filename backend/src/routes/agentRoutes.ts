import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db/database.js'
import { swarmService } from '../services/swarmService.js'
import { runbookService } from '../services/runbookService.js'
import { runAgentSchema } from '../schemas/incidentSchemas.js'
import { validate } from '../middleware/validate.js'
import { normalizeAlert, webhookAuthorized } from '../services/alertIntake.js'
import { notifyIncidentApproved } from '../services/slackService.js'
import { AuthenticatedRequest, requireAuth, resolveOrg } from '../middleware/auth.js'
import { DEMO_ORG_ID, getOrgByIngestKey, runInOrg } from '../services/orgService.js'
import { enqueueSwarm } from '../services/swarmQueue.js'
import { demoAccountEnabled } from '../config/demo.js'
import { approveLimiter, executeLimiter, webhookLimiter } from '../middleware/rateLimit.js'

export const agentRouter = Router()

// List available SOP runbooks
agentRouter.get('/runbooks', resolveOrg, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const runbooks = await runbookService.getAvailableRunbooks(req.orgId ?? null)
  res.json({ count: runbooks.length, storage: 'database', runbooks })
})

// Search runbooks: /api/agents/runbooks/search?q=redis+oom (add &rerank=false to skip the LLM pick)
agentRouter.get('/runbooks/search', resolveOrg, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const q = String(req.query.q || '').slice(0, 2000)
  if (!q.trim()) {
    res.status(400).json({ error: 'q is required' })
    return
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 5, 1), 10)
  const orgId = req.orgId ?? null
  const result = await (orgId ? runInOrg(orgId, () => runbookService.search(q, limit, { rerank: req.query.rerank !== 'false', orgId })) : runbookService.search(q, limit, { rerank: false, orgId: null }))
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
    const saved = await runbookService.saveRunbook(filename, content, req.orgId!)
    res.status(201).json({ message: 'Runbook saved to the database and indexed for search', runbook: saved })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save runbook' })
  }
})

// Delete a team-uploaded runbook. Signed-in operators only; built-in runbooks cannot be deleted.
agentRouter.delete('/runbooks/:filename', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const filename = String(req.params.filename)
  const outcome = await runbookService.deleteRunbook(filename, req.orgId!)
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
agentRouter.post('/webhook/alert', webhookLimiter, async (req: Request, res: Response): Promise<void> => {
  // Team alert URLs (/api/webhooks/t/<ingest-key>/...) route into that team. The legacy shared URLs feed
  // the public demo workspace and are protected by WEBHOOK_SECRET when it is set.
  const ingestKey: string | null = (req as any).ingestKey || null
  let orgId = DEMO_ORG_ID
  if (ingestKey) {
    const org = await getOrgByIngestKey(ingestKey)
    if (!org) {
      res.status(401).json({ error: 'Unknown or rotated team alert URL. Copy the current one from Settings.' })
      return
    }
    orgId = org.id
  } else if (!demoAccountEnabled()) {
    // No public demo workspace: shared URLs would drop alerts where nobody can see them
    res.status(404).json({ error: 'Shared alert URLs are disabled on this server. Use your team alert URL from Settings.' })
    return
  } else if (!webhookAuthorized(req)) {
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
      `SELECT id, status FROM incidents WHERE external_ref = ? AND org_id = ? AND status NOT IN ('RESOLVED', 'FAILED') ORDER BY created_at DESC LIMIT 1`,
      [alert.externalRef, orgId]
    )
    if (open) {
      res.status(202).json({ message: 'Duplicate alert: incident already open', source: alert.source, incidentId: open.id, status: open.status, duplicate: true })
      return
    }
  }

  const incidentId = crypto.randomUUID()
  await db.run(`
    INSERT INTO incidents (id, title, description, priority, category, status, source, external_ref, org_id)
    VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)
  `, [incidentId, alert.title, alert.description, alert.priority, alert.category, alert.source, alert.externalRef, orgId])

  const run = () => enqueueSwarm(() => runInOrg(orgId, () => swarmService.executeSwarm(incidentId, alert.title, alert.description, alert.priority, alert.category)))

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
agentRouter.post('/approve', approveLimiter, requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { incidentId } = req.body
  if (!incidentId || typeof incidentId !== 'string') {
    res.status(400).json({ error: 'incidentId is required' })
    return
  }

  // Scoped to the approver's team: check if it belongs to this team, or if it was created in the demo sandbox
  let existing = await db.get('SELECT status, org_id FROM incidents WHERE id = ? AND org_id = ?', [incidentId, req.orgId]) as { status: string; org_id: string } | undefined
  if (!existing) {
    // If the incident was created in the demo sandbox (e.g. unauthenticated CLI triage), adopt it into the operator's private workspace
    const demoIncident = await db.get('SELECT status, org_id FROM incidents WHERE id = ? AND (org_id = ? OR org_id IS NULL)', [incidentId, DEMO_ORG_ID]) as { status: string; org_id: string } | undefined
    if (demoIncident && req.orgId) {
      await db.run('UPDATE incidents SET org_id = ? WHERE id = ?', [req.orgId, incidentId])
      existing = { status: demoIncident.status, org_id: req.orgId }
    }
  }

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
    void runInOrg(req.orgId!, () => notifyIncidentApproved({ incidentId, title: (updated as any)?.title || incidentId, approvedBy }))
    res.json({
      message: `Remediation plan authorized by authenticated operator: ${approvedBy}. Status updated to RESOLVED.`,
      incident: updated,
      authorizedBy: approvedBy
    })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// Batch claim/adopt demo incidents into the caller's private team workspace
agentRouter.post('/claim', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { incidentIds } = req.body
  if (!Array.isArray(incidentIds) || incidentIds.length === 0) {
    res.status(400).json({ error: 'incidentIds array is required' })
    return
  }
  const cleanIds = incidentIds.filter((id) => typeof id === 'string' && id.trim()).slice(0, 50)
  if (cleanIds.length === 0) {
    res.json({ claimedCount: 0, claimedIds: [] })
    return
  }

  const placeholders = cleanIds.map(() => '?').join(',')
  const toClaim = await db.all<{ id: string }>(
    `SELECT id FROM incidents WHERE id IN (${placeholders}) AND (org_id = ? OR org_id IS NULL)`,
    [...cleanIds, DEMO_ORG_ID]
  )
  const idsToUpdate = toClaim.map(r => r.id)
  if (idsToUpdate.length > 0) {
    const updatePlaceholders = idsToUpdate.map(() => '?').join(',')
    await db.run(
      `UPDATE incidents SET org_id = ? WHERE id IN (${updatePlaceholders})`,
      [req.orgId, ...idsToUpdate]
    )
  }
  res.json({
    message: `Claimed ${idsToUpdate.length} incident(s) into your team workspace`,
    claimedCount: idsToUpdate.length,
    claimedIds: idsToUpdate
  })
})

// Resolve (or create) the incident a console/CLI run works on, inside the caller's team.
// Returns null when the incidentId belongs to another team or does not exist.
async function prepareRun(req: AuthenticatedRequest): Promise<{ incidentId: string; orgId: string } | { error: string; status: number }> {
  const orgId = req.orgId
  if (!orgId) return { status: 401, error: 'Sign in to run the agents (the public demo workspace is disabled on this server)' }
  const { title, description, priority, category } = req.body
  let incidentId = req.body.incidentId
  if (incidentId) {
    const owned = await db.get('SELECT id FROM incidents WHERE id = ? AND org_id = ?', [incidentId, orgId])
    if (!owned) return { status: 404, error: 'Incident not found' }
  } else {
    incidentId = crypto.randomUUID()
    await db.run(`
      INSERT INTO incidents (id, title, description, priority, category, status, user_id, org_id)
      VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)
    `, [incidentId, title, description, priority || 'HIGH', category || 'Enterprise Workflow', req.user?.id || null, orgId])
  }
  return { incidentId, orgId }
}

// Synchronous Swarm Execution
agentRouter.post('/execute', executeLimiter, resolveOrg, validate(runAgentSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const prep = await prepareRun(req)
  if ('error' in prep) {
    res.status(prep.status).json({ error: prep.error })
    return
  }
  try {
    const { title, description, priority, category } = req.body
    const result = await enqueueSwarm(() =>
      runInOrg(prep.orgId, () => swarmService.executeSwarm(prep.incidentId, title, description, priority || 'HIGH', category || 'Enterprise Workflow'))
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
agentRouter.post('/stream', executeLimiter, resolveOrg, validate(runAgentSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const prep = await prepareRun(req)
  if ('error' in prep) {
    res.status(prep.status).json({ error: prep.error })
    return
  }
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  try {
    const { title, description, priority, category } = req.body
    const incidentId = prep.incidentId
    res.write(`data: ${JSON.stringify({ type: 'INIT', incidentId, title })}\n\n`)

    const result = await enqueueSwarm(() =>
      runInOrg(prep.orgId, () =>
        swarmService.executeSwarm(incidentId, title, description, priority || 'HIGH', category || 'Enterprise Workflow', (step) => {
          res.write(`data: ${JSON.stringify({ type: 'STEP', step })}\n\n`)
        })
      )
    )

    res.write(`data: ${JSON.stringify({ type: 'COMPLETE', result })}\n\n`)
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err: any) {
    res.write(`data: ${JSON.stringify({ type: 'ERROR', error: err.message })}\n\n`)
    res.end()
  }
})
