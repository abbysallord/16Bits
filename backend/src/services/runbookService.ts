import fs from 'fs'
import path from 'path'
import { db } from '../db/database.js'
import { aiService } from './aiService.js'

// Runbooks live in the database (Postgres on Render, SQLite locally), so uploads survive redeploys.
// The Markdown files in backend/runbooks/ are the built-in set, synced into the table at startup.
//
// Search is hybrid:
//   1. BM25 over heading-level sections with an ops synonym map (always on, no keys needed)
//   2. Dense embeddings (Gemini gemini-embedding-001, free tier) when GEMINI_API_KEY is set
//   3. The two rankings are merged with reciprocal rank fusion
//   4. When an LLM is configured (Groq by default), it picks the best runbook among the top 3
//      or says none fits. Set RUNBOOK_RERANK=off to skip this step.

export interface Runbook {
  filename: string
  title: string
  content: string
  source?: string
}

export interface RunbookMatch {
  runbook: Runbook
  score: number
  snippet: string
  signals: { bm25: number; semantic: number | null }
}

export interface RunbookSearchResult {
  query: string
  method: string
  matches: RunbookMatch[]
  chosen: RunbookMatch | null
  rerankReason?: string
}

const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001'
const EMBED_DIM = 768
const EMBED_BASE = process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta'
const MAX_RUNBOOK_BYTES = 100_000

// Common ops vocabulary: query terms expand to these so "OOM" finds "memory", "429" finds "rate limit", etc.
const SYNONYMS: Record<string, string[]> = {
  oom: ['memory', 'eviction', 'maxmemory'],
  memory: ['oom', 'heap', 'eviction'],
  db: ['database', 'postgres', 'sql'],
  database: ['postgres', 'sql', 'db'],
  postgres: ['database', 'pg', 'sql'],
  pg: ['postgres', 'database'],
  pool: ['connections', 'connection'],
  connections: ['pool', 'connection'],
  cache: ['redis', 'memcached'],
  redis: ['cache'],
  '429': ['throttle', 'rate', 'limit'],
  throttle: ['429', 'rate', 'limit'],
  throttled: ['429', 'rate', 'limit', 'throttle'],
  ratelimit: ['429', 'throttle', 'rate', 'limit'],
  webhook: ['webhooks', 'callback', 'events'],
  webhooks: ['webhook', 'events'],
  payment: ['stripe', 'billing', 'checkout'],
  payments: ['stripe', 'billing', 'checkout'],
  stripe: ['payment', 'billing'],
  latency: ['slow', 'timeout', 'lag'],
  slow: ['latency', 'timeout'],
  timeout: ['latency', 'timeouts', 'slow'],
  lag: ['latency', 'replica', 'replication'],
  crash: ['crashloopbackoff', 'restart', 'oomkilled'],
  crashloop: ['crashloopbackoff', 'restart', 'pod'],
  crashloopbackoff: ['crash', 'restart', 'pod', 'kubernetes'],
  pod: ['kubernetes', 'k8s', 'deployment'],
  k8s: ['kubernetes', 'pod'],
  kubernetes: ['k8s', 'pod'],
  '5xx': ['error', 'errors', '500', '503'],
  '500': ['error', '5xx'],
  '503': ['unavailable', '5xx'],
  error: ['errors', 'failure', 'exception'],
  errors: ['error', 'failure'],
  disk: ['storage', 'volume'],
  cpu: ['load', 'saturation'],
}

const STOPWORDS = new Set(
  'the a an and or of to in on for is are was be with at by from this that it as if not no do does into over under when then than via per we our you your'.split(' ')
)

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

