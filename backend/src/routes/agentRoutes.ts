import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db/database.js'
import { swarmService } from '../services/swarmService.js'
import { runbookService } from '../services/runbookService.js'
import { runAgentSchema } from '../schemas/incidentSchemas.js'
import { validate } from '../middleware/validate.js'
import { AuthenticatedRequest, requireAuth, verifyToken } from '../middleware/auth.js'

export const agentRouter = Router()

// List available SOP runbooks
agentRouter.get('/runbooks', (req: Request, res: Response): void => {
  const runbooks = runbookService.getAvailableRunbooks()
  res.json({ count: runbooks.length, runbooks })
})

// Upload a custom team runbook (Markdown SOP). Signed-in operators only.
agentRouter.post('/runbooks', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { filename, content } = req.body
  if (!filename || !content) {
    res.status(400).json({ error: 'filename and content are required' })
    return
  }
  try {
    const saved = runbookService.saveRunbook(filename, content)
    res.status(201).json({ message: 'Runbook uploaded and indexed successfully', runbook: saved })
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save runbook' })
  }
})

// Real Ingestion Webhook for External Alerts / curl testing
// If WEBHOOK_SECRET is set, callers must send it in the x-webhook-secret header
agentRouter.post('/webhook/alert', async (req: Request, res: Response): Promise<void> => {
  const webhookSecret = process.env.WEBHOOK_SECRET
  if (webhookSecret && req.header('x-webhook-secret') !== webhookSecret) {
    res.status(401).json({ error: 'Invalid or missing x-webhook-secret header' })
    return
  }
  try {
    const title = req.body.title || req.body.service || 'Production Alert Triggered'
    const description = req.body.description || req.body.error || req.body.message || JSON.stringify(req.body)
    const priority = (req.body.priority || req.body.severity || 'HIGH').toUpperCase()
    const validPriority = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority) ? priority : 'HIGH'

    const incidentId = crypto.randomUUID()
    await db.run(`
      INSERT INTO incidents (id, title, description, priority, category, status)
      VALUES (?, ?, ?, ?, 'External Webhook', 'PENDING')
    `, [incidentId, title, description, validPriority])

    // Execute swarm in background or synchronously
    const result = await swarmService.executeSwarm(
      incidentId,
      title,
      description,
      validPriority as any,
      'External Webhook'
    )

    res.status(202).json({
      message: 'Alert ingested and processed by 16Bits OmniOps Swarm',
      incidentId,
      status: result.status,
      executionDurationMs: result.executionDurationMs,
      resolutionPreview: result.finalResolution.slice(0, 300) + '...',
      langsmithTraceId: result.langsmithTraceId,
      langsmithTraceUrl: result.langsmithTraceUrl
    })
  } catch (err: any) {
    console.error('[Webhook Error]:', err)
    res.status(500).json({ error: err.message || 'Webhook processing failed' })
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
