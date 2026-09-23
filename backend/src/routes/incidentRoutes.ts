import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { db } from '../db/database.js'
import { createIncidentSchema } from '../schemas/incidentSchemas.js'
import { validate } from '../middleware/validate.js'
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js'

export const incidentRouter = Router()

// List all incidents (filtered for clean enterprise records)
incidentRouter.get('/', (req: Request, res: Response): void => {
  const incidents = db.prepare(`
    SELECT * FROM incidents ORDER BY created_at DESC LIMIT 30
  `).all() as any[]
  
  const BANNED_PATTERNS = ['fuck', 'shit', 'bitch', 'ass', 'boy', 'friend', 'dating', 'sex']
  const cleanIncidents = incidents.filter(inc => {
    const text = ((inc.title || '') + ' ' + (inc.description || '')).toLowerCase()
    return !BANNED_PATTERNS.some(p => text.includes(p)) && (inc.title || '').length >= 5
  })

  res.json({ incidents: cleanIncidents })
})

// Get incident details with full agent execution audit trail
incidentRouter.get('/:id', (req: Request, res: Response): void => {
  const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(req.params.id) as any
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' })
    return
  }

  const logs = db.prepare(`
    SELECT * FROM agent_logs WHERE incident_id = ? ORDER BY step_number ASC
  `).all(req.params.id)

  res.json({
    incident,
    logs: logs.map((log: any) => ({
      ...log,
      data_payload: log.data_payload ? JSON.parse(log.data_payload) : null
    }))
  })
})

// Create incident
incidentRouter.post('/', validate(createIncidentSchema), (req: AuthenticatedRequest, res: Response): void => {
  const { title, description, priority, category } = req.body
  const id = crypto.randomUUID()
  const userId = req.user?.id || null

  db.prepare(`
    INSERT INTO incidents (id, title, description, priority, category, status, user_id)
    VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
  `).run(id, title, description, priority, category || 'System Incident', userId)

  const created = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id)
  res.status(201).json({
    message: 'Incident created successfully',
    incident: created
  })
})
