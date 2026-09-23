// Slack notifications via an incoming webhook (SLACK_WEBHOOK_URL).
// Each triaged incident is posted with a button that deep-links to /incidents/:id on the web console
// (APP_URL), where on-call can review the plan and approve it.

const DEFAULT_APP_URL = 'https://16bits-omniops.vercel.app'

export function incidentUrl(incidentId: string): string {
  const base = (process.env.APP_URL || DEFAULT_APP_URL).replace(/\/$/, '')
  return `${base}/incidents/${incidentId}`
}

const PRIORITY_EMOJI: Record<string, string> = {
  CRITICAL: ':red_circle:',
  HIGH: ':large_orange_circle:',
  MEDIUM: ':large_yellow_circle:',
  LOW: ':white_circle:',
}

// Slack mrkdwn needs &, <, > escaped
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function post(payload: unknown): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL
  if (!url) return
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) console.warn(`[Slack] webhook returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  } catch (err: any) {
    console.warn(`[Slack] webhook failed: ${err.message}`)
  }
}

export async function notifyIncidentTriaged(i: {
  incidentId: string
  title: string
  priority: string
  status: string
  resolution: string
  runbook?: string
}): Promise<void> {
  const needsApproval = i.status === 'AWAITING_APPROVAL'
  const link = incidentUrl(i.incidentId)
  const summary = i.resolution.replace(/\s+/g, ' ').trim()
  const headline = needsApproval ? 'Approval needed' : i.status === 'FAILED' ? 'Triage failed' : 'Auto-resolved (low risk)'

  await post({
    text: `[OmniOps] ${headline}: ${i.title} [${i.priority}] ${link}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${PRIORITY_EMOJI[i.priority] || ''} *${esc(headline)}* · ${esc(i.priority)}\n*<${link}|${esc(i.title)}>*`,
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: esc(summary.length > 600 ? summary.slice(0, 597) + '...' : summary) || '_No resolution text_' },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `Status: *${esc(i.status)}*${i.runbook ? ` · Runbook: ${esc(i.runbook)}` : ''} · ID \`${i.incidentId}\`` },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: needsApproval ? 'Review & approve' : 'View incident' },
            url: link,
            ...(needsApproval ? { style: 'primary' } : {}),
          },
        ],
      },
    ],
  })
}

export async function notifyIncidentApproved(i: { incidentId: string; title: string; approvedBy: string }): Promise<void> {
  const link = incidentUrl(i.incidentId)
  await post({
    text: `[OmniOps] Approved by ${i.approvedBy}: ${i.title} ${link}`,
    blocks: [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `:white_check_mark: *Plan approved* by ${esc(i.approvedBy)}\n<${link}|${esc(i.title)}>` },
      },
    ],
  })
}
