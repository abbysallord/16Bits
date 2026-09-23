import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db/database.js'
import { swarmService } from '../services/swarmService.js'
import { runbookService } from '../services/runbookService.js'
import { runAgentSchema } from '../schemas/incidentSchemas.js'
import { validate } from '../middleware/validate.js'

export const agentRouter = Router()

// List available SOP runbooks
agentRouter.get('/runbooks', (req: Request, res: Response): void => {
  const runbooks = runbookService.getAvailableRunbooks()
  res.json({ count: runbooks.length, runbooks })
})

// Real Ingestion Webhook for External Alerts / curl testing
agentRouter.post('/webhook/alert', async (req: Request, res: Response): Promise<void> => {
  try {
    const title = req.body.title || req.body.service || 'Production Alert Triggered'
    const description = req.body.description || req.body.error || req.body.message || JSON.stringify(req.body)
    const priority = (req.body.priority || req.body.severity || 'HIGH').toUpperCase()
    const validPriority = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priority) ? priority : 'HIGH'

    const incidentId = crypto.randomUUID()
    db.prepare(`
      INSERT INTO incidents (id, title, description, priority, category, status)
      VALUES (?, ?, ?, ?, 'External Webhook', 'PENDING')
    `).run(incidentId, title, description, validPriority)

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
      resolutionPreview: result.finalResolution.slice(0, 300) + '...'
    })
  } catch (err: any) {
    console.error('[Webhook Error]:', err)
    res.status(500).json({ error: err.message || 'Webhook processing failed' })
  }
})

// Human-in-the-Loop Operator Authorization
agentRouter.post('/approve', async (req: Request, res: Response): Promise<void> => {
  const { incidentId, approvedBy } = req.body
  if (!incidentId) {
    res.status(400).json({ error: 'incidentId is required' })
    return
  }

  try {
    swarmService.approveIncident(incidentId, approvedBy || 'Lead Operator')
    const updated = db.prepare('SELECT * FROM incidents WHERE id = ?').get(incidentId)
    res.json({
      message: 'Remediation plan authorized by Human Operator. Status updated to RESOLVED.',
      incident: updated
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
      db.prepare(`
        INSERT INTO incidents (id, title, description, priority, category, status)
        VALUES (?, ?, ?, ?, ?, 'PENDING')
      `).run(incidentId, title, description, priority || 'HIGH', category || 'Enterprise Workflow')
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
      db.prepare(`
        INSERT INTO incidents (id, title, description, priority, category, status)
        VALUES (?, ?, ?, ?, ?, 'PENDING')
      `).run(incidentId, title, description, priority || 'HIGH', category || 'Enterprise Workflow')
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
