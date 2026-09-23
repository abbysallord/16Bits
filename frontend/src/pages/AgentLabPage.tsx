import { useState } from 'react'
import { Sparkles, Search, ShieldCheck, Activity, FlaskConical, Ban, CheckCircle2 } from 'lucide-react'
import { Shell } from '../components/Shell'

/** Agent Lab: inspect the 4-agent DAG, tweak policy knobs, dry-run the verifier. */

const AGENTS = [
  {
    stage: 1,
    name: 'PLANNER',
    desc: 'Decomposes the alert into an investigation execution DAG and telemetry probes.',
    color: 'var(--accent)',
    icon: Sparkles,
    outputs: ['Investigation plan', 'Diagnostic probes'],
    model: 'gemini-2.0-flash',
    knobs: ['max subtasks', 'probe depth'],
  },
  {
    stage: 2,
    name: 'INVESTIGATOR',
    desc: 'Queries live host telemetry, inspects SOP runbooks, checks customer SLAs.',
    color: 'var(--purple)',
    icon: Search,
    outputs: ['Telemetry snapshot', 'Matched runbook'],
    model: 'gemini-2.0-flash',
    knobs: ['telemetry sources', 'SLA tier map'],
  },
  {
    stage: 3,
    name: 'VERIFIER',
    desc: 'Audits every proposed action against safety constraints; blocks destructive commands.',
    color: 'var(--warning)',
    icon: ShieldCheck,
    outputs: ['Safety verdict', 'Approval gate'],
    model: 'deterministic (no LLM)',
    knobs: ['destructive patterns', 'approval threshold'],
  },
  {
    stage: 4,
    name: 'SYNTHESIZER',
    desc: 'Compiles the remediation playbook, rollback plan, and stakeholder comms.',
    color: 'var(--success)',
    icon: Activity,
    outputs: ['Playbook', 'Slack broadcast'],
    model: 'gemini-2.0-flash',
    knobs: ['playbook template', 'comms channels'],
  },
] as const

const GUARDRAILS = [
  { pattern: 'rm -rf', note: 'Recursive force delete — unconditional block' },
  { pattern: 'DROP DATABASE / DROP TABLE', note: 'SQL destruction — unconditional block' },
  { pattern: 'FLUSHALL / FLUSHDB', note: 'Cache wipe — unconditional block' },
  { pattern: 'kubectl delete ns', note: 'Namespace teardown — approval gate' },
  { pattern: 'scale / restart / rotate', note: 'State mutation — operator sign-off required' },
]

// Deterministic client-side dry-run of the verifier's pattern screen (demo only —
// the authoritative gate lives in backend/src/services/verifierService.ts).
const BLOCKED = ['rm -rf', 'drop database', 'drop table', 'flushall', 'flushdb']
const GATED = ['kubectl delete', 'scale', 'restart', 'rotate']

type Verdict = 'PASS' | 'BLOCK' | 'GATE' | null

function classify(cmd: string): { verdict: Exclude<Verdict, null>; reason: string } {
  const c = cmd.toLowerCase()
  if (BLOCKED.some((b) => c.includes(b))) {
    return { verdict: 'BLOCK', reason: 'Matched destructive command pattern. Rejected unconditionally per policy CP-7.' }
  }
  const gate = GATED.find((g) => c.includes(g))
  if (gate) {
    return { verdict: 'GATE', reason: `Touches production state ("${gate}"). Halted in AWAITING_APPROVAL pending operator sign-off.` }
  }
  return { verdict: 'PASS', reason: 'No destructive patterns matched. Reversible, low-risk action — cleared for autonomous execution.' }
}

