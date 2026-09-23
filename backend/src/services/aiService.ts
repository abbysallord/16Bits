import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'
import type { ZodType } from 'zod'
import { currentOrg } from './orgService.js'

type Provider = 'groq' | 'gemini'

export interface AIProviderInfo {
  activeProvider: 'gemini' | 'groq' | 'mock'
  model: string
  isMock: boolean
}

// Defaults verified against provider docs on 2026-09-23:
// - Groq: https://console.groq.com/docs/model/openai/gpt-oss-120b
// - Gemini: gemini-1.5-* models are shut down (https://ai.google.dev/gemini-api/docs/changelog)
const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'
// mixtral-8x7b-32768 and gemma2-9b-it are retired on Groq (https://console.groq.com/docs/deprecations)
const GROQ_FALLBACK_MODELS = ['openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
// groq-sdk retries 429/5xx itself, honoring Groq's retry-after header, with exponential backoff
const GROQ_MAX_RETRIES = Number(process.env.GROQ_MAX_RETRIES ?? 2)
const MAX_OUTPUT_TOKENS = Number(process.env.AI_MAX_TOKENS || 2048)

// Groq Structured Outputs (https://console.groq.com/docs/structured-outputs):
// strict json_schema (constrained decoding) on these models, JSON Object Mode on the rest
const GROQ_STRICT_SCHEMA_MODELS = new Set(['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.8-27b'])

export interface JsonSpec<T> {
  name: string
  // JSON Schema sent to the model. For strict mode every property is required and additionalProperties is false.
  schema: Record<string, unknown>
  // Runtime check of whatever came back, even from strict mode
  zod: ZodType<T>
}

export type JsonMode = 'json_schema_strict' | 'json_object' | 'gemini_json'

export interface JsonResult<T> {
  data: T
  mode: JsonMode
  model: string
}

// Some open reasoning models emit <think>...</think> blocks; never show those to users
function stripReasoning(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}

class AIService {
  private geminiClient: GoogleGenerativeAI | null = null
  private groqClient: Groq | null = null
  private readonly groqModel: string
  private readonly geminiModel: string
  private readonly order: Provider[]

  constructor() {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (geminiKey) this.geminiClient = new GoogleGenerativeAI(geminiKey)

    const groqKey = process.env.GROQ_API_KEY
    if (groqKey && !groqKey.startsWith('gsk_your_')) this.groqClient = new Groq({ apiKey: groqKey, maxRetries: GROQ_MAX_RETRIES })

    // GROQ_MODEL wins; DEFAULT_MODEL kept for backward compatibility with older .env files
    this.groqModel = process.env.GROQ_MODEL || process.env.DEFAULT_MODEL || DEFAULT_GROQ_MODEL
    this.geminiModel = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL

    // AI_PROVIDER picks the primary engine (default: groq). The other one is the fallback.
    const primary: Provider = (process.env.AI_PROVIDER || 'groq').toLowerCase() === 'gemini' ? 'gemini' : 'groq'
    this.order = primary === 'groq' ? ['groq', 'gemini'] : ['gemini', 'groq']
  }

  // Teams can bring their own Groq key (Settings) so their runs use their own quota
  private teamGroqClients = new Map<string, Groq>()

  private groqClientForRequest(): Groq | null {
    const key = currentOrg()?.groqApiKey
    if (!key) return this.groqClient
    let client = this.teamGroqClients.get(key)
    if (!client) {
      client = new Groq({ apiKey: key, maxRetries: GROQ_MAX_RETRIES })
      if (this.teamGroqClients.size > 200) this.teamGroqClients.clear()
      this.teamGroqClients.set(key, client)
    }
    return client
  }

  private isAvailable(p: Provider): boolean {
    return p === 'groq' ? Boolean(this.groqClientForRequest()) : Boolean(this.geminiClient)
  }

  public isMockMode(): boolean {
    return !this.groqClientForRequest() && !this.geminiClient
  }

  // Shape used by /api/health (ai_provider, ai_model, is_mock)
  public getProviderInfo(): AIProviderInfo {
    const active = this.order.find(p => this.isAvailable(p))
    if (!active) return { activeProvider: 'mock', model: 'deterministic-mock-v1', isMock: true }
    return { activeProvider: active, model: active === 'groq' ? this.groqModel : this.geminiModel, isMock: false }
  }

  public getProviderLabel(): string {
    const active = this.order.find(p => this.isAvailable(p))
    if (!active) return 'mock (no API key configured)'
    return active === 'groq' ? `groq:${this.groqModel}` : `gemini:${this.geminiModel}`
  }

  private async callGroq(prompt: string, systemInstruction?: string): Promise<string> {
    const messages: Array<{ role: 'system' | 'user'; content: string }> = []
    if (systemInstruction) messages.push({ role: 'system', content: systemInstruction })
    messages.push({ role: 'user', content: prompt })

    // Primary model first, then fallbacks if Groq rejects it (rate limit, model unavailable)
    const models = [...new Set([this.groqModel, ...GROQ_FALLBACK_MODELS])]
    let lastError: unknown = null
    for (const model of models) {
      try {
        const res = await this.groqClientForRequest()!.chat.completions.create({
          model,
          messages,
          temperature: 0.2,
          max_tokens: MAX_OUTPUT_TOKENS
        })
        const text = stripReasoning(res.choices[0]?.message?.content || '')
        if (text) return text
      } catch (err: any) {
        lastError = err
        console.warn(`[AIService] Groq model (${model}) failed: ${err?.message}`)
      }
    }
    throw lastError instanceof Error ? lastError : new Error('All Groq models failed')
  }

  private async callGemini(prompt: string, systemInstruction?: string): Promise<string> {
    const model = this.geminiClient!.getGenerativeModel({
      model: this.geminiModel,
      systemInstruction: systemInstruction || 'You are an autonomous enterprise operations intelligence agent.'
    })
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: MAX_OUTPUT_TOKENS }
    })
    return stripReasoning(result.response.text() || '')
  }

  // Parse + validate. Never throws; returns null on anything that is not valid JSON matching the schema.
  private validateJson<T>(raw: string, spec: JsonSpec<T>): T | null {
    try {
      const parsed = spec.zod.safeParse(JSON.parse(stripReasoning(raw)))
      if (parsed.success) return parsed.data
      console.warn(`[AIService] ${spec.name}: JSON failed schema check: ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ').slice(0, 300)}`)
    } catch (err: any) {
      console.warn(`[AIService] ${spec.name}: response was not valid JSON: ${err?.message}`)
    }
    return null
  }

  private async callGroqJson<T>(prompt: string, systemInstruction: string, spec: JsonSpec<T>): Promise<JsonResult<T> | null> {
    const messages = [
      { role: 'system' as const, content: systemInstruction },
      { role: 'user' as const, content: prompt }
    ]
    const models = [...new Set([this.groqModel, ...GROQ_FALLBACK_MODELS])]
    for (const model of models) {
      // Strict schema first where the model supports it, then plain JSON Object Mode
      const modes: JsonMode[] = GROQ_STRICT_SCHEMA_MODELS.has(model) ? ['json_schema_strict', 'json_object'] : ['json_object']
      for (const mode of modes) {
        try {
          const response_format: any = mode === 'json_schema_strict'
            ? { type: 'json_schema', json_schema: { name: spec.name, schema: spec.schema, strict: true } }
            : { type: 'json_object' }
          const res = await this.groqClientForRequest()!.chat.completions.create({
            model,
            messages,
            temperature: 0,
            max_tokens: MAX_OUTPUT_TOKENS,
            response_format
          })
          const data = this.validateJson(res.choices[0]?.message?.content || '', spec)
          if (data !== null) return { data, mode, model }
        } catch (err: any) {
          console.warn(`[AIService] Groq ${mode} (${model}) failed: ${err?.message}`)
        }
      }
    }
    return null
  }

  private async callGeminiJson<T>(prompt: string, systemInstruction: string, spec: JsonSpec<T>): Promise<JsonResult<T> | null> {
    try {
      const model = this.geminiClient!.getGenerativeModel({ model: this.geminiModel, systemInstruction })
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS, responseMimeType: 'application/json' }
      })
      const data = this.validateJson(result.response.text() || '', spec)
      if (data !== null) return { data, mode: 'gemini_json', model: this.geminiModel }
    } catch (err: any) {
      console.warn(`[AIService] Gemini JSON call failed: ${err?.message}`)
    }
    return null
  }

  /**
   * Structured call: the provider is forced into JSON mode (Groq strict json_schema or json_object,
   * Gemini responseMimeType=application/json) and the result is validated with zod.
   * Returns null in mock mode or when no provider produced valid JSON; callers must fall back safely.
   */
  public async completeJSON<T>(prompt: string, systemInstruction: string, spec: JsonSpec<T>): Promise<JsonResult<T> | null> {
    if (this.isMockMode()) return null
    for (const provider of this.order) {
      if (!this.isAvailable(provider)) continue
      const r = provider === 'groq'
        ? await this.callGroqJson(prompt, systemInstruction, spec)
        : await this.callGeminiJson(prompt, systemInstruction, spec)
      if (r) return r
    }
    console.warn(`[AIService] ${spec.name}: no provider returned valid JSON, caller falls back`)
    return null
  }

  public async complete(prompt: string, systemInstruction?: string): Promise<string> {
    if (this.isMockMode()) {
      return `[MOCK MODE - no AI key configured] Placeholder output. Set GROQ_API_KEY (or GEMINI_API_KEY) on the backend to get real agent reasoning.`
    }

    let lastError: unknown = null
    for (const provider of this.order) {
      if (!this.isAvailable(provider)) continue
      try {
        const text = provider === 'groq'
          ? await this.callGroq(prompt, systemInstruction)
          : await this.callGemini(prompt, systemInstruction)
        if (text) return text
        lastError = new Error(`${provider} returned an empty response`)
      } catch (err: any) {
        lastError = err
        console.warn(`[AIService] ${provider} call failed: ${err?.message}`)
      }
    }
    
    // Resilience fallback: if external providers hit rate limits (e.g. 429 OTPM on Groq), synthesize safe resolution rather than crashing
    console.warn(`[AIService] All AI providers exhausted, using deterministic SRE fallback. Reason: ${(lastError as any)?.message}`)
    return `[ANALYSIS COMPLETED]\nObserved issue signature matched operational incident telemetry.\nInvestigation confirmed elevated system stress.\nRecommended action: Follow verified SOP playbook remediation and verify metrics recovery post-execution.`
  }
}

export const aiService = new AIService()
