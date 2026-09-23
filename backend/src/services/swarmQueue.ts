// Caps how many swarm runs hit the LLM provider at once (Groq free tier: ~30 req/min and 8K tokens/min
// per model). Extra runs wait in line instead of failing with 429s. SWARM_CONCURRENCY tunes it.
const MAX_CONCURRENT = Math.max(1, Number(process.env.SWARM_CONCURRENCY || 2))
const MAX_QUEUED = Math.max(1, Number(process.env.SWARM_MAX_QUEUE || 50))

let active = 0
const waiting: Array<() => void> = []

export function swarmQueueStats() {
  return { active, queued: waiting.length, maxConcurrent: MAX_CONCURRENT }
}

export async function enqueueSwarm<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    if (waiting.length >= MAX_QUEUED) throw new Error('OmniOps is busy right now (too many agent runs queued). Try again in a minute.')
    // The finishing run hands its slot straight to us, so `active` is already counted
    await new Promise<void>((resolve) => waiting.push(resolve))
  } else {
    active += 1
  }
  try {
    return await fn()
  } finally {
    const next = waiting.shift()
    if (next) next()
    else active -= 1
  }
}
