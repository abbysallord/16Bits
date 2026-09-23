#!/usr/bin/env node

/**
 * 16Bits OmniOps CLI Tool
 * Fast, terminal-native autonomous operations client & agent-to-agent interface.
 * Supports direct arguments, piping stdin, interactive authorization, and private team workspaces.
 * Strict ZERO EMOJI enterprise compliance.
 */

import os from 'os'
import net from 'net'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { exec } from 'child_process'

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
║  [16BITS] OmniOps — Autonomous Operations Swarm CLI (v1.0.4) ║
║  ${c.dim}// 4-AGENT SWARM · AST CODE KNOWLEDGE · LANGSMITH TRACED //${c.cyan} ║
╚══════════════════════════════════════════════════════════════╝${c.reset}
  ${c.dim}Engine Link:${c.reset} [${isCloud ? c.green + engineLabel : c.yellow + engineLabel}${c.reset}] -> ${c.cyan}${API_BASE}${c.reset}
`)
}

// ============================================================================
// Local Persistent Config (~/.omniops/config.json)
// ============================================================================

function getConfigDir() {
  return path.join(os.homedir(), '.omniops')
}

function getConfigPath() {
  return path.join(getConfigDir(), 'config.json')
}

function readConfig() {
  try {
    const p = getConfigPath()
    if (!fs.existsSync(p)) return null
    const raw = fs.readFileSync(p, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeConfig(data) {
  try {
    const dir = getConfigDir()
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(getConfigPath(), JSON.stringify(data, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
}

function clearConfig() {
  try {
    const p = getConfigPath()
    if (fs.existsSync(p)) fs.unlinkSync(p)
    return true
  } catch {
    return false
  }
}

function getHistoryPath() {
  return path.join(getConfigDir(), 'history.json')
}

function readHistory() {
  try {
    const p = getHistoryPath()
    if (!fs.existsSync(p)) return []
    return JSON.parse(fs.readFileSync(p, 'utf-8')) || []
  } catch {
    return []
  }
}

function recordLocalIncident(item) {
  try {
    const dir = getConfigDir()
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const history = readHistory().filter((h) => h.incidentId !== item.incidentId)
    history.unshift(item)
    fs.writeFileSync(getHistoryPath(), JSON.stringify(history.slice(0, 50), null, 2), 'utf-8')
  } catch {}
}

async function claimLocalIncidents(token) {
  const history = readHistory()
  if (!history.length) return 0
  const incidentIds = history.map((h) => h.incidentId).filter(Boolean)
  if (!incidentIds.length) return 0

  try {
    const res = await fetch(`${API_BASE}/api/agents/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ incidentIds })
    })
    if (!res.ok) return 0
    const data = await res.json()
    return data.claimedCount || 0
  } catch {
    return 0
  }
}

function getStoredToken() {
  if (process.env.OMNIOPS_TOKEN) return process.env.OMNIOPS_TOKEN.trim()
  const cfg = readConfig()
  if (cfg && cfg.token) return cfg.token.trim()
  return null
}

function getStoredUser() {
  const cfg = readConfig()
  return cfg?.user || null
}

function getWebAppBase() {
  if (process.env.OMNIOPS_APP_URL) return process.env.OMNIOPS_APP_URL.replace(/\/$/, '')
  return API_BASE.includes('localhost') ? 'http://localhost:5173' : 'https://16bits-omniops.vercel.app'
}

function openBrowser(url) {
  const platform = os.platform()
  try {
    if (platform === 'win32') {
      exec(`start "" "${url}"`)
    } else if (platform === 'darwin') {
      exec(`open "${url}"`)
    } else {
      exec(`xdg-open "${url}"`)
    }
    return true
  } catch {
    return false
  }
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close()
      resolve(ans.trim())
    })
  })
}

