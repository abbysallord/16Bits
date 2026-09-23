import crypto from 'crypto'
import { Request } from 'express'

// Normalizes alert payloads from common monitoring tools into one incident shape.
// Supported as-is (no custom templates needed): Prometheus Alertmanager (webhook_config),
// PagerDuty V3 webhooks, and Datadog webhooks (default or custom payload). Anything else is
// treated as a generic JSON alert ({ title, description, priority, ... }).

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type AlertSource = 'alertmanager' | 'pagerduty' | 'datadog' | 'generic'

export interface NormalizedAlert {
  source: AlertSource
  title: string
  description: string
  priority: Priority
  category: string
  // Stable ID from the sender, used to avoid re-running the swarm for repeat notifications
  externalRef: string | null
  // true when the sender says the alert is resolved/recovered; no swarm run is needed
  resolved: boolean
  link: string | null
}

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v)).trim()

export function mapSeverity(raw: unknown, fallback: Priority = 'HIGH'): Priority {
  const v = str(raw).toLowerCase()
  if (!v) return fallback
  if (['critical', 'crit', 'page', 'p1', 'sev1', 'sev-1', 'fatal', 'emergency', 'disaster'].includes(v)) return 'CRITICAL'
  if (['high', 'error', 'err', 'major', 'p2', 'sev2', 'sev-2'].includes(v)) return 'HIGH'
  if (['medium', 'warning', 'warn', 'minor', 'p3', 'sev3', 'sev-3', 'normal'].includes(v)) return 'MEDIUM'
  if (['low', 'info', 'informational', 'p4', 'p5', 'sev4', 'sev5', 'none'].includes(v)) return 'LOW'
  return fallback
}

function clip(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 3) + '...' : text
}

function isAlertmanager(b: any): boolean {
  return Array.isArray(b?.alerts) && (b.groupKey !== undefined || b.receiver !== undefined || b.version !== undefined)
}

function isPagerDuty(b: any): boolean {
  return typeof b?.event?.event_type === 'string' && typeof b?.event?.data === 'object'
}

function isDatadog(b: any): boolean {
  return (
    b?.alert_transition !== undefined ||
    b?.alert_type !== undefined ||
    b?.aggreg_key !== undefined ||
    (b?.event_type !== undefined && b?.body !== undefined && b?.title !== undefined && b?.last_updated !== undefined)
  )
}

function fromAlertmanager(b: any): NormalizedAlert {
  const alerts: any[] = b.alerts || []
  const firing = alerts.filter((a) => str(a.status || b.status).toLowerCase() !== 'resolved')
  const shown = firing.length ? firing : alerts
  const common = { ...(b.commonLabels || {}) }
  const commonAnn = b.commonAnnotations || {}
  const first = shown[0] || {}
  const alertname = str(common.alertname || first.labels?.alertname) || 'Prometheus alert'
  const summary = str(commonAnn.summary || first.annotations?.summary)
  const title = clip(summary ? `${alertname}: ${summary}` : alertname, 120)

  const worst = shown
    .map((a) => mapSeverity(a.labels?.severity || common.severity, 'HIGH'))
    .sort((x, y) => ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(y) - ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].indexOf(x))[0] || 'HIGH'

  const lines = shown.slice(0, 20).map((a) => {
    const labels = Object.entries(a.labels || {}).map(([k, v]) => `${k}=${v}`).join(', ')
    const desc = str(a.annotations?.description || a.annotations?.summary)
    return `- [${str(a.status) || 'firing'}] ${labels}${desc ? `\n  ${desc}` : ''}${a.startsAt ? `\n  since ${a.startsAt}` : ''}`
  })
  const description = clip(
    [
      `Prometheus Alertmanager: ${firing.length} firing / ${alerts.length} total alerts (receiver: ${str(b.receiver) || 'n/a'}).`,
      str(commonAnn.description),
      ...lines,
      alerts.length > 20 ? `...and ${alerts.length - 20} more` : '',
    ].filter(Boolean).join('\n'),
    6000
  )

  return {
    source: 'alertmanager',
    title,
    description,
    priority: worst,
    category: str(common.service || common.job || common.team) || 'Prometheus Alert',
    externalRef: b.groupKey ? `alertmanager:${crypto.createHash('sha1').update(String(b.groupKey)).digest('hex')}` : null,
    resolved: str(b.status).toLowerCase() === 'resolved' || firing.length === 0,
    link: str(b.externalURL || first.generatorURL) || null,
  }
}

