import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from './db/database.js'
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
    database: 'SQLite Active',
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

// Webhook Aliases: supports both /api/agents/webhook/alert and /api/webhooks/alerts
app.use('/api/webhooks', (req, res, next) => {
  if (req.url === '/alerts' || req.url === '/alert' || req.url === '/alerts/' || req.url === '/alert/') {
    req.url = '/webhook/alert'
    return agentRouter(req, res, next)
  }
  next()
})


// Auto-seed demo credentials and benchmark incident if database is clean
async function seedDemoData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
  if (userCount.count === 0) {
    const salt = await bcrypt.genSalt(10)
    const demoPasswordHash = await bcrypt.hash('admin123', salt)
    const demoUserId = crypto.randomUUID()

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(demoUserId, 'admin@16bits.io', demoPasswordHash, 'Lead Operator', 'admin')

    const demoIncidentId = crypto.randomUUID()
    db.prepare(`
      INSERT INTO incidents (id, title, description, priority, category, status, user_id)
      VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
    `).run(
      demoIncidentId,
      'Payment Webhook Ingestion Throttle on Stripe Gateway',
      'Production webhook consumer queue has accumulated 4,120 unacknowledged settlement events. Upstream rate limits returning HTTP 429 on settlement callbacks, risking SLA breach for Platinum Enterprise clients.',
      'CRITICAL',
      'Fintech Operations',
      demoUserId
    )
    console.log('[Seed] Demo admin (admin@16bits.io / admin123) and benchmark incident initialized.')
  }

  // Purge any vulgarities or non-enterprise spam records
  try {
    db.prepare(`
      DELETE FROM incidents 
      WHERE title LIKE '%fuck%' 
         OR title LIKE '%friend%' 
         OR title LIKE '%boys%' 
         OR title LIKE '%dating%'
         OR title LIKE '%sex%'
         OR length(title) < 4
    `).run()
  } catch {}
}

seedDemoData().then(() => {
  app.listen(PORT, () => {
    console.log(`[16Bits OmniOps] Express server running at http://localhost:${PORT}`)
  })
}).catch(err => {
  console.error('[Seed Error]:', err)
})
