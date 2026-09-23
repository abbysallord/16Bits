#!/usr/bin/env node

/**
 * 16Bits OmniOps CLI Tool
 * Fast, terminal-native autonomous operations client & agent-to-agent interface.
 * Supports direct arguments, piping stdin, and live system diagnosis.
 * Strict ZERO EMOJI enterprise compliance.
 */

import os from 'os'
import net from 'net'

const DEFAULT_CLOUD_API = 'https://one6bits.onrender.com'
let API_BASE = process.env.OMNIOPS_API_URL || DEFAULT_CLOUD_API

async function initApiBase() {
  if (process.env.OMNIOPS_API_URL) {
    API_BASE = process.env.OMNIOPS_API_URL.replace(/\/$/, '')
    return
  }
  // Fast probe to check if local server is listening on port 8000
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 200)
    const res = await fetch('http://localhost:8000/api/health', { signal: controller.signal })
    clearTimeout(timer)
    if (res.ok) {
      API_BASE = 'http://localhost:8000'
      return
    }
  } catch {
    // Localhost not responding, connect to production cloud engine
  }
  API_BASE = DEFAULT_CLOUD_API
}

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m\x1b[30m',
  bgYellow: '\x1b[43m\x1b[30m',
  bgCyan: '\x1b[46m\x1b[30m',
  bgRed: '\x1b[41m\x1b[37m',
}

