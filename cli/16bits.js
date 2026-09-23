#!/usr/bin/env node

/**
 * 16Bits OmniOps CLI Tool
 * Fast, terminal-native autonomous operations client & agent-to-agent interface.
 */

const API_BASE = process.env.OMNIOPS_API_URL || 'http://localhost:8000'

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  bgGreen: '\x1b[42m\x1b[30m',
  bgYellow: '\x1b[43m\x1b[30m'
}

function printBanner() {
  console.log(`
${c.cyan}${c.bold}╔══════════════════════════════════════════════════════╗
║  ⚡ 16Bits OmniOps — Autonomous Operations Swarm CLI  ║
╚══════════════════════════════════════════════════════╝${c.reset}
${c.dim}  Connected to Engine: ${API_BASE}${c.reset}
`)
}

async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    console.log(`${c.green}✔ Engine Status:${c.reset} ${data.status.toUpperCase()} (v${data.version})`)
    console.log(`${c.green}✔ Database:${c.reset}      ${data.database}`)
    console.log(`${c.green}✔ AI Engine:${c.reset}     ${data.ai_configured ? 'Active (Groq LPU / LangSmith)' : 'Offline'}`)

    const rRes = await fetch(`${API_BASE}/api/agents/runbooks`)
    const rData = await rRes.json()
    console.log(`${c.cyan}✔ SOP Runbooks:${c.reset}  ${rData.count} active runbooks loaded`)
    rData.runbooks.forEach((r) => {
      console.log(`  ${c.dim}• [${r.filename}] ${r.title}${c.reset}`)
    })
  } catch (err) {
    console.error(`${c.red}✖ Failed to connect to OmniOps Engine at ${API_BASE}:${c.reset}`, err.message)
    console.log(`${c.yellow}Ensure 'npm run dev' or backend server is running on port 8000.${c.reset}`)
  }
}

async function triageIncident(query, priority = 'HIGH') {
  printBanner()
  console.log(`${c.bold}Initiating 4-Agent Swarm Triage...${c.reset}`)
  console.log(`${c.dim}Incident:${c.reset} "${query}"`)
  console.log(`${c.dim}Priority:${c.reset} ${priority}\n`)

  const startTime = Date.now()

  try {
    const res = await fetch(`${API_BASE}/api/agents/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: query.slice(0, 80),
        description: query,
        priority: priority.toUpperCase(),
        category: 'CLI Triggered'
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }

    const { result } = await res.json()
    const elapsed = Date.now() - startTime

    // Display execution logs
    console.log(`${c.bold}${c.cyan}=== Autonomous Execution Trajectory ===${c.reset}`)
    result.logs.forEach((log) => {
      console.log(`\n${c.bold}${c.green}[Step ${log.stepNumber}] ${log.agentName}${c.reset}`)
      console.log(`  ${c.yellow}Action:${c.reset} ${log.action}`)
      console.log(`  ${c.dim}Analysis:${c.reset} ${log.thought}`)
    })

    console.log(`\n${c.bold}${c.cyan}=== Synthesized Remediation Plan ===${c.reset}\n`)
    console.log(result.finalResolution)

    console.log(`\n${c.dim}────────────────────────────────────────────────────────${c.reset}`)
    console.log(`${c.green}${c.bold}Execution Time:${c.reset}  ${elapsed}ms (Swarm Engine: ${result.executionDurationMs}ms)`)
    console.log(`${c.cyan}${c.bold}Incident ID:${c.reset}     ${result.incidentId}`)
    console.log(`${c.magenta}${c.bold}Security Gate:${c.reset}   ${result.status}`)

    if (result.langsmithTraceUrl) {
      console.log(`${c.cyan}${c.bold}LangSmith Trace:${c.reset} ${result.langsmithTraceUrl}`)
    }

    if (result.status === 'AWAITING_APPROVAL') {
      console.log(`\n${c.bgYellow} 🛑 SLA GUARDRAIL: OPERATOR AUTHORIZATION REQUIRED ${c.reset}`)
      console.log(`${c.yellow}To authorize this plan, run:${c.reset}`)
      console.log(`  ${c.bold}16bits approve ${result.incidentId}${c.reset}\n`)
    } else {
      console.log(`\n${c.bgGreen} ✔ REMEDIATION COMPLETED & COMMITTED TO SQLITE ${c.reset}\n`)
    }
  } catch (err) {
    console.error(`\n${c.red}✖ Swarm execution failed:${c.reset}`, err.message)
  }
}

async function approveIncident(incidentId) {
  try {
    const res = await fetch(`${API_BASE}/api/agents/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        incidentId,
        approvedBy: process.env.USER || 'CLI Operator'
      })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }

    const data = await res.json()
    console.log(`\n${c.green}${c.bold}✔ Incident Authorized & Resolved!${c.reset}`)
    console.log(`${c.dim}Incident ID:${c.reset} ${data.incident.id}`)
    console.log(`${c.dim}Updated Status:${c.reset} ${data.incident.status}`)
    console.log(`${c.dim}Title:${c.reset} ${data.incident.title}\n`)
  } catch (err) {
    console.error(`\n${c.red}✖ Approval failed:${c.reset}`, err.message)
  }
}

// Simple CLI Dispatcher
const [,, command, ...args] = process.argv

switch (command) {
  case 'status':
  case 'health':
    checkHealth()
    break
  case 'triage':
  case 'alert': {
    const text = args.join(' ')
    if (!text) {
      console.log(`${c.yellow}Usage:${c.reset} 16bits triage "<incident description or error>" [PRIORITY]`)
      console.log(`Example: 16bits triage "Postgres pool exhausted on replica-02" CRITICAL`)
      process.exit(1)
    }
    const priority = args[args.length - 1].match(/^(CRITICAL|HIGH|MEDIUM|LOW)$/i) ? args.pop() : 'HIGH'
    triageIncident(args.join(' ') || text, priority)
    break
  }
  case 'approve': {
    const id = args[0]
    if (!id) {
      console.log(`${c.yellow}Usage:${c.reset} 16bits approve <incidentId>`)
      process.exit(1)
    }
    approveIncident(id)
    break
  }
  default:
    printBanner()
    console.log(`${c.bold}Available Commands:${c.reset}`)
    console.log(`  ${c.green}16bits status${c.reset}                   Check cluster health and active runbooks`)
    console.log(`  ${c.green}16bits triage "<error>"${c.reset}         Dispatch autonomous 4-agent swarm`)
    console.log(`  ${c.green}16bits approve <id>${c.reset}             Sign off on critical operator safety gate`)
    console.log(`\n${c.dim}Examples:${c.reset}`)
    console.log(`  node cli/16bits.js status`)
    console.log(`  node cli/16bits.js triage "Stripe 429 webhook throttle spike" CRITICAL`)
    console.log(`  node cli/16bits.js approve 835fd248-8608-4678-957a-c927877ee3db\n`)
    break
}
