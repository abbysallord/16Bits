import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const getSecret = () => process.env.JWT_SECRET || '16bits-hackathon-super-secret-key-2026'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    email: string
    name: string
    role: string
  }
}

export function generateToken(payload: { id: string; email: string; name: string; role: string }): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '7d' })
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' })
    return
  }

  const token = authHeader.split(' ')[1]
  try {
    const decoded = jwt.verify(token, getSecret()) as {
      id: string
      email: string
      name: string
      role: string
    }
    req.user = decoded
    next()
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' })
  }
}
