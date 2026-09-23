import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { db } from '../db/database.js'
import { registerSchema, loginSchema, resetPasswordSchema, changePasswordSchema } from '../schemas/authSchemas.js'
import { validate } from '../middleware/validate.js'
import { generateToken, requireAuth, AuthenticatedRequest } from '../middleware/auth.js'
import { loginLimiter, registerLimiter, resetLimiter, changePasswordLimiter } from '../middleware/rateLimit.js'
import { redeemResetCode, setPassword, isDemoEmail } from '../services/passwordResetService.js'
import { DEMO_EMAIL, demoAccountEnabled } from '../config/demo.js'
import { createOrg, getOrg, getOrgByInvite } from '../services/orgService.js'

export const authRouter = Router()

// Register endpoint
authRouter.post('/register', registerLimiter, validate(registerSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, password, name, teamName, inviteCode } = req.body

  // Check if user already exists
  const existingUser = await db.get('SELECT id FROM users WHERE email = ?', [email])
  if (existingUser) {
    res.status(409).json({ error: 'User with this email already exists' })
    return
  }

  // Joining with an invite code makes you an operator in that team; otherwise you get a new team
  // and are its admin. The public demo team cannot be joined.
  let org
  let role: 'admin' | 'operator'
  if (inviteCode && inviteCode.trim()) {
    org = await getOrgByInvite(inviteCode)
    if (!org || org.id === 'demo') {
      res.status(400).json({ error: 'Invite code not found' })
      return
    }
    role = 'operator'
  } else {
    org = await createOrg(teamName && teamName.trim() ? teamName : `${name}'s team`)
    role = 'admin'
  }

  const salt = await bcrypt.genSalt(10)
  const passwordHash = await bcrypt.hash(password, salt)
  const userId = crypto.randomUUID()

  await db.run(`
    INSERT INTO users (id, email, password_hash, name, role, org_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [userId, email, passwordHash, name, role, org.id])

  const token = generateToken({ id: userId, email, name, role, orgId: org.id })

  res.status(201).json({
    message: inviteCode ? `Joined ${org.name}` : `Account and team "${org.name}" created`,
    token,
    user: { id: userId, email, name, role, orgId: org.id, orgName: org.name }
  })
})

// Login endpoint
authRouter.post('/login', loginLimiter, validate(loginSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body

  if (!demoAccountEnabled() && String(email).toLowerCase() === DEMO_EMAIL) {
    res.status(403).json({ error: 'The public demo account is disabled on this server' })
    return
  }

  const user = await db.get('SELECT * FROM users WHERE email = ?', [email]) as any
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash)
  if (!isValidPassword) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const org = user.org_id ? await getOrg(user.org_id) : undefined
  const token = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    orgId: user.org_id,
    tv: Number(user.token_version ?? 0)
  })

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      orgId: user.org_id,
      orgName: org?.name
    }
  })
})

// Forgot password: redeem a one-time code from a team admin (Settings -> Members) or the server owner
authRouter.post('/reset-password', resetLimiter, validate(resetPasswordSchema), async (req: Request, res: Response): Promise<void> => {
  const { email, code, newPassword } = req.body
  const user = await redeemResetCode(email, code, newPassword)
  if (!user) {
    res.status(400).json({ error: 'Invalid or expired reset code. Ask your team admin for a new one.' })
    return
  }
  const org = user.org_id ? await getOrg(user.org_id) : undefined
  const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.org_id, tv: Number(user.token_version ?? 0) })
  res.json({
    message: 'Password updated. You are signed in.',
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, orgId: user.org_id, orgName: org?.name }
  })
})

// Change password while signed in
authRouter.post('/change-password', requireAuth, changePasswordLimiter, validate(changePasswordSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body
  if (isDemoEmail(req.user!.email)) {
    res.status(403).json({ error: 'The public demo account password cannot be changed' })
    return
  }
  const user = await db.get<any>('SELECT id, password_hash FROM users WHERE id = ?', [req.user!.id])
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
    res.status(400).json({ error: 'Current password is incorrect' })
    return
  }
  const tv = await setPassword(user.id, newPassword)
  // Every other session is now signed out; hand this one a fresh token so it stays signed in
  const token = generateToken({ id: req.user!.id, email: req.user!.email, name: req.user!.name, role: req.user!.role, orgId: req.orgId || undefined, tv })
  res.json({ message: 'Password changed. Other sessions were signed out.', token })
})

// Current user profile
authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const org = req.orgId ? await getOrg(req.orgId) : undefined
  res.json({ user: { ...req.user, orgName: org?.name } })
})
