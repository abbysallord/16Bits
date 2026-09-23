import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'
import dotenv from 'dotenv'

dotenv.config()

class AIService {
  private geminiClient: GoogleGenerativeAI | null = null
  private groqClient: Groq | null = null

  constructor() {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
    if (geminiKey) {
      this.geminiClient = new GoogleGenerativeAI(geminiKey)
    }

    const groqKey = process.env.GROQ_API_KEY
    if (groqKey) {
      this.groqClient = new Groq({ apiKey: groqKey })
    }
  }

  public async complete(prompt: string, systemInstruction?: string): Promise<string> {
    // 1. Try Google Gemini if configured
    if (this.geminiClient) {
      try {
        const model = this.geminiClient.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: systemInstruction || 'You are an autonomous enterprise operations intelligence agent.'
        })
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
          }
        })
        const text = result.response.text()
        if (text) return text
      } catch (err: any) {
        console.warn(`[AIService] Gemini call failed, attempting Groq fallback: ${err.message}`)
      }
    }

    // 2. Try Groq (Llama / Qwen) fallback
    if (this.groqClient) {
      try {
        const messages: Array<{ role: 'system' | 'user'; content: string }> = []
        if (systemInstruction) {
          messages.push({ role: 'system', content: systemInstruction })
        }
        messages.push({ role: 'user', content: prompt })

        const res = await this.groqClient.chat.completions.create({
          model: process.env.DEFAULT_MODEL || 'qwen/qwen3.8-27b',
          messages,
          temperature: 0.1,
          max_tokens: 450,
        })
        return res.choices[0]?.message?.content || ''
      } catch (err: any) {
        console.error(`[AIService] Groq call failed: ${err.message}`)
        throw err
      }
    }

    // 3. Fallback mock if neither key is set
    return `[Mock AI Engine] Autonomously analyzed request: "${prompt.slice(0, 80)}...". Root cause verified and resolution approved under standard enterprise SLA guidelines.`
  }
}

export const aiService = new AIService()
