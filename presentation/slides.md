---
theme: default
title: 16Bits - Hackathon Pitch Deck
info: |
  Competitive Hackathon Pitch Presentation
class: text-center
transition: slide-left
highlighter: shiki
drawings:
  persist: false
mdc: true
---

# 16Bits ⚡

### Autonomous Intelligence & Next-Gen Solution

<div class="pt-12 text-gray-400">
  <span class="px-3 py-1 border border-emerald-500/40 rounded-full text-emerald-400 text-sm">
    Production Hackathon Demo
  </span>
</div>

<div class="abs-bottom-10 left-0 right-0 text-center text-sm text-gray-500">
  Team 16Bits • September 2026
</div>

<!--
Presenter Note:
Hook the judges within the first 15 seconds. State the problem boldly before revealing the demo.
-->

---
layout: two-cols
---

# The Problem 🚨

### Why Existing Solutions Break

<v-clicks>

- **Latency & Inefficiency**: Current systems require multi-step manual intervention.
- **Context Fragmentation**: Siloed tools prevent unified decision making.
- **High Friction**: End-users spend hours doing repetitive cognitive work instead of high-leverage execution.

</v-clicks>

::right::

<div class="p-6 bg-red-950/20 border border-red-500/30 rounded-xl m-4">
  <h3 class="text-red-400 font-bold mb-2">Market Reality</h3>
  <p class="text-gray-300 text-sm leading-relaxed">
    Over 70% of domain workflows suffer from data lag and manual synchronization overhead, draining productive output and introducing human error.
  </p>
</div>

<!--
Presenter Note:
Emphasize the pain point. Show that the judges or consumers feel this pain daily.
-->

---
layout: default
---

# The Solution: 16Bits 💡

A high-performance autonomous agentic system providing sub-second intelligence and automated execution.

<div class="grid grid-cols-3 gap-4 mt-8">
  <div class="p-4 rounded-xl border border-blue-500/30 bg-blue-950/20">
    <div class="text-2xl mb-2">⚡</div>
    <div class="font-bold text-white mb-1">Ultra-Low Latency</div>
    <div class="text-xs text-gray-400">Sub-second inference via Groq LPUs and optimized streaming pipelines.</div>
  </div>
  <div class="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
    <div class="text-2xl mb-2">🧠</div>
    <div class="font-bold text-white mb-1">Autonomous Logic</div>
    <div class="text-xs text-gray-400">Agentic state evaluation and self-correcting validation layers.</div>
  </div>
  <div class="p-4 rounded-xl border border-purple-500/30 bg-purple-950/20">
    <div class="text-2xl mb-2">🖥️</div>
    <div class="font-bold text-white mb-1">Modern Visual UI</div>
    <div class="text-xs text-gray-400">Vite-powered reactive interface with real-time feedback.</div>
  </div>
</div>

---
layout: default
---

# System Architecture 🛠️

```mermaid
graph LR
    Client["Vite + React Frontend (Tailwind/Lucide)"]
    API["FastAPI Gateway (Port 8000)"]
    Service["Autonomous AI Service"]
    Groq["Groq LPU Engine (Llama 3.3 / Qwen)"]

    Client -->|SSE / REST| API
    API -->|Validate & Route| Service
    Service -->|Low Latency Inference| Groq
    Groq -->|Stream Tokens| API
    API -->|Real-Time Chunks| Client
```

---
layout: two-cols
---

# Market & Business Viability 📈

<v-clicks>

- **Target Audience**: High-velocity teams, developers, and enterprises.
- **Go-To-Market**: Open-source community adoption + Enterprise tier.
- **Defensibility**: Low switching costs, extreme speed advantage, and unified state orchestration.

</v-clicks>

::right::

<div class="p-6 bg-emerald-950/20 border border-emerald-500/30 rounded-xl m-4">
  <h3 class="text-emerald-400 font-bold mb-2">Competitive Edge</h3>
  <ul class="text-gray-300 text-sm space-y-2">
    <li>• 10x faster execution than legacy workflows</li>
    <li>• Zero vendor lock-in with open-standard architectures</li>
    <li>• Built for scale from Day 1</li>
  </ul>
</div>

---
layout: center
class: text-center
---

# Live Demonstration 🎬

Let's see **16Bits** in action!

<div class="mt-8">
  <a href="http://localhost:5173" target="_blank" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition shadow-lg shadow-emerald-500/20">
    Launch Application →
  </a>
</div>

<div class="mt-12 text-sm text-gray-400">
  Team 16Bits • Q&A Session
</div>