function askPassword(query) {
  return new Promise((resolve) => {
    process.stdout.write(query)
    const stdin = process.stdin
    if (!stdin.isTTY) {
      const rl = readline.createInterface({ input: stdin, output: process.stdout })
      rl.question('', (ans) => {
        rl.close()
        resolve(ans.trim())
      })
      return
    }
    const prevRaw = stdin.isRaw
    if (stdin.setRawMode) stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf-8')
    let password = ''
    const onData = (ch) => {
      const char = ch.toString()
      if (char === '\n' || char === '\r' || char === '\u0004') {
        if (stdin.setRawMode) stdin.setRawMode(prevRaw)
        stdin.removeListener('data', onData)
        process.stdout.write('\n')
        resolve(password)
      } else if (char === '\u0003') {
        process.exit(1)
      } else if (char === '\u007f' || char === '\b') {
        if (password.length > 0) {
          password = password.slice(0, -1)
          process.stdout.write('\b \b')
        }
      } else {
        password += char
        process.stdout.write('*')
      }
    }
    stdin.on('data', onData)
  })
}

// ============================================================================
// Input & Network Utilities
// ============================================================================

async function readStdin() {
  if (process.stdin.isTTY) return ''
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    const timer = setTimeout(() => {
      try { process.stdin.pause() } catch {}
      resolve(data.trim())
    }, 400)
    process.stdin.on('data', chunk => { data += chunk })
    process.stdin.on('end', () => {
      clearTimeout(timer)
      try { process.stdin.pause() } catch {}
      resolve(data.trim())
    })
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

// ============================================================================
// Commands: Health, Doctor, Auth
// ============================================================================

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

async function loginCommand() {
  printBanner()
  console.log(`${c.bold}OmniOps Operator Authentication${c.reset}`)
  console.log(`${c.dim}Log in to bind this terminal to your private organization & team workspace.${c.reset}\n`)

  const storedToken = getStoredToken()
  if (storedToken) {
    const storedUser = getStoredUser()
    console.log(`${c.yellow}[INFO] Already authenticated as: ${storedUser?.name || 'Operator'} (${storedUser?.email || 'authenticated'})${c.reset}`)
    const reauth = await askQuestion(`Would you like to re-authenticate with a different account? (y/N): `)
    if (!reauth.match(/^y(es)?$/i)) {
      console.log(`${c.green}[OK] Preserving current session.${c.reset}\n`)
      return
    }
  }

  console.log(`${c.cyan}Options to authenticate:${c.reset}`)
  console.log(`  1. Enter email & password`)
  console.log(`  2. Paste your JWT Token (copied from web console)`)
  console.log(`  3. Open web console in browser to create an account\n`)

  const choice = await askQuestion(`Select option [1, 2, 3] (default: 1): `)

  if (choice === '3') {
    const webUrl = getWebAppBase()
    console.log(`\n${c.cyan}[INFO] Opening OmniOps Web Console in browser: ${webUrl}${c.reset}`)
    openBrowser(webUrl)
    console.log(`${c.dim}After signing up or signing in, copy your JWT token or return here to enter credentials.${c.reset}\n`)
    return
  }

  if (choice === '2') {
    const token = await askQuestion(`Paste your JWT token: `)
    if (!token) {
      console.log(`${c.red}[FAIL] No token provided.${c.reset}`)
      return
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        console.log(`${c.red}[FAIL] Invalid or expired token.${c.reset}`)
        return
      }
      const data = await res.json()
      writeConfig({
        token,
        user: data.user,
        apiUrl: API_BASE,
        savedAt: new Date().toISOString()
      })
      console.log(`\n${c.green}${c.bold}[OK] Authenticated successfully!${c.reset}`)
      console.log(`  ${c.dim}Operator:${c.reset}  ${data.user.name} (${data.user.email})`)
      console.log(`  ${c.dim}Role:${c.reset}      ${data.user.role}`)
      console.log(`  ${c.dim}Workspace:${c.reset} ${c.bold}${data.user.orgName || 'Private Team'}${c.reset} (org_id: ${data.user.orgId || 'private'})`)
      console.log(`  ${c.dim}Config:${c.reset}    Saved to ~/.omniops/config.json`)

      const claimed = await claimLocalIncidents(token)
      if (claimed > 0) {
        console.log(`  ${c.green}${c.bold}[OK] Claimed ${claimed} local incident(s) into your team workspace! Recorded in /audit.${c.reset}`)
      }
      console.log('')
    } catch (err) {
      console.log(`${c.red}[FAIL] Could not verify token with ${API_BASE}:${c.reset}`, err.message)
    }
    return
  }

  const email = await askQuestion(`Email: `)
  if (!email) {
    console.log(`${c.red}[FAIL] Email is required.${c.reset}`)
    return
  }
  const password = await askPassword(`Password: `)
  if (!password) {
    console.log(`${c.red}[FAIL] Password is required.${c.reset}`)
    return
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password })
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.log(`\n${c.red}[FAIL] Sign-in failed:${c.reset} ${err.error || `HTTP ${res.status}`}`)
      console.log(`${c.yellow}Tip: Need an account? Run 'omniops login' and select Option 3 to open the web console.${c.reset}\n`)
      return
    }

    const data = await res.json()
    writeConfig({
      token: data.token,
      user: data.user,
      apiUrl: API_BASE,
      savedAt: new Date().toISOString()
    })

    console.log(`\n${c.green}${c.bold}[OK] Terminal authenticated successfully!${c.reset}`)
    console.log(`  ${c.dim}Operator:${c.reset}  ${data.user.name} (${data.user.email})`)
    console.log(`  ${c.dim}Role:${c.reset}      ${data.user.role}`)
    console.log(`  ${c.dim}Workspace:${c.reset} ${c.bold}${data.user.orgName || 'Private Team'}${c.reset} (org_id: ${data.user.orgId || 'private'})`)
    console.log(`  ${c.dim}Config:${c.reset}    Saved to ~/.omniops/config.json`)

    const claimed = await claimLocalIncidents(data.token)
    if (claimed > 0) {
      console.log(`  ${c.green}${c.bold}[OK] Claimed ${claimed} local machine incident(s) into your team workspace! Recorded in /audit.${c.reset}`)
    }
    console.log(`\n${c.green}Your private team workspace is now active for all CLI operations.${c.reset}\n`)
  } catch (err) {
    console.log(`\n${c.red}[FAIL] Connection error:${c.reset}`, err.message)
  }
}

