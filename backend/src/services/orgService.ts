import crypto from 'crypto'
import { AsyncLocalStorage } from 'async_hooks'
import { db } from '../db/database.js'

// Lightweight multi-tenancy. Every user, incident and uploaded runbook belongs to one org (team).
// - The "demo" org is the public workspace: the demo account, signed-out visitors and token-less CLI
//   calls land there (only while DEMO_ACCOUNT is on). It keeps using the server-wide SLACK_WEBHOOK_URL.
// - Every other org has its own Slack webhook, alert ingest key (secret alert URLs), invite code and,
//   optionally, its own Groq API key so it runs on its own quota.

export const DEMO_ORG_ID = 'demo'

export interface Org {
  id: string
  name: string
  invite_code: string
  ingest_key: string
  slack_webhook_url: string | null
  groq_api_key: string | null
  created_at?: string
}

export interface OrgContext {
  orgId: string
  slackWebhookUrl: string | null
  groqApiKey: string | null
}

const storage = new AsyncLocalStorage<OrgContext>()

const randomCode = (bytes: number) => crypto.randomBytes(bytes).toString('base64url')

export async function createOrg(name: string, id: string = crypto.randomUUID()): Promise<Org> {
  const org: Org = {
    id,
    name: name.trim().slice(0, 80) || 'My team',
    invite_code: randomCode(6),
    ingest_key: randomCode(18),
    slack_webhook_url: null,
    groq_api_key: null,
  }
  await db.run('INSERT INTO orgs (id, name, invite_code, ingest_key) VALUES (?, ?, ?, ?)', [org.id, org.name, org.invite_code, org.ingest_key])
  return org
}

export async function getOrg(id: string): Promise<Org | undefined> {
  return db.get<Org>('SELECT * FROM orgs WHERE id = ?', [id])
}

export async function getOrgByInvite(code: string): Promise<Org | undefined> {
  return db.get<Org>('SELECT * FROM orgs WHERE invite_code = ?', [code.trim()])
}

export async function getOrgByIngestKey(key: string): Promise<Org | undefined> {
  if (!key || key.length < 16) return undefined
  const org = await db.get<Org>('SELECT * FROM orgs WHERE ingest_key = ?', [key])
  // Constant-time compare on top of the lookup
  if (!org) return undefined
  const a = Buffer.from(org.ingest_key)
  const b = Buffer.from(key)
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? org : undefined
}

export async function rotateIngestKey(orgId: string): Promise<string> {
  const key = randomCode(18)
  await db.run('UPDATE orgs SET ingest_key = ? WHERE id = ?', [key, orgId])
  return key
}

export async function rotateInviteCode(orgId: string): Promise<string> {
  const code = randomCode(6)
  await db.run('UPDATE orgs SET invite_code = ? WHERE id = ?', [code, orgId])
  return code
}

export async function getUserOrgId(userId: string): Promise<string | null> {
  const row = await db.get<{ org_id: string | null }>('SELECT org_id FROM users WHERE id = ?', [userId])
  return row?.org_id ?? null
}

// Boot migration: create the demo org and give pre-tenancy rows an owner. Idempotent.
export async function initOrgs(demoEmail: string): Promise<void> {
  if (!(await getOrg(DEMO_ORG_ID))) await createOrg('Public demo', DEMO_ORG_ID)

  await db.run('UPDATE users SET org_id = ? WHERE org_id IS NULL AND LOWER(email) = ?', [DEMO_ORG_ID, demoEmail])
  // Accounts created before orgs existed each get their own private team
  const orphans = await db.all<{ id: string; name: string }>('SELECT id, name FROM users WHERE org_id IS NULL')
  for (const u of orphans) {
    const org = await createOrg(`${u.name}'s team`)
    await db.run("UPDATE users SET org_id = ?, role = 'admin' WHERE id = ?", [org.id, u.id])
  }
  // Old incidents follow their creator; anonymous ones (console, CLI, webhooks) were public demo traffic
  await db.run('UPDATE incidents SET org_id = (SELECT org_id FROM users WHERE users.id = incidents.user_id) WHERE org_id IS NULL AND user_id IS NOT NULL')
  await db.run('UPDATE incidents SET org_id = ? WHERE org_id IS NULL', [DEMO_ORG_ID])
  await db.run("UPDATE runbooks SET org_id = ? WHERE org_id IS NULL AND source = 'upload'", [DEMO_ORG_ID])
  if (orphans.length) console.log(`[Orgs] Migrated ${orphans.length} existing account(s) into their own teams`)
}

export function slackUrlFor(org: Org): string | null {
  if (org.slack_webhook_url) return org.slack_webhook_url
  return org.id === DEMO_ORG_ID ? process.env.SLACK_WEBHOOK_URL || null : null
}

// Run work (a swarm run, a background webhook triage) with the org's Slack/Groq settings attached
export async function runInOrg<T>(orgId: string, fn: () => Promise<T>): Promise<T> {
  const org = await getOrg(orgId)
  const ctx: OrgContext = {
    orgId,
    slackWebhookUrl: org ? slackUrlFor(org) : null,
    groqApiKey: org?.groq_api_key || null,
  }
  return storage.run(ctx, fn)
}

export function currentOrg(): OrgContext | undefined {
  return storage.getStore()
}

// Only accept Slack incoming-webhook URLs (prevents using the server to call arbitrary URLs)
export function isSlackWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'hooks.slack.com' && u.pathname.startsWith('/services/')
  } catch {
    return false
  }
}

export function maskSecret(v: string | null): string | null {
  if (!v) return null
  return v.length <= 10 ? '••••' : `${v.slice(0, 6)}••••${v.slice(-4)}`
}
