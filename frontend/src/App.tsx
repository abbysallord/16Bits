import React, { useState, useEffect, useRef } from 'react'
import {
  Zap,
  Cpu,
  Layers,
  Terminal,
  Send,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Sliders,
  ExternalLink,
  Presentation,
  ShieldCheck,
  Bot
} from 'lucide-react'
import {
  checkBackendHealth,
  fetchAvailableModels,
  streamChatMessage,
} from './services/api'
import type {
  ChatMessage,
  HealthStatus,
  ModelOption
} from './services/api'

export default function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [checkingHealth, setCheckingHealth] = useState<boolean>(true)
  const [models, setModels] = useState<ModelOption[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('qwen/qwen3.8-27b')
  const [activeTab, setActiveTab] = useState<'agent' | 'matrix' | 'team'>('agent')
  
  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '⚡ **16Bits Agent Online**. Ready for the hackathon sprint. How can I assist your build or test our streaming pipeline?'
    }
  ])
  const [inputPrompt, setInputPrompt] = useState<string>('')
  const [isStreaming, setIsStreaming] = useState<boolean>(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const verifyHealth = async () => {
    setCheckingHealth(true)
    try {
      const data = await checkBackendHealth()
      setHealth(data)
    } catch {
      setHealth(null)
    } finally {
      setCheckingHealth(false)
    }
  }

  useEffect(() => {
    verifyHealth()
    fetchAvailableModels().then((data) => {
      if (data.length > 0) {
        setModels(data)
        setSelectedModel(data[0].id)
      }
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputPrompt.trim() || isStreaming) return

    const userMessage: ChatMessage = { role: 'user', content: inputPrompt.trim() }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInputPrompt('')
    setIsStreaming(true)

    // Append empty assistant message to fill dynamically
    const assistantIndex = updatedMessages.length
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    let accumulated = ''
    await streamChatMessage(
      updatedMessages,
      (chunk) => {
        accumulated += chunk
        setMessages((prev) => {
          const next = [...prev]
          if (next[assistantIndex]) {
            next[assistantIndex] = { role: 'assistant', content: accumulated }
          }
          return next
        })
      },
      () => {
        setIsStreaming(false)
      },
      (err) => {
        setIsStreaming(false)
        setMessages((prev) => {
          const next = [...prev]
          if (next[assistantIndex]) {
            next[assistantIndex] = {
              role: 'assistant',
              content: `⚠️ Error during inference: ${err}. Ensure backend is running and GROQ_API_KEY is configured in backend/.env.`
            }
          }
          return next
        })
      },
      selectedModel
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-neutral-950 text-neutral-100 font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-lg text-white">16Bits</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-950/30 text-emerald-400">
                  HACKATHON-READY
                </span>
              </div>
              <p className="text-xs text-neutral-500">FastAPI + Vite React + Groq LPU</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-neutral-900/60 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => setActiveTab('agent')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'agent'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Bot className="h-3.5 w-3.5" /> AI Playground
              </span>
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'matrix'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Solution Matrix
              </span>
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                activeTab === 'team'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Command Center
              </span>
            </button>
          </nav>

          {/* System Health Status */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-neutral-800 bg-neutral-900/80 text-xs">
              {checkingHealth ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin text-neutral-400" />
                  <span className="text-neutral-400">Pinging...</span>
                </>
              ) : health ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-400 font-medium font-mono text-[11px]">
                    Backend 8000 {health.groq_configured ? '• Groq Active' : '• No API Key'}
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-amber-400 font-medium font-mono text-[11px]">
                    Backend Offline
                  </span>
                </>
              )}
            </div>
            <button
              onClick={verifyHealth}
              title="Refresh Health Status"
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-md transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6">
        {/* TAB 1: AI PLAYGROUND */}
        {activeTab === 'agent' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">
            {/* Sidebar Controls */}
            <div className="lg:col-span-1 flex flex-col gap-4 bg-neutral-900/40 border border-neutral-800/80 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Sliders className="h-4 w-4 text-emerald-400" /> Model Configuration
              </div>

              <div>
                <label className="text-xs text-neutral-400 font-mono mb-1.5 block">SELECT ENGINE</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition"
                >
                  {models.length > 0 ? (
                    models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="qwen/qwen3.8-27b">Qwen 3.8 27B (Default Reasoning)</option>
                      <option value="openai/gpt-oss-120b">GPT OSS 120B (Massive Knowledge)</option>
                      <option value="openai/gpt-oss-20b">GPT OSS 20B (Sub-second Rapid)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800/60 text-xs text-neutral-400 space-y-2">
                <div className="font-semibold text-neutral-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Pipeline Specs
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span>Sampling Temp:</span>
                  <span className="text-emerald-400">0.1 (Strict)</span>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span>Streaming:</span>
                  <span className="text-emerald-400">SSE Protocol</span>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span>Provider:</span>
                  <span className="text-emerald-400">Groq LPUs</span>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-neutral-800/80">
                <a
                  href="http://localhost:3030"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-medium transition"
                >
                  <span className="flex items-center gap-2">
                    <Presentation className="h-4 w-4 text-emerald-400" /> Slidev Pitch Deck
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-neutral-400" />
                </a>
              </div>
            </div>

            {/* Chat Interaction Window */}
            <div className="lg:col-span-3 flex flex-col bg-neutral-900/40 border border-neutral-800/80 rounded-xl overflow-hidden">
              {/* Message Transcript */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 font-sans text-sm">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 ${
                      msg.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="h-7 w-7 rounded-md bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs shrink-0 mt-0.5">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-xl px-4 py-3 leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-neutral-950 border border-neutral-800/80 text-neutral-200'
                      }`}
                    >
                      {msg.content || (isStreaming && idx === messages.length - 1 ? '...' : '')}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Form */}
              <form
                onSubmit={handleSendMessage}
                className="p-4 border-t border-neutral-800/80 bg-neutral-950/60 flex gap-2"
              >
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder="Ask a question or test prompt execution..."
                  disabled={isStreaming}
                  className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputPrompt.trim() || isStreaming}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-lg font-medium text-sm flex items-center gap-2 transition"
                >
                  {isStreaming ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>Stream</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: SOLUTION MATRIX */}
        {activeTab === 'matrix' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Hackathon Ready-Blocks</h2>
              <p className="text-sm text-neutral-400">
                Pre-configured modules to rapidly adapt 16Bits to any announced hackathon theme tomorrow.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Agentic Swarm */}
              <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/30 hover:border-neutral-700 transition">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
                  <Cpu className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-white mb-1">Agentic State Machine</h3>
                <p className="text-xs text-neutral-400 mb-4">
                  Multi-agent coordinator pattern inspired by Kestrel & LangGraph. Agents update shared state sequentially.
                </p>
                <div className="text-xs font-mono text-neutral-500 bg-neutral-950 p-2.5 rounded border border-neutral-800">
                  backend/app/services/agent.py
                </div>
              </div>

              {/* Card 2: Slidev Pitch Deck */}
              <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/30 hover:border-neutral-700 transition">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
                  <Presentation className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-white mb-1">Slidev Pitch Deck</h3>
                <p className="text-xs text-neutral-400 mb-4">
                  Developer-first presentation deck with built-in Mermaid architecture diagram and presenter notes.
                </p>
                <div className="text-xs font-mono text-neutral-500 bg-neutral-950 p-2.5 rounded border border-neutral-800">
                  presentation/slides.md
                </div>
              </div>

              {/* Card 3: Neobrutalism / Retro Styling */}
              <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/30 hover:border-neutral-700 transition">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                  <Sparkles className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-white mb-1">Retro & Neobrutalism</h3>
                <p className="text-xs text-neutral-400 mb-4">
                  Pre-configured Google Fonts (`Press Start 2P`, `Space Grotesk`) and `.neo-border` utilities for bold visuals.
                </p>
                <div className="text-xs font-mono text-neutral-500 bg-neutral-950 p-2.5 rounded border border-neutral-800">
                  frontend/src/index.css
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: COMMAND CENTER */}
        {activeTab === 'team' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Team Coordination & Roster</h2>
              <p className="text-sm text-neutral-400">
                Synchronized roles and quickstart commands for all 3 hackathon teammates.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-5 rounded-xl border border-emerald-500/30 bg-neutral-900/40">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                    TEAM LEAD
                  </span>
                  <Terminal className="h-4 w-4 text-emerald-400" />
                </div>
                <h3 className="font-bold text-white text-base">Dhanush (Lead Architect)</h3>
                <p className="text-xs text-neutral-400 mt-1 mb-4">
                  FastAPI backend, Groq pipeline, agentic state coordination, API integration.
                </p>
                <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 font-mono text-xs text-neutral-300">
                  uvicorn app.main:app --reload --port 8000
                </div>
              </div>

              <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/40">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-neutral-300">
                    FULLSTACK / UI
                  </span>
                  <Layers className="h-4 w-4 text-blue-400" />
                </div>
                <h3 className="font-bold text-white text-base">Teammate 2 (UI Specialist)</h3>
                <p className="text-xs text-neutral-400 mt-1 mb-4">
                  Theme components, dashboard views, responsive design, data visualization.
                </p>
                <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 font-mono text-xs text-neutral-300">
                  npm run dev (Port 5173)
                </div>
              </div>

              <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/40">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/30 text-purple-400">
                    PITCH LEAD
                  </span>
                  <Presentation className="h-4 w-4 text-purple-400" />
                </div>
                <h3 className="font-bold text-white text-base">Teammate 3 (Pitch / Deck)</h3>
                <p className="text-xs text-neutral-400 mt-1 mb-4">
                  Slidev pitch deck, presentation timing, business case, live judging delivery.
                </p>
                <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 font-mono text-xs text-neutral-300">
                  npm run dev (Port 3030)
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
