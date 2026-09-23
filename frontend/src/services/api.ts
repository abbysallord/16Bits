export interface HealthStatus {
  status: string
  project: string
  version: string
  database: string
  ai_configured: boolean
  demo_account?: boolean
  rate_limiting?: boolean
}

export interface User {
  id: string
  email: string
  name: string
  role: string
  orgId?: string
  orgName?: string
}

export interface Incident {
  id: string
  title: string
  description: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  category: string
  status: 'PENDING' | 'ANALYZING' | 'AWAITING_APPROVAL' | 'RESOLVED' | 'FAILED'
  resolution?: string | null
  created_at: string
  updated_at: string
}

export interface AgentStepLog {
  agentName: string
  stepNumber: number
  thought: string
  action: string
  dataPayload?: any
  timestamp: string
}

export interface SwarmResult {
  incidentId: string
  title: string
  priority: string
  status: 'AWAITING_APPROVAL' | 'RESOLVED' | 'FAILED'
  requiresApproval?: boolean
  matchedRunbookTitle?: string
  logs: AgentStepLog[]
  finalResolution: string
  executionDurationMs: number
}

const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '')
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://one6bits.onrender.com'
  }
  return 'http://localhost:8000'
}

export const API_BASE_URL = getApiBaseUrl()

// Signed-in requests are scoped to the user's team; signed-out ones see the public demo workspace
function sessionToken(): string | null {
  try {
    const raw = localStorage.getItem('omniops_session')
    return raw ? JSON.parse(raw).token || null : null
  } catch {
    return null
  }
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = sessionToken()
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra
}

// Thrown when a protected endpoint rejects the session (missing/expired token)
export class UnauthorizedError extends Error {
  constructor(message = 'Please sign in as an operator') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

async function throwApiError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}))
  if (res.status === 401) throw new UnauthorizedError(err.error)
  throw new Error(err.error || fallback)
}

export async function checkBackendHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE_URL}/api/health`)
  if (!res.ok) throw new Error('Backend health check failed')
  return res.json()
}

export async function loginUser(email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Login failed')
  }
  return res.json()
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  team: { teamName?: string; inviteCode?: string } = {}
): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, ...team })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const details = Array.isArray(err.issues) ? err.issues.map((i: { message: string }) => i.message).join('. ') : ''
    throw new Error(details || err.error || 'Could not create account')
  }
  return res.json()
}

export async function fetchIncidents(): Promise<Incident[]> {
  const res = await fetch(`${API_BASE_URL}/api/incidents`, { headers: authHeaders() })
  if (!res.ok) throw new Error('Failed to fetch incidents')
  const data = await res.json()
  return data.incidents || []
}

export async function fetchIncidentDetails(id: string): Promise<{ incident: Incident; logs: AgentStepLog[] }> {
  const res = await fetch(`${API_BASE_URL}/api/incidents/${id}`, { headers: authHeaders() })
  if (!res.ok) await throwApiError(res, 'Failed to fetch incident details')
  return res.json()
}

export async function claimIncidents(incidentIds: string[], token?: string): Promise<{ claimedCount: number; claimedIds: string[] }> {
  if (!incidentIds.length) return { claimedCount: 0, claimedIds: [] }
  const headers = authHeaders({ 'Content-Type': 'application/json' })
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  try {
    const res = await fetch(`${API_BASE_URL}/api/agents/claim`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ incidentIds })
    })
    if (!res.ok) return { claimedCount: 0, claimedIds: [] }
    return res.json()
  } catch {
    return { claimedCount: 0, claimedIds: [] }
  }
}

export async function runSwarm(payload: {
  title: string
  description: string
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  category?: string
  incidentId?: string
}): Promise<{ message: string; result: SwarmResult }> {
  const res = await fetch(`${API_BASE_URL}/api/agents/execute`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Swarm execution failed')
  }
  return res.json()
}

export async function streamSwarm(
  payload: {
    title: string
    description: string
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    category?: string
    incidentId?: string
  },
  onStep: (step: AgentStepLog) => void,
  onComplete: (result: SwarmResult) => void,
  onError: (err: string) => void
) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/agents/stream`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const err = await res.text()
      onError(err || 'Stream connection failed')
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      onError('Readable stream not supported')
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const raw = trimmed.replace('data: ', '').trim()
        if (raw === '[DONE]') return

        try {
          const parsed = JSON.parse(raw)
          if (parsed.type === 'STEP' && parsed.step) {
            onStep(parsed.step)
          } else if (parsed.type === 'COMPLETE' && parsed.result) {
            onComplete(parsed.result)
          } else if (parsed.type === 'ERROR') {
            onError(parsed.error)
          }
        } catch {
          // ignore chunk parse errors
        }
      }
    }
  } catch (err: any) {
    onError(err.message || 'Stream failed')
  }
}