async function historyCommand() {
  printBanner()
  const history = readHistory()
  console.log(`${c.bold}Local Machine Incident History (${history.length} recorded):${c.reset}\n`)
  if (!history.length) {
    console.log(`  ${c.dim}No incidents triaged on this machine yet.${c.reset}\n`)
    return
  }
  history.forEach((h, i) => {
    const timeStr = new Date(h.timestamp).toLocaleString()
    console.log(`  ${c.cyan}${i + 1}. [${h.priority}]${c.reset} ${c.bold}${h.title}${c.reset}`)
    console.log(`     ${c.dim}ID:${c.reset} ${h.incidentId} ${c.dim}• Status: ${h.status} • ${timeStr}${c.reset}`)
  })
  console.log(`\n${c.dim}Run 'omniops claim' to allocate all machine incidents to your signed-in workspace.${c.reset}\n`)
}

async function claimCommand() {
  printBanner()
  const token = getStoredToken()
  if (!token) {
    console.log(`${c.yellow}[AUTH REQUIRED] Sign in first to claim incidents into your workspace:${c.reset}`)
    console.log(`  ${c.bold}omniops login${c.reset}\n`)
    return
  }
  const history = readHistory()
  console.log(`${c.bold}Allocating ${history.length} local machine incident(s) to your team workspace...${c.reset}`)
  const count = await claimLocalIncidents(token)
  if (count > 0) {
    console.log(`\n${c.green}${c.bold}[OK] Successfully allocated ${count} incident(s) to your private workspace!${c.reset}`)
    console.log(`${c.dim}All items are now permanently recorded in your team's /audit trail.${c.reset}\n`)
  } else {
    console.log(`\n${c.yellow}[INFO] All local incidents are already claimed or recorded.${c.reset}\n`)
  }
}