function printBanner() {
  const isCloud = !API_BASE.includes('localhost')
  const engineLabel = isCloud ? 'Production Cloud' : 'Localhost Dev'
  console.log(`
${c.cyan}${c.bold}╔══════════════════════════════════════════════════════════════╗
║  [16BITS] OmniOps — Autonomous Operations Swarm CLI (v1.0.2) ║
║  ${c.dim}// 4-AGENT SWARM · AST CODE KNOWLEDGE · LANGSMITH TRACED //${c.cyan} ║
╚══════════════════════════════════════════════════════════════╝${c.reset}
  ${c.dim}Engine Link:${c.reset} [${isCloud ? c.green + engineLabel : c.yellow + engineLabel}${c.reset}] -> ${c.cyan}${API_BASE}${c.reset}
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
      socket.destroy()
      resolve(false)
    })
    socket.connect(port, host)
  })
}

async function checkHealth() {
  printBanner()
  try {
    const res = await fetch(`${API_BASE}/api/health`)
    const data = await res.json()
    const rRes = await fetch(`${API_BASE}/api/agents/runbooks`)
    const rData = await rRes.json()

    console.log(`${c.green}[OK] Engine Status:${c.reset} ${data.status.toUpperCase()} (v${data.version})`)
    console.log(`${c.green}[OK] Database:${c.reset}      ${data.database}`)
    console.log(`${c.green}[OK] AI Engine:${c.reset}     ${data.ai_configured ? `Active (${data.ai_provider || 'Neural'})` : 'Mock Engine'}`)
    console.log(`${c.cyan}[OK] SOP Runbooks:${c.reset}  ${rData.count} active runbooks loaded\n`)

    console.log(`${c.bold}Loaded Runbooks:${c.reset}`)
    rData.runbooks.forEach((r) => {
      console.log(`  ${c.dim}• [${r.filename}] ${r.title}${c.reset}`)
    })
  } catch (err) {
    console.error(`${c.red}[FAIL] Failed to connect to OmniOps Engine at ${API_BASE}:${c.reset}`, err.message)
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

  console.log(`  ${p8000 ? c.green + '[OK]' : c.red + '[FAIL]'} Port 8000 (OmniOps Engine): ${p8000 ? 'ONLINE' : 'OFFLINE'}${c.reset}`)
  console.log(`  ${p5173 ? c.green + '[OK]' : c.yellow + '[--]'} Port 5173 (React Dashboard): ${p5173 ? 'ONLINE' : 'NOT RUNNING'}${c.reset}`)
  console.log(`  ${p5432 ? c.green + '[OK]' : c.dim + '[--]'} Port 5432 (PostgreSQL):     ${p5432 ? 'LISTENING' : 'NOT DETECTED'}${c.reset}`)
  console.log(`  ${p6379 ? c.green + '[OK]' : c.dim + '[--]'} Port 6379 (Redis Cache):    ${p6379 ? 'LISTENING' : 'NOT DETECTED'}${c.reset}`)

  if (memUsedPercent > 90 || loads[0] > cpus * 2) {
    console.log(`\n${c.bgYellow} [WARN] HOST UNDER HIGH PRESSURE — Auto-triggering Swarm Triage... ${c.reset}`)
    await triageIncident(`Host resource exhaustion: Memory at ${memUsedPercent}%, Load average ${loads[0]} on ${cpus} cores`, 'HIGH')
  } else {
    console.log(`\n${c.green}[OK] Host vitals within normal operating thresholds.${c.reset}\n`)
  }
}

function renderTerminalMarkdown(md) {
  const lines = md.split('\n')
  const out = []
  let inCode = false
  for (let l of lines) {
    if (l.trim().startsWith('```')) {
      inCode = !inCode
      out.push(inCode ? `  ${c.dim}┌── [command] ${'─'.repeat(44)}${c.reset}` : `  ${c.dim}└${'─'.repeat(56)}${c.reset}`)
      continue
    }
    if (inCode) {
      out.push(`  ${c.green}${c.bold}  $ ${l}${c.reset}`)
      continue
    }
    if (l.startsWith('# ')) {
      const t = l.replace(/^#\s*/, '').replace(/\*\*/g, '').trim()
      out.push(`\n${c.cyan}${c.bold}▶ ${t.toUpperCase()}${c.reset}`)
      out.push(`${c.dim}${'─'.repeat(Math.min(t.length + 2, 60))}${c.reset}`)
      continue
    }
    if (l.startsWith('## ')) {
      const t = l.replace(/^##\s*/, '').replace(/\*\*/g, '').trim()
      out.push(`\n${c.yellow}${c.bold}◆ ${t}${c.reset}`)
      continue
    }
    if (l.startsWith('### ')) {
      const t = l.replace(/^###\s*/, '').replace(/\*\*/g, '').trim()
      out.push(`\n${c.bold}${t}${c.reset}`)
      continue
    }
    l = l.replace(/\*\*(.*?)\*\*/g, `${c.bold}$1${c.reset}`)
    l = l.replace(/`([^`]+)`/g, `${c.cyan}$1${c.reset}`)
    const nMatch = l.trim().match(/^(\d+)\.\s*(.*)/)
    if (nMatch) {
      out.push(`  ${c.yellow}${c.bold}${nMatch[1]}.${c.reset} ${nMatch[2]}`)
      continue
    }
    if (l.trim().startsWith('* ') || l.trim().startsWith('- ')) {
      out.push(`  ${c.cyan}•${c.reset} ${l.trim().replace(/^[\*\-]\s*/, '')}`)
      continue
    }
    out.push(l)
  }
  return out.join('\n')
}

async function triageIncident(query, priority = 'HIGH') {
  printBanner()
  
  const prioUpper = priority.toUpperCase()
  const prioBadge = prioUpper === 'CRITICAL'
    ? `${c.bgRed} CRITICAL ${c.reset}`
    : (prioUpper === 'HIGH' ? `${c.bgYellow} HIGH ${c.reset}` : `${c.bgCyan} ${prioUpper} ${c.reset}`)

  console.log(`${c.bold}Initiating 4-Agent Swarm Triage...${c.reset}`)
  console.log(`${c.dim}Severity Target:${c.reset} ${prioBadge}`)
  console.log(`${c.dim}Incident Payload:${c.reset}\n"${query.slice(0, 160)}${query.length > 160 ? '...' : ''}"\n`)

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

    // 1. Display Clean 4-Agent Trajectory Card
    console.log(`\n${c.cyan}${c.bold}┌── [4-Agent Autonomous Swarm Trajectory] ──────────────────────────┐${c.reset}`)
    result.logs.forEach((log) => {
      const stepBadge = `Step ${log.stepNumber}: ${log.agentName}`
      const statusIcon = log.agentName.includes('Verification') && result.status === 'AWAITING_APPROVAL'
        ? `${c.yellow}[HALT]${c.reset}`
        : `${c.green}[OK]${c.reset}`
      console.log(`${c.cyan}│${c.reset}  ${statusIcon} ${c.bold}${stepBadge.padEnd(28)}${c.reset} ${c.dim}• ${log.action.slice(0, 42)}...${c.reset}`)

      if (log.stepNumber === 2) {
        if (result.matchedRunbookTitle) {
          console.log(`${c.cyan}│${c.reset}     ${c.dim}├─ SOP Runbook:${c.reset}  "${result.matchedRunbookTitle}"`)
        }
        if (log.dataPayload?.inspectedFile) {
          console.log(`${c.cyan}│${c.reset}     ${c.dim}├─ Code Inspect:${c.reset} ${c.green}[${log.dataPayload.inspectedFile}] (AST Verified)${c.reset}`)
        }
        if (log.dataPayload?.astKnowledgeGraph) {
          console.log(`${c.cyan}│${c.reset}     ${c.dim}└─ Architecture:${c.reset} ${c.magenta}${log.dataPayload.astKnowledgeGraph}${c.reset}`)
        }
      }
      if (log.stepNumber === 3) {
        const ruling = result.status === 'AWAITING_APPROVAL' ? 'OPERATOR AUTHORIZATION REQUIRED' : 'VERIFIED SAFE'
        console.log(`${c.cyan}│${c.reset}     ${c.dim}└─ Safety Gate:${c.reset}   [${ruling}]`)
      }
    })
    console.log(`${c.cyan}└───${'─'.repeat(68)}┘${c.reset}\n`)

    // 2. Render Formatted Remediation Playbook
    console.log(`${c.bold}${c.green}=== [Synthesized Remediation Playbook] ===${c.reset}`)
    console.log(renderTerminalMarkdown(result.finalResolution))

    // 3. Execution Summary Box
    console.log(`\n${c.dim}┌── [Swarm Execution Summary] ──────────────────────────────────────────┐${c.reset}`)
    console.log(`${c.dim}│${c.reset}  ${c.bold}Status:${c.reset}          ${result.status === 'AWAITING_APPROVAL' ? c.bgYellow + ' [HALT: AWAITING OPERATOR APPROVAL] ' + c.reset : c.bgGreen + ' [OK: RESOLVED] ' + c.reset}`)
    console.log(`${c.dim}│${c.reset}  ${c.bold}Turnaround:${c.reset}      ${c.bold}${c.green}${result.executionDurationMs}ms${c.reset} ${c.dim}(Autonomous Sub-3s SLA)${c.reset}`)
    console.log(`${c.dim}│${c.reset}  ${c.bold}Incident ID:${c.reset}     ${c.cyan}${result.incidentId}${c.reset}`)

    if (result.langsmithTraceUrl) {
      console.log(`${c.dim}│${c.reset}  ${c.bold}LangSmith Trace:${c.reset} ${c.cyan}${result.langsmithTraceUrl}${c.reset}`)
    }
    console.log(`${c.dim}└───────────────────────────────────────────────────────────────────────┘${c.reset}`)

    if (result.status === 'AWAITING_APPROVAL') {
      console.log(`\n${c.yellow}${c.bold}--> To authorize and sign off this execution:${c.reset}`)
      console.log(`   ${c.bold}omniops approve ${result.incidentId}${c.reset}\n`)
    } else {
      console.log(`\n${c.bgGreen} [OK: REMEDIATION COMPLETED & COMMITTED TO SQLITE] ${c.reset}\n`)
    }
  } catch (err) {
    console.error(`\n${c.red}[FAIL] Swarm execution failed:${c.reset}`, err.message)
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
    console.log(`\n${c.green}${c.bold}[OK] Incident Authorized & Resolved!${c.reset}`)
    console.log(`${c.dim}Incident ID:${c.reset} ${data.incident.id}`)
    console.log(`${c.dim}Updated Status:${c.reset} ${data.incident.status}`)
    console.log(`${c.dim}Title:${c.reset} ${data.incident.title}\n`)
  } catch (err) {
    console.error(`\n${c.red}[FAIL] Approval failed:${c.reset}`, err.message)
  }
}

async function main() {
  await initApiBase()
  const stdinData = await readStdin()
  const [,, command, ...args] = process.argv

  // Case 1: Input was piped via stdin (e.g. `cat error.log | omniops` or `npm test | omniops`)
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
      // If user typed a direct error string like `omniops "Postgres replica lag > 180s" CRITICAL`
      if (command && !command.startsWith('-')) {
        const allTokens = [command, ...args]
        const lastToken = allTokens[allTokens.length - 1]
        const hasPriority = lastToken && lastToken.match(/^(CRITICAL|HIGH|MEDIUM|LOW)$/i)
        const priority = hasPriority ? allTokens.pop() : 'HIGH'
        const text = allTokens.join(' ')
        await triageIncident(text, priority)
        break
      }

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
      console.log(`  omniops "Stripe 429 webhook throttle spike" CRITICAL`)
      console.log(`  omniops triage "Database connection pool saturated" HIGH`)
      console.log(`  omniops doctor\n`)
      break
  }
}

main()
