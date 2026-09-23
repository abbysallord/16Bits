import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
// Route handlers are async (database calls); forward rejected promises to the error handler
import 'express-async-errors'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db, initDatabase } from './db/database.js'
import { runbookService } from './services/runbookService.js'
import { authRouter } from './routes/authRoutes.js'
import { incidentRouter } from './routes/incidentRoutes.js'
import { agentRouter } from './routes/agentRoutes.js'
import { aiService } from './services/aiService.js'

const app = express()
const PORT = process.env.PORT || 8000

// Middleware
// CORS allowlist. Override with CORS_ORIGINS (comma-separated). Requests without an Origin
// header (curl, CLI, server-to-server, health checks) are not affected by CORS.
const DEFAULT_CORS_ORIGINS = [
  'https://16bits-omniops.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
]
const allowedOrigins = (process.env.CORS_ORIGINS || DEFAULT_CORS_ORIGINS.join(','))
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true)
    return callback(null, false)
  },
  allowedHeaders: ['Content-Type', 'Authorization', 'x-webhook-secret'],
}))
app.use(express.json())

// Health check endpoint
app.get('/api/health', (req, res) => {
  const aiInfo = aiService.getProviderInfo()
  res.json({
    status: 'ok',
    project: '16Bits OmniOps Backend',
    version: '1.0.0',
    database: db.kind === 'postgres' ? 'Postgres Active' : 'SQLite Active',
    ai_configured: !aiInfo.isMock,
    ai_provider: aiInfo.activeProvider,
    ai_model: aiInfo.model,
    is_mock: aiInfo.isMock
  })
})

// Mount API routes
app.use('/api/auth', authRouter)
app.use('/api/incidents', incidentRouter)
app.use('/api/agents', agentRouter)

// Webhook aliases: /api/webhooks/alert(s) (auto-detect) and /api/webhooks/{alertmanager,pagerduty,datadog}
app.use('/api/webhooks', (req, res, next) => {
  const m = req.path.match(/^\/(alerts?|alertmanager|prometheus|pagerduty|datadog)\/?$/)
  if (!m) return next()
  const source = m[1].startsWith('alert') && m[1] !== 'alertmanager' ? '' : m[1]
  // Express 4 parses req.query once, so set the hint on the parsed object as well as the URL
  if (source) (req as any).query = { ...req.query, source }
  const qs = new URLSearchParams(req.query as Record<string, string>).toString()
  req.url = `/webhook/alert${qs ? `?${qs}` : ''}`
  return agentRouter(req, res, next)
})


// Auto-seed demo credentials and benchmark incident if database is clean
async function seedDemoData() {
  const userCount = await db.get('SELECT COUNT(*) as count FROM users') as { count: number }
  if (userCount.count === 0) {
    const salt = await bcrypt.genSalt(10)
    const demoPasswordHash = await bcrypt.hash('admin123', salt)
    const demoUserId = crypto.randomUUID()

    await db.run(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, ?, ?, ?)
    `, [demoUserId, 'admin@16bits.io', demoPasswordHash, 'Lead Operator', 'admin'])

    const demoIncidentId = crypto.randomUUID()
    await db.run(`
      INSERT INTO incidents (id, title, description, priority, category, status, user_id)
      VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
    `, [demoIncidentId,
      'Payment Webhook Ingestion Throttle on Stripe Gateway',
      'Production webhook consumer queue has accumulated 4,120 unacknowledged settlement events. Upstream rate limits returning HTTP 429 on settlement callbacks, risking SLA breach for Platinum Enterprise clients.',
      'CRITICAL',
      'Fintech Operations',
      demoUserId])
    console.log('[Seed] Demo admin (admin@16bits.io / admin123) and benchmark incident initialized.')
  }

  // Purge any vulgarities or non-enterprise spam records
  try {
    await db.run(`
      DELETE FROM incidents 
      WHERE LOWER(title) LIKE '%fuck%'
         OR LOWER(title) LIKE '%friend%'
         OR LOWER(title) LIKE '%boys%'
         OR LOWER(title) LIKE '%dating%'
         OR LOWER(title) LIKE '%sex%'
         OR LENGTH(title) < 4
    `)
  } catch {}
}

// Last-resort error handler (e.g. database unavailable mid-request)
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled Route Error]:', err)
  if (res.headersSent) return
  res.status(500).json({ error: 'Internal server error' })
})

initDatabase()
  .then(() => runbookService.init())
  .then(seedDemoData)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[16Bits OmniOps] Express server running at http://localhost:${PORT}`)
    })
  })
  .catch(err => {
    // Fail the deploy loudly instead of running without a database
    console.error('[Startup Error]:', err)
    process.exit(1)
  })