async function whoamiCommand() {
  printBanner()
  const token = getStoredToken()
  if (!token) {
    console.log(`${c.yellow}${c.bold}[STATUS] Not Signed In${c.reset}`)
    console.log(`  ${c.dim}Mode:${c.reset}      Shared Public Demo Sandbox`)
    console.log(`  ${c.dim}Workspace:${c.reset} org_id: demo`)
    console.log(`\n${c.cyan}To link this terminal to your private team workspace:${c.reset}`)
    console.log(`  ${c.bold}omniops login${c.reset}\n`)
    return
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) {
      console.log(`${c.red}[WARN] Stored token is invalid or expired.${c.reset}`)
      console.log(`${c.yellow}Run 'omniops login' to authenticate.${c.reset}\n`)
      return
    }
    const data = await res.json()
    console.log(`${c.green}${c.bold}[STATUS] Authenticated Operator${c.reset}`)
    console.log(`  ${c.dim}Operator:${c.reset}  ${data.user.name} (${data.user.email})`)
    console.log(`  ${c.dim}Role:${c.reset}      ${data.user.role}`)
    console.log(`  ${c.dim}Workspace:${c.reset} ${c.bold}${data.user.orgName || 'Private Team'}${c.reset} (${data.user.orgId})`)
    console.log(`  ${c.dim}Engine Link:${c.reset}${API_BASE}\n`)
  } catch (err) {
    console.log(`${c.red}[FAIL] Could not verify session:${c.reset}`, err.message)
  }
}

function logoutCommand() {
  clearConfig()
  console.log(`\n${c.green}[OK] Signed out successfully.${c.reset}`)
  console.log(`${c.dim}Saved credentials removed from ~/.omniops/config.json.${c.reset}`)
  console.log(`${c.dim}Terminal reverted to public demo sandbox mode.${c.reset}\n`)
}

// ============================================================================
// Markdown Renderer
// ============================================================================

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

// ============================================================================
// Core Incident Triage
// ============================================================================

