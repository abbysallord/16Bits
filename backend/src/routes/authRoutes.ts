import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '../db/database.js'
import { registerSchema, loginSchema } from '../schemas/authSchemas.js'
import { validate } from '../middleware/validate.js'
import { generateToken, requireAuth, AuthenticatedRequest } from '../middleware/auth.js'

export const authRouter = Router()

// Register endpoint
authRouter.post('/register', validate(registerSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, password, name } = req.body
  // Self-registration always creates an operator; never trust a client-supplied role
  const role = 'operator'

  // Check if user already exists
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
  if (existingUser) {
    res.status(409).json({ error: 'User with this email already exists' })
    return
  }

  const salt = await bcrypt.genSalt(10)
  const passwordHash = await bcrypt.hash(password, salt)
  const userId = crypto.randomUUID()

  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, email, passwordHash, name, role)

  const token = generateToken({ id: userId, email, name, role: role })

  res.status(201).json({
    message: 'User registered successfully',
    token,
    user: { id: userId, email, name, role: role }
  })
})

// Login endpoint
authRouter.post('/login', validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash)
  if (!isValidPassword) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  })

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  })
})

// Current user profile
authRouter.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  res.json({ user: req.user })
})
