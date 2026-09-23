import { Request, Response, NextFunction } from 'express'

// Small in-memory fixed-window rate limiter (single Render instance, no Redis needed).
// Disable with RATE_LIMIT=off. Limits can be tuned per bucket, e.g. RATE_LIMIT_EXECUTE=40.

interface Bucket {
  count: number
  resetAt: number
}

const stores = new Map<string, Map<string, Bucket>>()

// Drop expired windows so memory stays flat
setInterval(() => {
  const now = Date.now()
  for (const store of stores.values()) for (const [k, b] of store) if (b.resetAt <= now) store.delete(k)
}, 60_000).unref()

export function rateLimitEnabled(): boolean {
  return (process.env.RATE_LIMIT || 'on').toLowerCase() !== 'off'
}

// failedOnly: count only responses with status >= 400 (sign-in: successful logins never lock anyone out)
export function rateLimit(opts: { name: string; max: number; windowMs: number; key?: (req: Request) => string; message?: string; failedOnly?: boolean }) {
  const store = new Map<string, Bucket>()
  stores.set(opts.name, store)
  const envMax = Number(process.env[`RATE_LIMIT_${opts.name.toUpperCase()}`])
  const max = Number.isFinite(envMax) && envMax > 0 ? envMax : opts.max

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!rateLimitEnabled()) return next()
    const now = Date.now()
    const key = `${req.ip || 'unknown'}|${opts.key ? opts.key(req) : ''}`
    let bucket = store.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs }
      store.set(key, bucket)
    }
    const b = bucket
    const resetSec = Math.ceil((b.resetAt - now) / 1000)
    if (b.count >= max) {
      res.setHeader('Retry-After', String(resetSec))
      res.status(429).json({ error: opts.message || 'Too many requests, slow down', retryAfterSeconds: resetSec })
      return
    }
    if (opts.failedOnly) {
      res.on('finish', () => {
        if (res.statusCode >= 400) b.count += 1
      })
    } else {
      b.count += 1
    }
    res.setHeader('RateLimit-Limit', String(max))
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - b.count)))
    res.setHeader('RateLimit-Reset', String(resetSec))
    next()
  }
}

const MIN = 60_000

// Brute-force protection: 10 failed attempts per IP + email per 15 minutes
export const loginLimiter = rateLimit({
  name: 'login',
  max: 10,
  windowMs: 15 * MIN,
  key: (req) => String(req.body?.email || '').toLowerCase(),
  message: 'Too many failed sign-in attempts for this account. Try again in a few minutes.',
  failedOnly: true,
})
export const registerLimiter = rateLimit({ name: 'register', max: 20, windowMs: 60 * MIN, message: 'Too many sign-ups from this address. Try again later.' })
// Each run makes several LLM calls; keep one client from burning the Groq quota.
// 60 per 10 minutes per IP leaves room for a room of judges sharing one venue Wi-Fi address
export const executeLimiter = rateLimit({ name: 'execute', max: 60, windowMs: 10 * MIN, message: 'Too many agent runs from this address. Try again in a few minutes.' })
export const webhookLimiter = rateLimit({ name: 'webhook', max: 120, windowMs: MIN, message: 'Alert webhook rate limit hit' })
export const approveLimiter = rateLimit({ name: 'approve', max: 30, windowMs: MIN })
