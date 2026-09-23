import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '../db/database.js'
import { DEMO_EMAIL } from '../config/demo.js'

// Password reset without email: a team admin (or the server owner, via `npm run reset-code`)
// issues a one-time code, hands it to the person out of band, and they set a new password with it.
// Only a SHA-256 hash of the code is stored; codes expire after RESET_CODE_TTL_MINUTES (default 30)
// and are deleted on use. Issuing a new code replaces the previous one.

const TTL_MIN = Number(process.env.RESET_CODE_TTL_MINUTES || 30)
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0/O/1/I/L

function sha256(v: string): string {
  return crypto.createHash('sha256').update(v).digest('hex')
}

function normalize(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function newCode(): string {
  const bytes = crypto.randomBytes(10)
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
  return `${chars.slice(0, 5)}-${chars.slice(5)}`
}

export function isDemoEmail(email: string): boolean {
  return email.trim().toLowerCase() === DEMO_EMAIL
}

export async function issueResetCode(userId: string, createdBy: string): Promise<{ code: string; expiresAt: string }> {
  const code = newCode()
  const expiresAt = new Date(Date.now() + TTL_MIN * 60_000).toISOString()
  await db.run('DELETE FROM password_resets WHERE user_id = ?', [userId])
  await db.run('INSERT INTO password_resets (user_id, code_hash, expires_at, created_by) VALUES (?, ?, ?, ?)', [
    userId,
    sha256(normalize(code)),
    expiresAt,
    createdBy
  ])
  return { code, expiresAt }
}

// Sets the password and bumps token_version, which signs out every existing session. Returns the new version.
export async function setPassword(userId: string, newPassword: string): Promise<number> {
  const hash = await bcrypt.hash(newPassword, await bcrypt.genSalt(10))
  await db.run('UPDATE users SET password_hash = ?, token_version = COALESCE(token_version, 0) + 1 WHERE id = ?', [hash, userId])
  const row = await db.get<{ token_version: number }>('SELECT token_version FROM users WHERE id = ?', [userId])
  return Number(row?.token_version ?? 0)
}

// Returns the user on success, null for any wrong email / wrong code / expired code (same answer for all)
export async function redeemResetCode(email: string, code: string, newPassword: string): Promise<any | null> {
  if (isDemoEmail(email)) return null
  const user = await db.get<any>('SELECT * FROM users WHERE email = ?', [email])
  if (!user) return null
  const row = await db.get<{ code_hash: string; expires_at: string }>('SELECT code_hash, expires_at FROM password_resets WHERE user_id = ?', [user.id])
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await db.run('DELETE FROM password_resets WHERE user_id = ?', [user.id])
    return null
  }
  const a = Buffer.from(sha256(normalize(code)), 'hex')
  const b = Buffer.from(row.code_hash, 'hex')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  const tv = await setPassword(user.id, newPassword)
  await db.run('DELETE FROM password_resets WHERE user_id = ?', [user.id])
  return { ...user, token_version: tv }
}
