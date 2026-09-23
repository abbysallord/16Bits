export interface HealthStatus {
  status: string
  project: string
  version: string
  database: string
  ai_configured: boolean
  ai_provider?: string
  ai_model?: string
  is_mock?: boolean
}

export interface User {
  id: string
  email: string
  name: string
  role: string
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
  langsmithTraceId?: string | null
  langsmithTraceUrl?: string | null
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Auth session management
export function getAuthToken(): string | null {
  return localStorage.getItem('omniops_token')
}

export function getCurrentUser(): User | null {
  const data = localStorage.getItem('omniops_user')
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

export function setAuthSession(token: string, user: User): void {
  localStorage.setItem('omniops_token', token)
  localStorage.setItem('omniops_user', JSON.stringify(user))
}

export function clearAuthSession(): void {
  localStorage.removeItem('omniops_token')
  localStorage.removeItem('omniops_user')
}

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
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
  const data = await res.json()
  setAuthSession(data.token, data.user)
  return data
}

export async function fetchIncidents(): Promise<Incident[]> {
  const res = await fetch(`${API_BASE_URL}/api/incidents`)
  if (!res.ok) throw new Error('Failed to fetch incidents')
  const data = await res.json()
  return data.incidents || []
}

export async function fetchIncidentDetails(id: string): Promise<{ incident: Incident; logs: AgentStepLog[] }> {
  const res = await fetch(`${API_BASE_URL}/api/incidents/${id}`)
  if (!res.ok) throw new Error('Failed to fetch incident details')
  return res.json()
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
    headers: getAuthHeaders(),
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
      headers: getAuthHeaders(),
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

export async function approveIncident(incidentId: string, approvedBy?: string): Promise<void> {
  const currentUser = getCurrentUser()
  const operatorName = approvedBy || (currentUser ? `${currentUser.name} (${currentUser.email})` : 'Authorized Operator')

  const res = await fetch(`${API_BASE_URL}/api/agents/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ incidentId, approvedBy: operatorName })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to approve incident')
  }
}

export async function fetchRunbooks(): Promise<Array<{ filename: string; title: string; content: string }>> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/agents/runbooks`)
    if (!res.ok) return []
    const data = await res.json()
    return data.runbooks || []
  } catch {
    return []
  }
}

export async function submitContact(payload: {
  company: string
  email: string
  deploymentType: string
  message: string
}): Promise<{ success: boolean; message: string }> {
  // Simulates enterprise webhook submission with SLA confirmation
  await new Promise(r => setTimeout(r, 600))
  return {
    success: true,
    message: `Inquiry registered for ${payload.company}. OmniOps SRE solutions team will reach out to ${payload.email} within 1 business hour.`
  }
}
