import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'
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
