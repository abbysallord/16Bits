#!/usr/bin/env node

/**
 * 16Bits OmniOps CLI Tool
 * Fast, terminal-native autonomous operations client & agent-to-agent interface.
 * Supports direct arguments, piping stdin, and live system diagnosis.
 */

import os from 'os'
import net from 'net'

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
  bgYellow: '\x1b[43m\x1b[30m',
  bgCyan: '\x1b[46m\x1b[30m'
}

function printBanner() {
  console.log(`
${c.cyan}${c.bold}╔══════════════════════════════════════════════════════╗
║  ⚡ 16Bits OmniOps — Autonomous Operations Swarm CLI  ║
╚══════════════════════════════════════════════════════╝${c.reset}
${c.dim}  Connected to Engine: ${API_BASE}${c.reset}
`)
}

async function readStdin() {
  if (process.stdin.isTTY) return ''
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', chunk => { data += chunk })
    process.stdin.on('end', () => resolve(data.trim()))
    setTimeout(() => resolve(data.trim()), 2000)
  })
}

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(400)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.on('error', () => {
      resolve(false)
    })
    socket.connect(port, host)
  })
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

async function runDoctor() {
  printBanner()
  console.log(`${c.bold}Running Host Infrastructure Diagnostics...${c.reset}\n`)

  const totalMemGb = (os.totalmem() / (1024 ** 3)).toFixed(2)
  const freeMemGb = (os.freemem() / (1024 ** 3)).toFixed(2)
  const memUsedPercent = Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
  const loads = os.loadavg().map(n => Number(n.toFixed(2)))
  const cpus = os.cpus().length

  console.log(`${c.bold}${c.cyan}Host Vitals:${c.reset}`)
  console.log(`  ${c.dim}OS / Arch:${c.reset}    ${os.platform()} (${os.arch()})`)
  console.log(`  ${c.dim}CPU Cores:${c.reset}    ${cpus} cores | 1m/5m/15m Load: [${loads.join(', ')}]`)
  console.log(`  ${c.dim}RAM Usage:${c.reset}    ${memUsedPercent}% used (${freeMemGb} GB free of ${totalMemGb} GB)`)

  console.log(`\n${c.bold}${c.cyan}Core Service Probing:${c.reset}`)
  const p8000 = await checkPort(8000)
  const p5173 = await checkPort(5173)
  const p5432 = await checkPort(5432)
  const p6379 = await checkPort(6379)

  console.log(`  ${p8000 ? c.green + '✔' : c.red + '✖'} Port 8000 (OmniOps Engine): ${p8000 ? 'ONLINE' : 'OFFLINE'}${c.reset}`)
  console.log(`  ${p5173 ? c.green + '✔' : c.yellow + '○'} Port 5173 (React Dashboard): ${p5173 ? 'ONLINE' : 'NOT RUNNING'}${c.reset}`)
  console.log(`  ${p5432 ? c.green + '✔' : c.dim + '○'} Port 5432 (PostgreSQL):     ${p5432 ? 'LISTENING' : 'NOT DETECTED'}${c.reset}`)
  console.log(`  ${p6379 ? c.green + '✔' : c.dim + '○'} Port 6379 (Redis Cache):    ${p6379 ? 'LISTENING' : 'NOT DETECTED'}${c.reset}`)

  if (memUsedPercent > 90 || loads[0] > cpus * 2) {
    console.log(`\n${c.bgYellow} ⚠️ HOST UNDER HIGH PRESSURE — Auto-triggering Swarm Triage... ${c.reset}`)
    await triageIncident(`Host resource exhaustion: Memory at ${memUsedPercent}%, Load average ${loads[0]} on ${cpus} cores`, 'HIGH')
  } else {
    console.log(`\n${c.green}✔ Host vitals within normal operating thresholds.${c.reset}\n`)
  }
}

async function triageIncident(query, priority = 'HIGH') {
  printBanner()
  console.log(`${c.bold}Initiating 4-Agent Swarm Triage...${c.reset}`)
  console.log(`${c.dim}Incident Payload:${c.reset}\n"${query.slice(0, 160)}${query.length > 160 ? '...' : ''}"`)
  console.log(`${c.dim}Priority Target:${c.reset}  ${priority}\n`)

  const startTime = Date.now()

  try {
    const res = await fetch(`${API_BASE}/api/agents/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: query.split('\n')[0].slice(0, 80) || 'Piped Incident Error',
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
      console.log(`  ${c.bold}omniops approve ${result.incidentId}${c.reset}\n`)
    } else {
      console.log(`\n${c.bgGreen} ✔ REMEDIATION COMPLETED & COMMITTED TO SQLITE ${c.reset}\n`)
    }
  } catch (err) {
    console.error(`\n${c.red}✖ Swarm execution failed:${c.reset}`, err.message)
    console.log(`${c.yellow}Check if OmniOps Engine is running at ${API_BASE}.${c.reset}`)
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

async function main() {
  const stdinData = await readStdin()
  const [,, command, ...args] = process.argv

  // Case 1: Input was piped via stdin (e.g. `cat error.log | 16bits` or `npm test | 16bits`)
  if (stdinData) {
    const priority = (command && command.match(/^(CRITICAL|HIGH|MEDIUM|LOW)$/i)) 
      ? command 
      : (args[0] || 'HIGH')
    await triageIncident(stdinData, priority)
    return
  }

  // Case 2: Interactive CLI subcommands
  switch (command) {
    case 'status':
    case 'health':
      await checkHealth()
      break
    case 'doctor':
      await runDoctor()
      break
    case 'triage':
    case 'alert': {
      const text = args.join(' ')
      if (!text) {
        console.log(`${c.yellow}Usage:${c.reset} omniops triage "<incident description or error>" [PRIORITY]`)
        console.log(`       cat error.log | omniops`)
        console.log(`Example: omniops triage "Postgres pool exhausted on replica-02" CRITICAL`)
        process.exit(1)
      }
      const priority = args[args.length - 1].match(/^(CRITICAL|HIGH|MEDIUM|LOW)$/i) ? args.pop() : 'HIGH'
      await triageIncident(args.join(' ') || text, priority)
      break
    }
    case 'approve': {
      const id = args[0]
      if (!id) {
        console.log(`${c.yellow}Usage:${c.reset} omniops approve <incidentId>`)
        process.exit(1)
      }
      await approveIncident(id)
      break
    }
    default:
      printBanner()
      console.log(`${c.bold}Available Commands:${c.reset}`)
      console.log(`  ${c.green}omniops doctor${c.reset}                   Probe host health, memory, and listening ports`)
      console.log(`  ${c.green}omniops status${c.reset}                   Check cluster health and active runbooks`)
      console.log(`  ${c.green}omniops triage "<error>"${c.reset}         Dispatch autonomous 4-agent swarm`)
      console.log(`  ${c.green}omniops approve <id>${c.reset}             Sign off on critical operator safety gate`)
      console.log(`\n${c.bold}Pipe Stdin Support:${c.reset}`)
      console.log(`  ${c.cyan}cat /var/log/syslog | tail -n 20 | omniops${c.reset}`)
      console.log(`  ${c.cyan}docker logs container 2>&1 | omniops${c.reset}`)
      console.log(`\n${c.dim}Examples:${c.reset}`)
      console.log(`  omniops triage "Stripe 429 webhook throttle spike" CRITICAL`)
      console.log(`  omniops doctor\n`)
      break
  }
}

main()