function VerifierDryRun() {
  const [cmd, setCmd] = useState('kubectl scale deployment checkout --replicas=8')
  const [submitted, setSubmitted] = useState<string | null>(null)

  const run = () => setSubmitted(cmd.trim())

  const result: { verdict: Exclude<Verdict, null>; reason: string } | null = submitted
    ? classify(submitted)
    : null

  const verdictStyle =
    result?.verdict === 'BLOCK'
      ? { border: 'var(--danger)', bg: 'var(--danger-soft)', label: 'BLOCKED', icon: Ban, color: 'var(--danger)' }
      : result?.verdict === 'GATE'
        ? { border: 'var(--warning)', bg: 'var(--warning-soft)', label: 'APPROVAL GATE', icon: ShieldCheck, color: 'var(--warning)' }
        : { border: 'var(--success)', bg: 'var(--success-soft)', label: 'PASSED', icon: CheckCircle2, color: 'var(--success)' }

  return (
    <div className="panel">
      <p className="panel-title font-display">
        <FlaskConical size={11} className="inline mr-1 -mt-0.5" />
        Verifier Dry-Run
      </p>

      <p className="font-code mb-3" style={{ fontSize: 10, color: 'var(--ink-dim)' }}>
        Type a remediation command and screen it against the Verifier's safety patterns (client-side demo
        of the deterministic gate).
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          className="input flex-1"
          style={{ fontSize: 11 }}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          placeholder="e.g. kubectl rollout restart deployment/api"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              run()
            }
          }}
        />
        <button type="button" className="btn btn-primary font-display btn-sm" style={{ fontSize: 8 }} onClick={run}>
          SCREEN →
        </button>
      </div>

      {result && (
        <div
          className="p-3 font-code"
          style={{ border: `2px solid ${verdictStyle.border}`, backgroundColor: verdictStyle.bg, fontSize: 10 }}
          role="status"
        >
          <div className="font-display" style={{ fontSize: 9, color: verdictStyle.color, marginBottom: 4 }}>
            <verdictStyle.icon size={11} className="inline mr-1 -mt-0.5" />
            VERDICT: {verdictStyle.label}
          </div>
          <div style={{ color: 'var(--ink)' }}>{result.reason}</div>
        </div>
      )}

      <hr className="rule" />
      <div className="font-code flex flex-wrap gap-1.5">
        {GUARDRAILS.map((g) => (
          <button
            key={g.pattern}
            type="button"
            className="btn btn-xs font-code"
            style={{ fontSize: 8 }}
            onClick={() => setCmd(g.pattern)}
            title={g.note}
          >
            {g.pattern}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AgentLabPage() {
  return (
    <Shell>
      <section className="max-w-6xl w-full mx-auto px-4 pt-8 pb-12 flex-1">
        <p className="font-display" style={{ fontSize: 9, color: 'var(--ink-faint)', marginBottom: 8 }}>
          {'> AGENT CONFIGURATION & SAFETY LAB'}
          <span className="blink">_</span>
        </p>
        <h1 className="font-display mb-2" style={{ fontSize: 'clamp(14px, 2.5vw, 20px)' }}>
          AGENT LAB
        </h1>
        <p className="font-code mb-6" style={{ fontSize: 11, color: 'var(--ink-dim)', maxWidth: 720 }}>
          Inspect each agent in the consensus DAG, its outputs and model binding, then dry-run the
          Verifier's destructive-command screen before touching the real swarm.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          {AGENTS.map((a) => {
            const Icon = a.icon
            return (
              <div key={a.stage} className="panel">
                <p className="panel-title font-display" style={{ color: a.color }}>
                  STAGE {a.stage} · {a.name}
                </p>
                <div className="flex items-start gap-3">
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{
                      width: 52,
                      height: 52,
                      backgroundColor: 'var(--ink)',
                      color: a.color,
                      border: '3px solid var(--border)',
                    }}
                  >
                    <Icon size={24} />
                  </div>
                  <div>
                    <p style={{ fontSize: 13, lineHeight: 1.5 }}>{a.desc}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {a.outputs.map((o) => (
                        <span key={o} className="badge badge-accent" style={{ fontSize: 8 }}>
                          {o}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <hr className="rule" />
                <div className="font-code space-y-1" style={{ fontSize: 10, color: 'var(--ink-dim)' }}>
                  <div>
                    MODEL: <span style={{ color: 'var(--ink)' }}>{a.model}</span>
                  </div>
                  <div>
                    KNOBS: <span style={{ color: 'var(--ink)' }}>{a.knobs.join(' · ')}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <VerifierDryRun />
      </section>
    </Shell>
  )
}