function titleOf(content: string, fallback: string): string {
  const firstLine = content.split('\n').find((l) => l.trim()) || fallback
  return firstLine.replace(/^#+\s*/, '').trim() || fallback
}

function safeFilename(filename: string): string {
  const safe = path.basename(filename).replace(/[^a-zA-Z0-9_\-.]/g, '_')
  return safe.endsWith('.md') ? safe : `${safe}.md`
}

// Split a runbook into heading-level sections so a match in one section is not diluted by the rest
function sections(rb: Runbook): string[] {
  const parts = rb.content.split(/\n(?=#{1,3}\s)/).map((p) => p.trim()).filter(Boolean)
  return parts.length ? parts : [rb.content]
}

// Section text without its heading lines; falls back to the runbook body when the section is only a title
function snippetOf(section: string, fullContent: string): string {
  const strip = (t: string) => t.split('\n').filter((l) => !/^#{1,6}\s/.test(l)).join(' ').replace(/\s+/g, ' ').trim()
  return (strip(section) || strip(fullContent)).slice(0, 280)
}

function cosine(a: number[], b: number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

class Embedder {
  private readonly key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''

  get enabled(): boolean {
    return Boolean(this.key) && (process.env.RUNBOOK_EMBEDDINGS || 'on').toLowerCase() !== 'off'
  }

  get model(): string {
    return EMBED_MODEL
  }

  async embed(text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY', title?: string): Promise<number[] | null> {
    if (!this.enabled) return null
    try {
      const body: Record<string, unknown> = {
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: text.slice(0, 8000) }] },
        taskType,
        outputDimensionality: EMBED_DIM,
      }
      if (title && taskType === 'RETRIEVAL_DOCUMENT') body.title = title
      const res = await withTimeout(
        fetch(`${EMBED_BASE}/models/${EMBED_MODEL}:embedContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.key },
          body: JSON.stringify(body),
        }),
        6000
      )
      if (!res.ok) {
        console.warn(`[Runbooks] Embedding request failed: HTTP ${res.status}`)
        return null
      }
      const data: any = await res.json()
      const values = data?.embedding?.values
      return Array.isArray(values) && values.length ? values : null
    } catch (err: any) {
      console.warn(`[Runbooks] Embedding request failed: ${err?.message}`)
      return null
    }
  }
}

export class RunbookService {
  private readonly runbooksDir = path.resolve(process.cwd(), 'runbooks')
  private readonly embedder = new Embedder()
  private cache: Runbook[] | null = null
  private embeddings = new Map<string, number[]>()

  // Sync built-in Markdown runbooks into the table, then embed anything missing in the background
  public async init(): Promise<void> {
    if (fs.existsSync(this.runbooksDir)) {
      for (const file of fs.readdirSync(this.runbooksDir).filter((f) => f.endsWith('.md'))) {
        const content = fs.readFileSync(path.join(this.runbooksDir, file), 'utf-8')
        const title = titleOf(content, file)
        const existing = await db.get<{ content: string; source: string }>('SELECT content, source FROM runbooks WHERE filename = ?', [file])
        if (!existing) {
          await db.run('INSERT INTO runbooks (filename, title, content, source) VALUES (?, ?, ?, ?)', [file, title, content, 'builtin'])
        } else if (existing.source === 'builtin' && existing.content !== content) {
          // Built-in runbook changed in the repo; never overwrite a team upload with the same name
          await db.run(
            'UPDATE runbooks SET title = ?, content = ?, embedding = NULL, embedding_model = NULL, updated_at = CURRENT_TIMESTAMP WHERE filename = ?',
            [title, content, file]
          )
        }
      }
    }
    await this.reload()
    const count = this.cache?.length ?? 0
    console.log(`[Runbooks] ${count} runbooks loaded from the database. Search: ${this.methodLabel()}`)
    void this.indexMissingEmbeddings()
  }

  private async reload(): Promise<void> {
    const rows = await db.all<{ filename: string; title: string; content: string; source: string; embedding: string | null; embedding_model: string | null }>(
      'SELECT filename, title, content, source, embedding, embedding_model FROM runbooks ORDER BY filename'
    )
    this.cache = rows.map((r) => ({ filename: r.filename, title: r.title, content: r.content, source: r.source }))
    this.embeddings.clear()
    for (const r of rows) {
      if (r.embedding && r.embedding_model === this.embedder.model) {
        try {
          this.embeddings.set(r.filename, JSON.parse(r.embedding))
        } catch {
          /* re-embedded below */
        }
      }
    }
  }

  private async indexMissingEmbeddings(): Promise<void> {
    if (!this.embedder.enabled || !this.cache) return
    for (const rb of this.cache) {
      if (this.embeddings.has(rb.filename)) continue
      await this.embedAndStore(rb)
    }
  }

  private async embedAndStore(rb: Runbook): Promise<void> {
    const vec = await this.embedder.embed(rb.content, 'RETRIEVAL_DOCUMENT', rb.title)
    if (!vec) return
    this.embeddings.set(rb.filename, vec)
    await db.run('UPDATE runbooks SET embedding = ?, embedding_model = ? WHERE filename = ?', [JSON.stringify(vec), this.embedder.model, rb.filename])
  }

  private methodLabel(): string {
    const parts = ['bm25+synonyms']
    if (this.embedder.enabled) parts.push(`embeddings:${this.embedder.model}`)
    if (this.rerankEnabled()) parts.push(`llm-rerank:${aiService.getProviderLabel()}`)
    return parts.join(' + ')
  }

  private rerankEnabled(): boolean {
    return !aiService.isMockMode() && (process.env.RUNBOOK_RERANK || 'on').toLowerCase() !== 'off'
  }

  public async getAvailableRunbooks(): Promise<Runbook[]> {
    if (!this.cache) await this.reload()
    return this.cache || []
  }

  public async saveRunbook(filename: string, content: string): Promise<Runbook> {
    if (Buffer.byteLength(content, 'utf-8') > MAX_RUNBOOK_BYTES) throw new Error('Runbook is too large (100 KB max)')
    const clean = safeFilename(filename)
    const title = titleOf(content, clean)
    const existing = await db.get('SELECT filename FROM runbooks WHERE filename = ?', [clean])
    if (existing) {
      await db.run(
        "UPDATE runbooks SET title = ?, content = ?, source = 'upload', embedding = NULL, embedding_model = NULL, updated_at = CURRENT_TIMESTAMP WHERE filename = ?",
        [title, content, clean]
      )
    } else {
      await db.run("INSERT INTO runbooks (filename, title, content, source) VALUES (?, ?, ?, 'upload')", [clean, title, content])
    }
    await this.reload()
    const saved: Runbook = { filename: clean, title, content, source: 'upload' }
    await this.embedAndStore(saved)
    return saved
  }

  // Team uploads can be deleted; built-in runbooks come back on the next restart, so they are protected
  public async deleteRunbook(filename: string): Promise<'deleted' | 'not_found' | 'builtin'> {
    const row = await db.get<{ source: string }>('SELECT source FROM runbooks WHERE filename = ?', [filename])
    if (!row) return 'not_found'
    if (row.source === 'builtin') return 'builtin'
    await db.run('DELETE FROM runbooks WHERE filename = ?', [filename])
    await this.reload()
    return 'deleted'
  }

  private bm25(queryTokens: string[], runbooks: Runbook[]): Map<string, { score: number; snippet: string }> {
    const docs: Array<{ filename: string; title: string; text: string; fullContent: string; tokens: string[] }> = []
    for (const rb of runbooks) {
      for (const sec of sections(rb)) docs.push({ filename: rb.filename, title: rb.title, text: sec, fullContent: rb.content, tokens: tokenize(`${rb.title} ${sec}`) })
    }
    const N = docs.length || 1
    const avgLen = docs.reduce((n, d) => n + d.tokens.length, 0) / N || 1
    const df = new Map<string, number>()
    for (const d of docs) for (const t of new Set(d.tokens)) df.set(t, (df.get(t) || 0) + 1)

    // Original query terms weigh 1.0, synonym expansions 0.4
    const weights = new Map<string, number>()
    for (const t of queryTokens) weights.set(t, 1)
    for (const t of queryTokens) for (const s of SYNONYMS[t] || []) if (!weights.has(s)) weights.set(s, 0.4)

    const k1 = 1.2
    const b = 0.75
    const best = new Map<string, { score: number; snippet: string }>()
    for (const d of docs) {
      const tf = new Map<string, number>()
      for (const t of d.tokens) tf.set(t, (tf.get(t) || 0) + 1)
      const titleTokens = new Set(tokenize(d.title))
      let score = 0
      for (const [term, w] of weights) {
        const f = tf.get(term)
        if (!f) continue
        const n = df.get(term) || 0
        const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
        score += w * idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.tokens.length) / avgLen)))
        if (titleTokens.has(term)) score += w * idf * 0.5
      }
      const prev = best.get(d.filename)
      if (!prev || score > prev.score) best.set(d.filename, { score, snippet: snippetOf(d.text, d.fullContent) })
    }
    return best
  }

  public async search(query: string, limit = 5, opts: { rerank?: boolean } = {}): Promise<RunbookSearchResult> {
    const runbooks = await this.getAvailableRunbooks()
    const tokens = tokenize(query)
    if (!runbooks.length || !query.trim()) return { query, method: this.methodLabel(), matches: [], chosen: null }

    const lexical = this.bm25(tokens, runbooks)
    let semantic: Map<string, number> | null = null
    if (this.embedder.enabled && this.embeddings.size) {
      const qv = await this.embedder.embed(query, 'RETRIEVAL_QUERY')
      if (qv) {
        semantic = new Map()
        for (const rb of runbooks) {
          const v = this.embeddings.get(rb.filename)
          if (v) semantic.set(rb.filename, cosine(qv, v))
        }
      }
    }

    // Reciprocal rank fusion of the lexical and semantic rankings
    const K = 60
    const fused = new Map<string, number>()
    const addRanking = (scores: Map<string, number>, minScore: number) => {
      ;[...scores.entries()]
        .filter(([, s]) => s > minScore)
        .sort((a, b) => b[1] - a[1])
        .forEach(([f], i) => fused.set(f, (fused.get(f) || 0) + 1 / (K + i + 1)))
    }
    addRanking(new Map([...lexical].map(([f, v]) => [f, v.score])), 0)
    if (semantic) addRanking(semantic, 0.3)

    const matches: RunbookMatch[] = [...fused.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([filename, score]) => ({
        runbook: runbooks.find((r) => r.filename === filename)!,
        score: Number(score.toFixed(4)),
        snippet: lexical.get(filename)?.snippet || '',
        signals: {
          bm25: Number((lexical.get(filename)?.score || 0).toFixed(3)),
          semantic: semantic ? Number((semantic.get(filename) ?? 0).toFixed(3)) : null,
        },
      }))

    const result: RunbookSearchResult = { query, method: this.methodLabel(), matches, chosen: matches[0] || null }
    const wantRerank = opts.rerank ?? true
    if (wantRerank && this.rerankEnabled() && matches.length > 0) {
      try {
        const picked = await withTimeout(this.rerank(query, matches.slice(0, 3)), 8000)
        if (picked) {
          result.chosen = picked.index === null ? null : matches[picked.index]
          result.rerankReason = picked.reason
        }
      } catch (err: any) {
        console.warn(`[Runbooks] Rerank skipped: ${err?.message}`)
      }
    }
    return result
  }

  // Ask the LLM which candidate actually fits the incident, or none
  private async rerank(query: string, candidates: RunbookMatch[]): Promise<{ index: number | null; reason: string } | null> {
    const list = candidates
      .map((c, i) => `[${i + 1}] ${c.runbook.title}\n${c.runbook.content.slice(0, 700)}`)
      .join('\n\n---\n\n')
    const prompt = `Incident:\n${query.slice(0, 1500)}\n\nCandidate runbooks:\n\n${list}\n\nWhich runbook is the right procedure for this incident? Reply with JSON only: {"choice": <number of the runbook, or 0 if none of them apply>, "reason": "<one short sentence>"}`
    const raw = await aiService.complete(prompt, 'You match production incidents to SRE runbooks. Answer with strict JSON only.')
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return null
    const parsed = JSON.parse(m[0])
    const n = Number(parsed.choice)
    if (!Number.isInteger(n) || n < 0 || n > candidates.length) return null
    return { index: n === 0 ? null : n - 1, reason: String(parsed.reason || '').slice(0, 300) }
  }

  // Best runbook for an incident, or null when nothing relevant matches
  public async findBestRunbook(query: string): Promise<Runbook | null> {
    const r = await this.search(query, 5)
    return r.chosen?.runbook || null
  }
}

export const runbookService = new RunbookService()
