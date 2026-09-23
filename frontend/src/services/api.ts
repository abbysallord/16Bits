export interface HealthStatus {
  status: string
  project: string
  version: string
  database: string
  ai_configured: boolean
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

export async function registerUser(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const details = Array.isArray(err.issues) ? err.issues.map((i: { message: string }) => i.message).join('. ') : ''
    throw new Error(details || err.error || 'Could not create account')
  }
  return res.json()
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
    headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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

export async function uploadRunbook(filename: string, content: string, token: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/api/agents/runbooks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ filename, content })
  })
  if (!res.ok) await throwApiError(res, 'Failed to upload runbook')
  return res.json()
}