function fromPagerDuty(b: any): NormalizedAlert {
  const ev = b.event
  const d = ev.data || {}
  const type = str(ev.event_type)
  const priorityLabel = str(d.priority?.summary)
  const priority = priorityLabel
    ? mapSeverity(priorityLabel, d.urgency === 'high' ? 'CRITICAL' : 'MEDIUM')
    : d.urgency === 'high' ? 'CRITICAL' : d.urgency === 'low' ? 'MEDIUM' : 'HIGH'
  const service = str(d.service?.summary)
  return {
    source: 'pagerduty',
    title: clip(str(d.title || d.summary) || `PagerDuty ${type}`, 120),
    description: clip(
      [
        `PagerDuty ${type}${d.number ? ` #${d.number}` : ''}${service ? ` on service "${service}"` : ''}.`,
        `Urgency: ${str(d.urgency) || 'n/a'}${priorityLabel ? `, priority ${priorityLabel}` : ''}. Status: ${str(d.status) || 'n/a'}.`,
        str(d.description),
        d.html_url ? `PagerDuty incident: ${d.html_url}` : '',
      ].filter(Boolean).join('\n'),
      6000
    ),
    priority,
    category: service || 'PagerDuty Incident',
    externalRef: d.id ? `pagerduty:${d.id}` : null,
    // Only a newly triggered incident needs a swarm run
    resolved: type !== 'incident.triggered',
    link: str(d.html_url) || null,
  }
}

function fromDatadog(b: any): NormalizedAlert {
  const transition = str(b.alert_transition)
  const alertType = str(b.alert_type).toLowerCase()
  const priority = b.alert_priority
    ? mapSeverity(b.alert_priority)
    : alertType === 'error' ? 'HIGH' : alertType === 'warning' ? 'MEDIUM' : alertType === 'info' || alertType === 'success' ? 'LOW' : mapSeverity(b.priority)
  const body = str(b.body || b.event_msg || b.text_only_msg || b.message)
  return {
    source: 'datadog',
    title: clip(str(b.title || b.alert_title || b.event_title) || 'Datadog alert', 120),
    description: clip(
      [
        `Datadog ${transition || str(b.event_type) || 'alert'}${b.hostname ? ` on ${b.hostname}` : ''}.`,
        body,
        b.alert_scope ? `Scope: ${b.alert_scope}` : '',
        b.tags ? `Tags: ${b.tags}` : '',
        b.link ? `Datadog: ${b.link}` : '',
      ].filter(Boolean).join('\n'),
      6000
    ),
    priority,
    category: str(b.org?.name) ? `Datadog (${str(b.org.name)})` : 'Datadog Monitor',
    externalRef: b.aggreg_key || b.alert_id ? `datadog:${str(b.aggreg_key || b.alert_id)}` : b.id ? `datadog:${str(b.id)}` : null,
    resolved: /^recovered$/i.test(transition) || alertType === 'success',
    link: str(b.link) || null,
  }
}

function fromGeneric(b: any): NormalizedAlert {
  const title = str(b.title || b.service || b.alertname) || 'Production Alert Triggered'
  const description = str(b.description || b.error || b.message) || JSON.stringify(b)
  return {
    source: 'generic',
    title: clip(title, 120),
    description: clip(description, 6000),
    priority: mapSeverity(b.priority || b.severity),
    category: str(b.category) || 'External Webhook',
    externalRef: b.dedup_key || b.id ? `generic:${str(b.dedup_key || b.id)}` : null,
    resolved: ['resolved', 'recovered', 'ok'].includes(str(b.status).toLowerCase()),
    link: str(b.link || b.url) || null,
  }
}

export function normalizeAlert(body: any, hint?: string): NormalizedAlert {
  const h = str(hint).toLowerCase()
  if (h === 'alertmanager' || h === 'prometheus' || (!h && isAlertmanager(body))) return fromAlertmanager(body)
  if (h === 'pagerduty' || (!h && isPagerDuty(body))) return fromPagerDuty(body)
  if (h === 'datadog' || (!h && isDatadog(body))) return fromDatadog(body)
  return fromGeneric(body || {})
}

// WEBHOOK_SECRET check. Accepts the secret as `x-webhook-secret: <secret>`,
// `Authorization: Bearer <secret>` (Alertmanager http_config.authorization), or `?token=<secret>`.
export function webhookAuthorized(req: Request): boolean {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) return true
  const auth = req.header('authorization') || ''
  const candidates = [
    req.header('x-webhook-secret'),
    auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : undefined,
    typeof req.query.token === 'string' ? req.query.token : undefined,
  ].filter((v): v is string => Boolean(v))
  const expected = Buffer.from(secret)
  return candidates.some((c) => {
    const got = Buffer.from(c)
    return got.length === expected.length && crypto.timingSafeEqual(got, expected)
  })
}
