import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { DEMO_ORG_ID } from '../services/orgService.js'
import { db } from '../db/database.js'
import { demoAccountEnabled } from '../config/demo.js'

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET is not set. Add it to backend/.env (local) or your host env vars (Render/Railway).')
  }
  return secret
}

// Fail fast at boot instead of on the first login
getJwtSecret()

export interface TokenUser {
  id: string
  email: string
  name: string
  role: string
  orgId?: string
  // Session version: bumped on password reset/change so older tokens stop working
  tv?: number
}

export interface AuthenticatedRequest extends Request {
  user?: TokenUser
  // The org (team) this request acts in. Set by requireAuth, or by resolveOrg for public routes.
  orgId?: string | null
}

export function generateToken(payload: TokenUser): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenUser | null {
  try {
    return jwt.verify(token, getJwtSecret()) as TokenUser
  } catch {
    return null
  }
}

function bearer(req: Request): string | null | undefined {
  const h = req.headers.authorization
  if (!h) return undefined
  if (!h.startsWith('Bearer ')) return null
  return h.slice(7).trim()
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = bearer(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' })
    return
  }
  const decoded = verifyToken(token)
  if (!decoded) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' })
    return
  }
  // One lookup per request: the account must still exist, and the token must carry the current session
  // version (a password reset or change bumps it, which signs out every older session).
  // Tokens issued before orgs existed carry no orgId; the row supplies it so old sessions keep working.
  const row = await db.get<{ org_id: string | null; token_version: number | null }>('SELECT org_id, token_version FROM users WHERE id = ?', [decoded.id])
  const orgId = decoded.orgId || row?.org_id || null
  if (!row || !orgId) {
    res.status(401).json({ error: 'Unauthorized: account no longer exists' })
    return
  }
  if ((decoded.tv ?? 0) !== Number(row.token_version ?? 0)) {
    res.status(401).json({ error: 'Session expired because the password was changed. Please sign in again.' })
    return
  }
  req.user = { ...decoded, orgId }
  req.orgId = orgId
  next()
}

// Public routes: a valid token scopes the request to the caller's org; no token means the public demo
// workspace (or nothing, when DEMO_ACCOUNT is off). A bad token is rejected instead of silently falling back.
export async function resolveOrg(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = bearer(req)
  if (token === undefined) {
    req.orgId = demoAccountEnabled() ? DEMO_ORG_ID : null
    return next()
  }
  return requireAuth(req, res, next)
}
