import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db/database.js'
import { createIncidentSchema } from '../schemas/incidentSchemas.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, resolveOrg, AuthenticatedRequest } from '../middleware/auth.js'

export const incidentRouter = Router()

// List all incidents (filtered for clean enterprise records)
// Signed in: your team's incidents. Signed out: the public demo workspace (empty when DEMO_ACCOUNT=off).
incidentRouter.get('/', resolveOrg, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.orgId) {
    res.json({ incidents: [] })
    return
  }
  const incidents = await db.all(`
    SELECT * FROM incidents WHERE org_id = ? ORDER BY created_at DESC LIMIT 30
  `, [req.orgId]) as any[]
  
  const BANNED_PATTERNS = ['fuck', 'shit', 'bitch', 'ass', 'boy', 'friend', 'dating', 'sex']
  const cleanIncidents = incidents.filter(inc => {
    const text = ((inc.title || '') + ' ' + (inc.description || '')).toLowerCase()
    return !BANNED_PATTERNS.some(p => text.includes(p)) && (inc.title || '').length >= 5
  })

  res.json({ incidents: cleanIncidents })
})

// Get incident details with full agent execution audit trail
incidentRouter.get('/:id', resolveOrg, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const incident = await db.get('SELECT * FROM incidents WHERE id = ?', [req.params.id]) as any
  if (!incident || incident.org_id !== req.orgId) {
    // Another team's incident: signed-out visitors are told to sign in, members of other teams get 404
    if (incident && !req.user) {
      res.status(401).json({ error: 'Sign in with your team account to view this incident' })
      return
    }
    res.status(404).json({ error: 'Incident not found' })
    return
  }

  const logs = await db.all(`
    SELECT * FROM agent_logs WHERE incident_id = ? ORDER BY step_number ASC
  `, [req.params.id])

  res.json({
    incident,
    logs: logs.map((log: any) => ({
      ...log,
      data_payload: log.data_payload ? JSON.parse(log.data_payload) : null
    }))
  })
})

// Create incident
incidentRouter.post('/', requireAuth, validate(createIncidentSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { title, description, priority, category } = req.body
  const id = crypto.randomUUID()
  const userId = req.user?.id || null

  await db.run(`
    INSERT INTO incidents (id, title, description, priority, category, status, user_id, org_id)
    VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)
  `, [id, title, description, priority, category || 'System Incident', userId, req.orgId])

  const created = await db.get('SELECT * FROM incidents WHERE id = ?', [id])
  res.status(201).json({
    message: 'Incident created successfully',
    incident: created
  })
})
