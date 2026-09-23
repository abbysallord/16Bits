export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface HealthStatus {
  status: string
  version: string
  project: string
  groq_configured: boolean
}

export interface ModelOption {
  id: string
  name: string
  speed: string
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function checkBackendHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE_URL}/api/health`)
  if (!res.ok) {
    throw new Error(`Backend health check failed: ${res.statusText}`)
  }
  return res.json()
}

export async function fetchAvailableModels(): Promise<ModelOption[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/models`)
    if (!res.ok) return []
    const data = await res.json()
    return data.models || []
  } catch {
    return []
  }
}

export async function sendChatMessage(
  messages: ChatMessage[],
  model: string = 'llama-3.3-70b-versatile',
  temperature: number = 0.1
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      model,
      temperature,
      stream: false,
    }),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.detail || `Chat request failed: ${res.statusText}`)
  }

  const data = await res.json()
  return data.content
}

export async function streamChatMessage(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (err: string) => void,
  model: string = 'llama-3.3-70b-versatile'
) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model,
        temperature: 0.1,
        stream: true,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      onError(`Request error: ${err}`)
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      onError('Response body reader could not be established')
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
        const payload = trimmed.replace('data: ', '').trim()
        if (payload === '[DONE]') {
          onComplete()
          return
        }
        try {
          const parsed = JSON.parse(payload)
          if (parsed.content) {
            onChunk(parsed.content)
          }
          if (parsed.error) {
            onError(parsed.error)
            return
          }
        } catch {
          // Ignore parse errors on malformed chunks
        }
      }
    }
    onComplete()
  } catch (error: any) {
    onError(error.message || 'Stream connection failed')
  }
}
