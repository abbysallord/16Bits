import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from './db/database.js'
import { authRouter } from './routes/authRoutes.js'
import { incidentRouter } from './routes/incidentRoutes.js'
import { agentRouter } from './routes/agentRoutes.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 8000

// Middleware
app.use(cors({
  origin: '*', // Open for rapid hackathon client prototyping
  credentials: true
}))
app.use(express.json())

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    project: '16Bits OmniOps Backend',
    version: '1.0.0',
    database: 'SQLite Active',
    ai_configured: Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY)
  })
})

// Mount API routes
app.use('/api/auth', authRouter)
app.use('/api/incidents', incidentRouter)
app.use('/api/agents', agentRouter)

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
}

seedDemoData().then(() => {
  app.listen(PORT, () => {
    console.log(`⚡ [16Bits OmniOps] Express server running at http://localhost:${PORT}`)
  })
}).catch(err => {
  console.error('[Seed Error]:', err)
})
