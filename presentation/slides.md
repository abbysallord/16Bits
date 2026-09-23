---
theme: default
title: 16Bits OmniOps - Hackathon Pitch Deck
info: |
  Autonomous Multi-Agent Enterprise Workflow & Incident Orchestrator
class: text-center
transition: slide-left
highlighter: shiki
drawings:
  persist: false
mdc: true
---

# 16Bits OmniOps

### Autonomous Multi-Agent Enterprise Orchestrator

<div class="pt-8 text-gray-400">
  <span class="px-3 py-1 border border-emerald-500/40 rounded-full text-emerald-400 text-sm font-mono">
    Theme: Agentic AI & Intelligent Systems
  </span>
</div>

<div class="abs-bottom-10 left-0 right-0 text-center text-sm text-gray-500 font-mono">
  Team 16Bits • Live Production Demo • npm: omniops@1.0.0
</div>

<!--
Presenter Note:
Hook the judges within the first 15 seconds:
"Every day, companies lose millions when critical software or operational incidents happen because humans spend 45 minutes manually checking 10 different dashboards. Today, we built 16Bits OmniOps: an autonomous 4-agent swarm that solves incidents in 3 seconds."
-->

---
layout: two-cols
---

# The Problem in Plain Words

### The 45-Minute Human Bottleneck

<v-clicks>

- **Fragmented Tools**: When an alert fires (e.g. Stripe payment failure), an engineer must check Stripe, check database metrics, check AWS logs, and check customer contracts.
- **SLA Penalty Risk**: Enterprise clients have contracted 15-minute response guarantees. Human decision lag leads to breach penalties.
- **Why Simple AI Fails**: A standard ChatGPT/Gemini prompt hallucinates or suggests risky actions without checking compliance or safety policies.

</v-clicks>

::right::

<div class="p-6 bg-red-950/20 border border-red-500/30 rounded-xl m-4">
  <h3 class="text-red-400 font-bold mb-2">Cost of Human Latency</h3>
  <p class="text-gray-300 text-sm leading-relaxed mb-3">
    Enterprise downtime costs an average of <strong>$5,600 per minute</strong>.
  </p>
  <p class="text-gray-400 text-xs">
    Manual coordination across siloed departments creates dangerous delays and inconsistent outcomes.
  </p>
</div>

<!--
Presenter Note:
Explain that modern business doesn't need another generic chatbot. It needs autonomous agents that can safely execute real operational workflows.
-->

---
layout: default
---

# The Solution: The 4-Agent Consensus Swarm

Instead of one lazy prompt, **16Bits OmniOps** coordinates specialized autonomous agents:

<div class="grid grid-cols-4 gap-3 mt-6">
  <div class="p-4 rounded-xl border border-blue-500/30 bg-blue-950/20">
    <div class="text-xs font-mono text-blue-400 font-bold uppercase mb-1">Agent 1</div>
    <div class="font-bold text-white mb-1">Planner Agent</div>
    <div class="text-xs text-gray-400">Decomposes the incident into an execution plan and telemetry queries.</div>
  </div>
  <div class="p-4 rounded-xl border border-purple-500/30 bg-purple-950/20">
    <div class="text-xs font-mono text-purple-400 font-bold uppercase mb-1">Agent 2</div>
    <div class="font-bold text-white mb-1">Investigator Agent</div>
    <div class="text-xs text-gray-400">Queries database tools, system queues, and SLA contracts.</div>
  </div>
  <div class="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20">
    <div class="text-xs font-mono text-amber-400 font-bold uppercase mb-1">Agent 3</div>
    <div class="font-bold text-white mb-1">Verification Gate</div>
    <div class="text-xs text-gray-400">Audits findings against safety rules & SLAs before any action is approved.</div>
  </div>
  <div class="p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
    <div class="text-xs font-mono text-emerald-400 font-bold uppercase mb-1">Agent 4</div>
    <div class="font-bold text-white mb-1">Synthesizer Agent</div>
    <div class="text-xs text-gray-400">Dispatches remediation playbook, executive memo, and post-mortem.</div>
  </div>
</div>

---
layout: default
---

# Architecture & Tech Stack

```mermaid
graph LR
    Client["React + Vite / CLI / Skill\n(Terminal & Web & Agent)"]
    API["Express.js Gateway\n(JWT + Zod + SQLite)"]
    Swarm["4-Agent Consensus Swarm\n(Planner • Investigator • Verifier • Synthesizer)"]
    Obs["LangSmith Observability\n(RunTree Trace Spans)"]
    Runbooks["Local SOP Runbooks & OS Telemetry\n(Markdown SOPs + Host Vitals)"]

    Client -->|REST / SSE / CLI| API
    API -->|Dispatch| Swarm
    Swarm -->|Child Spans| Obs
    Swarm -->|Inspect| Runbooks
    Swarm -->|Audit Trail| API
```

<div class="mt-4 p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-gray-400 flex justify-around">
  <span>Frontend: React 19 + Vite + NES.css</span>
  <span>Backend: Express.js (Node.js LTS)</span>
  <span>Observability: LangSmith Tracing</span>
  <span>Distribution: npm i -g omniops</span>
</div>

---
layout: two-cols
---

# Business Viability & Market Impact

<v-clicks>

- **Target Market**: SaaS platforms, Fintech payment gateways, Cloud infrastructure providers.
- **Measured Advantage**: Reduces incident resolution time from **45 minutes to 3.4 seconds** (99% reduction).
- **Compliance & Safety**: Pre-generation verification gate prevents hallucinated or unauthorized system operations (`AWAITING_APPROVAL`).
- **100% Transparent Observability**: Every agent thought and tool call logged live to LangSmith.

</v-clicks>

::right::

<div class="p-6 bg-emerald-950/20 border border-emerald-500/30 rounded-xl m-4">
  <h3 class="text-emerald-400 font-bold mb-2">The Competitive Moat</h3>
  <ul class="text-gray-300 text-sm space-y-2">
    <li>• <strong>Multi-Agent Swarm</strong> vs. brittle single prompts</li>
    <li>• <strong>Human-in-the-Loop Safety Gate</strong> for high-risk operations</li>
    <li>• <strong>Universal Interfaces</strong>: Web UI + Terminal CLI + Agent Skill (`SKILL.md`)</li>
    <li>• <strong>Live LangSmith Tracing</strong> with sub-4-second latency</li>
  </ul>
</div>

---
layout: center
class: text-center
---

# Live Demonstration

Let's see **16Bits OmniOps** resolve a critical enterprise incident live!

<div class="mt-8 flex justify-center gap-4">
  <a href="https://one6bits.onrender.com" target="_blank" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition shadow-lg shadow-emerald-500/20">
    Render Backend Health ->
  </a>
  <a href="https://www.npmjs.com/package/omniops" target="_blank" class="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition shadow-lg shadow-blue-500/20">
    npm Package: omniops ->
  </a>
</div>

<div class="mt-12 text-sm text-gray-500 font-mono">
  Team 16Bits • Thank you!
</div>