async function triageIncident(query, priority = 'HIGH') {
  printBanner()
  
  const prioUpper = priority.toUpperCase()
  const prioBadge = prioUpper === 'CRITICAL'
    ? `${c.bgRed} CRITICAL ${c.reset}`
    : (prioUpper === 'HIGH' ? `${c.bgYellow} HIGH ${c.reset}` : `${c.bgCyan} ${prioUpper} ${c.reset}`)

  const token = getStoredToken()
  const storedUser = getStoredUser()

  console.log(`${c.bold}Initiating 4-Agent Swarm Triage...${c.reset}`)
  console.log(`${c.dim}Severity Target:${c.reset} ${prioBadge}`)
  if (token && storedUser?.orgName) {
    console.log(`${c.dim}Active Workspace:${c.reset} ${c.bold}${c.green}${storedUser.orgName}${c.reset} ${c.dim}(Private Team)${c.reset}`)
  } else {
    console.log(`${c.dim}Active Workspace:${c.reset} ${c.yellow}Public Demo Sandbox${c.reset} ${c.dim}(run 'omniops login' for private team)${c.reset}`)
  }
  console.log(`${c.dim}Incident Payload:${c.reset}\n"${query.slice(0, 160)}${query.length > 160 ? '...' : ''}"\n`)

  try {
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(`${API_BASE}/api/agents/execute`, {
      method: 'POST',
      headers,
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

    // Record incident to local machine history for workspace adoption
    recordLocalIncident({
      incidentId: result.incidentId,
      title: result.title || query.split('\n')[0].slice(0, 80),
      priority,
      status: result.status,
      timestamp: new Date().toISOString()
    })

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
    const workspaceDesc = token && storedUser?.orgName
      ? `${c.green}${storedUser.orgName} (Private Team)${c.reset}`
      : `${c.yellow}Public Demo Sandbox${c.reset} ${c.dim}(Run 'omniops login' for private team)${c.reset}`

    console.log(`\n${c.dim}┌── [Swarm Execution Summary] ──────────────────────────────────────────┐${c.reset}`)
    console.log(`${c.dim}│${c.reset}  ${c.bold}Status:${c.reset}          ${result.status === 'AWAITING_APPROVAL' ? c.bgYellow + ' [HALT: AWAITING OPERATOR APPROVAL] ' + c.reset : c.bgGreen + ' [OK: RESOLVED] ' + c.reset}`)
    console.log(`${c.dim}│${c.reset}  ${c.bold}Turnaround:${c.reset}      ${c.bold}${c.green}${result.executionDurationMs}ms${c.reset} ${c.dim}(Autonomous Sub-3s SLA)${c.reset}`)
    console.log(`${c.dim}│${c.reset}  ${c.bold}Workspace:${c.reset}       ${workspaceDesc}`)
    console.log(`${c.dim}│${c.reset}  ${c.bold}Incident ID:${c.reset}     ${c.cyan}${result.incidentId}${c.reset}`)

    if (result.langsmithTraceUrl) {
      console.log(`${c.dim}│${c.reset}  ${c.bold}LangSmith Trace:${c.reset} ${c.cyan}${result.langsmithTraceUrl}${c.reset}`)
    }
    console.log(`${c.dim}└───────────────────────────────────────────────────────────────────────┘${c.reset}`)

    if (result.status === 'AWAITING_APPROVAL') {
      console.log(`\n${c.yellow}${c.bold}--> To authorize and sign off this execution:${c.reset}`)
      console.log(`   ${c.bold}omniops approve ${result.incidentId}${c.reset}\n`)
    } else {
      console.log(`\n${c.bgGreen} [OK: REMEDIATION COMPLETED & COMMITTED TO DATABASE] ${c.reset}\n`)
    }
  } catch (err) {
    console.error(`\n${c.red}[FAIL] Swarm execution failed:${c.reset}`, err.message)
    console.log(`${c.yellow}Check if OmniOps Engine is running at ${API_BASE}.${c.reset}`)
  }
}

// ============================================================================
// Incident Approval with Instant Auth Guidance
// ============================================================================

async function approveIncident(incidentId) {
  printBanner()
  const webUrl = `${getWebAppBase()}/incidents/${incidentId}`

  let token = getStoredToken()

  // Case 1: User is not authenticated at all
  if (!token) {
    console.log(`${c.bgYellow}${c.bold} [OPERATOR AUTHORIZATION REQUIRED] ${c.reset}`)
    console.log(`${c.yellow}Incident ${c.bold}${incidentId}${c.reset}${c.yellow} is held behind the Human-in-the-Loop Security Gate.${c.reset}`)
    console.log(`${c.dim}You are currently NOT signed in as an authenticated Operator.${c.reset}\n`)

    console.log(`${c.bold}To authorize this plan in your private workspace:${c.reset}\n`)
    console.log(`  ${c.cyan}[Option 1] Review & Authorize in Web Browser (Interactive Console):${c.reset}`)
    console.log(`    ${c.bold}-> ${webUrl}${c.reset}\n`)
    console.log(`  ${c.cyan}[Option 2] Authenticate this terminal:${c.reset}`)
    console.log(`    ${c.bold}-> omniops login${c.reset}\n`)

    if (process.stdin.isTTY) {
      const choice = await askQuestion(`Open incident in your default browser now? [Y/n / type 'login']: `)
      if (choice.toLowerCase() === 'login') {
        await loginCommand()
        token = getStoredToken()
        if (!token) return
      } else if (!choice || choice.match(/^y(es)?$/i)) {
        console.log(`\n${c.green}[OK] Launching browser to:${c.reset} ${webUrl}`)
        openBrowser(webUrl)
        console.log(`${c.dim}Sign in on the web console and click "AUTHORIZE PLAN" to complete.${c.reset}\n`)
        return
      } else {
        console.log(`\n${c.yellow}Run 'omniops login' when you are ready to authenticate.${c.reset}\n`)
        return
      }
    } else {
      console.log(`${c.yellow}Visit ${webUrl} or run 'omniops login' to authorize.${c.reset}\n`)
      return
    }
  }

  // Case 2: Attempt approval with verified token
  try {
    const res = await fetch(`${API_BASE}/api/agents/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ incidentId })
    })

    if (res.status === 401) {
      console.log(`\n${c.bgYellow}${c.bold} [AUTH REQUIRED] SESSION EXPIRED OR INVALID ${c.reset}`)
      console.log(`${c.yellow}Your operator session token is invalid or expired.${c.reset}\n`)
      console.log(`  ${c.cyan}Option 1: Review & Authorize on Web Console:${c.reset}`)
      console.log(`    -> ${c.bold}${webUrl}${c.reset}\n`)
      console.log(`  ${c.cyan}Option 2: Re-authenticate this terminal:${c.reset}`)
      console.log(`    -> ${c.bold}omniops login${c.reset}\n`)

      if (process.stdin.isTTY) {
        const choice = await askQuestion(`Open incident in browser now? [Y/n]: `)
        if (!choice || choice.match(/^y(es)?$/i)) {
          console.log(`\n${c.green}[OK] Launching browser to:${c.reset} ${webUrl}\n`)
          openBrowser(webUrl)
        }
      }
      return
    }

    if (res.status === 404) {
      console.log(`\n${c.red}[FAIL] Incident not found:${c.reset} ${incidentId}`)
      console.log(`${c.dim}This incident either does not exist or belongs to another team's private workspace.${c.reset}\n`)
      return
    }

    if (res.status === 409) {
      const err = await res.json().catch(() => ({}))
      console.log(`\n${c.yellow}[INFO] ${err.error || 'Incident is no longer awaiting approval (already resolved).'}${c.reset}\n`)
      return
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }

    const data = await res.json()
    console.log(`\n${c.green}${c.bold}╔══════════════════════════════════════════════════════════════════════╗${c.reset}`)
    console.log(`${c.green}${c.bold}║  [OK] INCIDENT AUTHORIZED & RESOLVED SUCCESSFULLY                   ║${c.reset}`)
    console.log(`${c.green}${c.bold}╚══════════════════════════════════════════════════════════════════════╝${c.reset}`)
    console.log(`  ${c.dim}Incident ID:${c.reset}   ${c.cyan}${data.incident.id}${c.reset}`)
    console.log(`  ${c.dim}Updated Status:${c.reset}${c.green} ${data.incident.status} ${c.reset}`)
    if (data.authorizedBy) {
      console.log(`  ${c.dim}Authorized By:${c.reset} ${c.bold}${data.authorizedBy}${c.reset}`)
    }
    console.log(`  ${c.dim}Title:${c.reset}         ${data.incident.title}`)
    console.log(`  ${c.dim}Audit Trail:${c.reset}   ${c.dim}Cryptographic signature committed to team audit ledger.${c.reset}\n`)
  } catch (err) {
    console.error(`\n${c.red}[FAIL] Approval failed:${c.reset}`, err.message)
    console.log(`${c.yellow}You can also authorize this incident on the web console:${c.reset} ${webUrl}\n`)
  }
}

// ============================================================================
// Main Dispatcher
// ============================================================================

async function main() {
  await initApiBase()
  const [,, command, ...args] = process.argv
  const isPipeCandidate = !command || Boolean(command && command.match(/^(CRITICAL|HIGH|MEDIUM|LOW)$/i))
  const stdinData = isPipeCandidate ? await readStdin() : ''

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
    case 'login':
    case 'signin':
    case 'auth':
      await loginCommand()
      break

    case 'logout':
    case 'signout':
      logoutCommand()
      break

    case 'whoami':
    case 'user':
      await whoamiCommand()
      break

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

    case 'history':
    case 'incidents':
      await historyCommand()
      break

    case 'claim':
    case 'adopt':
    case 'sync':
      await claimCommand()
      break

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
      console.log(`  ${c.green}omniops triage "<error>"${c.reset}         Dispatch autonomous 4-agent swarm`)
      console.log(`  ${c.green}omniops approve <id>${c.reset}             Sign off on critical operator safety gate`)
      console.log(`  ${c.green}omniops history${c.reset}                  List recent incidents triaged on this machine`)
      console.log(`  ${c.green}omniops claim${c.reset}                    Allocate machine incidents to signed-in workspace`)
      console.log(`  ${c.green}omniops login${c.reset}                    Authenticate terminal to private team workspace`)
      console.log(`  ${c.green}omniops whoami${c.reset}                   Check current operator & active workspace`)
      console.log(`  ${c.green}omniops logout${c.reset}                   Disconnect session and revert to public sandbox`)
      console.log(`  ${c.green}omniops doctor${c.reset}                   Probe host health, memory, and listening ports`)
      console.log(`  ${c.green}omniops status${c.reset}                   Check cluster health and active runbooks`)
      console.log(`\n${c.bold}Pipe Stdin Support:${c.reset}`)
      console.log(`  ${c.cyan}cat /var/log/syslog | tail -n 20 | omniops${c.reset}`)
      console.log(`  ${c.cyan}docker logs container 2>&1 | omniops${c.reset}`)
      console.log(`\n${c.dim}Examples:${c.reset}`)
      console.log(`  omniops "Stripe 429 webhook throttle spike" CRITICAL`)
      console.log(`  omniops approve 58df486e-e5b4-4b16-a004-21257610a72f`)
      console.log(`  omniops login\n`)
      break
  }
}

main()
