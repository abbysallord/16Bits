import { Router, Response } from 'express'
import { z } from 'zod'
import { db } from '../db/database.js'
import { AuthenticatedRequest, generateToken, requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { DEMO_ORG_ID, getOrg, getOrgByInvite, isSlackWebhookUrl, maskSecret, rotateIngestKey, rotateInviteCode, runInOrg, slackUrlFor } from '../services/orgService.js'
import { sendSlackTest } from '../services/slackService.js'
import { issueResetCode } from '../services/passwordResetService.js'

// Team settings: Slack webhook, alert URLs, invite code, optional Groq key. Signed-in members can read;
// only team admins can change. The public demo team is read-only.
export const orgRouter = Router()

// Tests only: ALLOW_LOCAL_SLACK_URL=1 also accepts a localhost mock Slack endpoint
function isLocalTestUrl(url: string): boolean {
  if (process.env.ALLOW_LOCAL_SLACK_URL !== '1') return false
  try {
    const u = new URL(url)
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

function publicBase(req: AuthenticatedRequest): string {
  const configured = process.env.PUBLIC_API_URL
  if (configured) return configured.replace(/\/$/, '')
  return `${req.protocol}://${req.get('host')}`
}

async function orgView(req: AuthenticatedRequest) {
  const org = (await getOrg(req.orgId!))!
  const members = await db.all<{ id: string; name: string; email: string; role: string }>(
    'SELECT id, name, email, role FROM users WHERE org_id = ? ORDER BY created_at ASC LIMIT 100',
    [org.id]
  )
  const isDemo = org.id === DEMO_ORG_ID
  const canEdit = !isDemo && req.user?.role === 'admin'
  const base = `${publicBase(req)}/api/webhooks/t/${org.ingest_key}`
  return {
    id: org.id,
    name: org.name,
    isDemo,
    canEdit,
    role: req.user?.role,
    // The demo team's invite code and alert key are never shown (anyone can sign in to it)
    inviteCode: isDemo ? null : org.invite_code,
    alertUrls: isDemo
      ? null
      : { alertmanager: `${base}/alertmanager`, pagerduty: `${base}/pagerduty`, datadog: `${base}/datadog`, generic: `${base}/alert` },
    slack: {
      configured: Boolean(slackUrlFor(org)),
      source: org.slack_webhook_url ? 'team' : isDemo && process.env.SLACK_WEBHOOK_URL ? 'server' : null,
      webhookPreview: canEdit ? maskSecret(org.slack_webhook_url) : null,
    },
    groq: { ownKey: Boolean(org.groq_api_key), keyPreview: canEdit ? maskSecret(org.groq_api_key) : null },
    members: members.map((m) => ({ ...(canEdit ? { id: m.id } : {}), name: m.name, email: isDemo ? undefined : m.email, role: m.role })).slice(0, isDemo ? 0 : 100),
  }
}

function requireAdmin(req: AuthenticatedRequest, res: Response): boolean {
  if (req.orgId === DEMO_ORG_ID) {
    res.status(403).json({ error: 'The public demo team is read-only. Create your own team to connect Slack and alerts.' })
    return false
  }
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Only team admins can change settings' })
    return false
  }
  return true
}

orgRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json({ org: await orgView(req) })
})

const updateSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  // Empty string disconnects
  slackWebhookUrl: z.string().max(500).optional(),
  groqApiKey: z.string().max(200).optional(),
})

orgRouter.patch('/', requireAuth, validate(updateSchema), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return
  const { name, slackWebhookUrl, groqApiKey } = req.body as z.infer<typeof updateSchema>
  if (slackWebhookUrl && !isSlackWebhookUrl(slackWebhookUrl) && !isLocalTestUrl(slackWebhookUrl)) {
    res.status(400).json({ error: 'That is not a Slack incoming-webhook URL (https://hooks.slack.com/services/...)' })
    return
  }
  if (groqApiKey && !groqApiKey.startsWith('gsk_')) {
    res.status(400).json({ error: 'Groq API keys start with gsk_' })
    return
  }
  if (name !== undefined) await db.run('UPDATE orgs SET name = ? WHERE id = ?', [name.trim(), req.orgId])
  if (slackWebhookUrl !== undefined) await db.run('UPDATE orgs SET slack_webhook_url = ? WHERE id = ?', [slackWebhookUrl.trim() || null, req.orgId])
  if (groqApiKey !== undefined) await db.run('UPDATE orgs SET groq_api_key = ? WHERE id = ?', [groqApiKey.trim() || null, req.orgId])
  res.json({ message: 'Team settings saved', org: await orgView(req) })
})

orgRouter.post('/slack/test', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return
  const org = (await getOrg(req.orgId!))!
  if (!slackUrlFor(org)) {
    res.status(400).json({ error: 'Add a Slack webhook URL first' })
    return
  }
  const result = await runInOrg(org.id, () => sendSlackTest(org.name, req.user!.name))
  if (!result.ok) {
    res.status(502).json({ error: `Slack rejected the test message: ${result.error}` })
    return
  }
  res.json({ message: 'Test message sent to Slack' })
})

orgRouter.post('/rotate-alert-key', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return
  await rotateIngestKey(req.orgId!)
  res.json({ message: 'New alert URLs issued. Update Alertmanager/PagerDuty/Datadog; the old URLs stop working now.', org: await orgView(req) })
})

// Admin issues a one-time password reset code for a member of their own team (no email needed)
orgRouter.post('/members/:userId/reset-code', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return
  const member = await db.get<{ id: string; name: string; email: string }>('SELECT id, name, email FROM users WHERE id = ? AND org_id = ?', [
    String(req.params.userId),
    req.orgId
  ])
  if (!member) {
    res.status(404).json({ error: 'No such member in your team' })
    return
  }
  const { code, expiresAt } = await issueResetCode(member.id, req.user!.email)
  res.json({
    message: `Reset code for ${member.name}. Give it to them privately; it works once and expires at ${expiresAt}.`,
    code,
    expiresAt,
    member: { name: member.name, email: member.email }
  })
})

orgRouter.post('/rotate-invite', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!requireAdmin(req, res)) return
  await rotateInviteCode(req.orgId!)
  res.json({ message: 'New invite code issued; the old one no longer works', org: await orgView(req) })
})

// Move your account into another team with its invite code (for accounts created before teams existed,
// or people switching teams). Your old team keeps its incidents.
orgRouter.post('/join', requireAuth, validate(z.object({ inviteCode: z.string().min(4).max(40) })), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const target = await getOrgByInvite(req.body.inviteCode)
  if (!target || target.id === DEMO_ORG_ID) {
    res.status(400).json({ error: 'Invite code not found' })
    return
  }
  if (req.orgId === DEMO_ORG_ID) {
    res.status(403).json({ error: 'The shared demo account cannot switch teams. Create your own account instead.' })
    return
  }
  await db.run("UPDATE users SET org_id = ?, role = 'operator' WHERE id = ?", [target.id, req.user!.id])
  const token = generateToken({ id: req.user!.id, email: req.user!.email, name: req.user!.name, role: 'operator', orgId: target.id, tv: req.user!.tv ?? 0 })
  res.json({
    message: `Joined ${target.name}`,
    token,
    user: { id: req.user!.id, email: req.user!.email, name: req.user!.name, role: 'operator', orgId: target.id, orgName: target.name }
  })
})