export async function approveIncident(incidentId: string, token: string): Promise<{ authorizedBy: string }> {
  const res = await fetch(`${API_BASE_URL}/api/agents/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ incidentId })
  })
  if (!res.ok) await throwApiError(res, 'Failed to approve incident')
  return res.json()
}

export interface RunbookSummary {
  filename: string
  title: string
  content: string
  source?: string
}

export async function fetchRunbooks(): Promise<RunbookSummary[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/agents/runbooks`, { headers: authHeaders() })
    if (!res.ok) return []
    const data = await res.json()
    return data.runbooks || []
  } catch {
    return []
  }
}

export async function uploadRunbook(filename: string, content: string, token: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/agents/runbooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ filename, content })
  })
  if (!res.ok) await throwApiError(res, 'Failed to upload runbook')
  return res.json()
}



export interface RunbookSearchResponse {
  query: string
  method: string
  chosen: { filename: string; title: string } | null
  rerankReason: string | null
  matches: Array<{ filename: string; title: string; score: number; snippet: string; signals: { bm25: number; semantic: number | null } }>
}

export async function searchRunbooks(q: string): Promise<RunbookSearchResponse> {
  const res = await fetch(`${API_BASE_URL}/api/agents/runbooks/search?q=${encodeURIComponent(q)}`, { headers: authHeaders() })
  if (!res.ok) await throwApiError(res, 'Runbook search failed')
  return res.json()
}

export async function deleteRunbook(filename: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/agents/runbooks/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) await throwApiError(res, 'Failed to delete runbook')
}

export interface OrgSettings {
  id: string
  name: string
  isDemo: boolean
  canEdit: boolean
  role?: string
  inviteCode: string | null
  alertUrls: { alertmanager: string; pagerduty: string; datadog: string; generic: string } | null
  slack: { configured: boolean; source: 'team' | 'server' | null; webhookPreview: string | null }
  groq: { ownKey: boolean; keyPreview: string | null }
  members: Array<{ name: string; email?: string; role: string }>
}

async function orgCall(path: string, token: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/api/org${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  })
  if (!res.ok) await throwApiError(res, 'Request failed')
  return res.json()
}

export const fetchOrg = (token: string): Promise<{ org: OrgSettings }> => orgCall('', token)
export const updateOrg = (token: string, body: { name?: string; slackWebhookUrl?: string; groqApiKey?: string }): Promise<{ message: string; org: OrgSettings }> =>
  orgCall('', token, { method: 'PATCH', body: JSON.stringify(body) })
export const testOrgSlack = (token: string): Promise<{ message: string }> => orgCall('/slack/test', token, { method: 'POST' })
export const rotateAlertKey = (token: string): Promise<{ message: string; org: OrgSettings }> => orgCall('/rotate-alert-key', token, { method: 'POST' })
export const rotateInvite = (token: string): Promise<{ message: string; org: OrgSettings }> => orgCall('/rotate-invite', token, { method: 'POST' })
export const joinTeam = (token: string, inviteCode: string): Promise<{ message: string; token: string; user: User }> =>
  orgCall('/join', token, { method: 'POST', body: JSON.stringify({ inviteCode }) })
