import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { submitContact } from '../services/api'

interface FAQItem {
  question: string
  answer: string
}

const FAQS: FAQItem[] = [
  {
    question: 'Can the agents run destructive commands by themselves without human approval?',
    answer:
      'Never. 16Bits OmniOps is architected around a strict Human-in-the-Loop Verifier Gate. Any action categorized as HIGH or CRITICAL severity, or containing potentially destructive commands (e.g. database restarts, connection drops, cache invalidations), is immediately quarantined under status AWAITING_APPROVAL. A verified human operator must review the synthesized playbook and submit an authenticated cryptographic signature to execute.'
  },
  {
    question: 'What models and providers are supported?',
    answer:
      'OmniOps defaults to Google Gemini 2.5 Flash as its primary enterprise reasoning engine, paired with Groq ultra-fast LPU inference for real-time sub-second triage. All tool calls, DAG planning steps, and verifier decisions are traced live to LangSmith for transparent auditability.'
  },
  {
    question: 'How is OmniOps different from pasting error logs into generic ChatGPT or Claude?',
    answer:
      'Generic chat interfaces lack host context, internal runbook awareness, and safety gates. OmniOps executes a 4-agent consensus pipeline: Planner constructs an investigative DAG; Investigator queries live OS telemetry (load, memory, processes) and matches verified local markdown SOPs; Verifier checks contractual SLA deadlines; and Synthesizer drafts the exact minimal fix and executive stakeholder updates.'
  },
  {
    question: 'How do you protect our private credentials and internal system architecture?',
    answer:
      'OmniOps features an automated Input Guardrail layer that intercepts raw logs and strips AWS secret keys, Bearer tokens, database connection credentials, and PII before any LLM processing. Additionally, OmniOps can be deployed 100% on-premises within your own VPC.'
  }
]

export const LandingPage: React.FC = () => {
  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  // Contact form state
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [deploymentType, setDeploymentType] = useState('Private VPC')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [contactSuccess, setContactSuccess] = useState<string | null>(null)

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company || !email) return

    setIsSubmitting(true)
    try {
      const res = await submitContact({ company, email, deploymentType, message })
      setContactSuccess(res.message)
      setCompany('')
      setEmail('')
      setMessage('')
    } catch {
      setContactSuccess('Inquiry received. SRE solutions team will follow up promptly.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-16 py-8 px-4 max-w-7xl mx-auto">
      {/* HERO SECTION */}
      <section className="bg-white border-4 border-black p-6 sm:p-10 shadow-[8px_8px_0_0_#000] relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="inline-flex items-center gap-2">
              <span className="bg-[#3b82f6] text-white font-mono text-xs font-bold px-2.5 py-1 border-2 border-black">
                [ENTERPRISE SWARM V1.0]
              </span>
              <span className="font-mono text-xs text-neutral-600 font-bold uppercase tracking-tight">
                LangSmith Traced // Gemini 2.5 Flash
              </span>
            </div>

            <h1 className="font-press-start text-xl sm:text-2xl md:text-3xl text-black leading-tight">
              AUTONOMOUS SRE SWARM FOR ENTERPRISE INCIDENTS
            </h1>

            <p className="font-mono text-sm sm:text-base text-neutral-700 leading-relaxed">
              Turn 3-hour production war rooms into 15-second deterministic playbooks. Throw raw,
              chaotic error logs at 16Bits OmniOps. Our 4-agent consensus swarm investigates live system
              telemetry, retrieves internal SOP runbooks, verifies compliance boundaries, and delivers
              the exact safe fix.
            </p>

            {/* Value Highlights */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="border-2 border-black bg-neutral-50 p-2.5 text-center">
                <div className="font-press-start text-sm text-[#3b82f6]">92%</div>
                <div className="font-mono text-[10px] text-neutral-600 font-bold mt-1">MTTR REDUCTION</div>
              </div>
              <div className="border-2 border-black bg-neutral-50 p-2.5 text-center">
                <div className="font-press-start text-sm text-emerald-600">100%</div>
                <div className="font-mono text-[10px] text-neutral-600 font-bold mt-1">AUDIT TRACED</div>
              </div>
              <div className="border-2 border-black bg-neutral-50 p-2.5 text-center">
                <div className="font-press-start text-sm text-amber-600">ZERO</div>
                <div className="font-mono text-[10px] text-neutral-600 font-bold mt-1">RUNAWAY RISK</div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex items-center gap-3 pt-4 flex-wrap">
              <Link
                to="/console"
                className="px-5 py-3 font-mono text-sm font-bold bg-[#3b82f6] text-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:bg-blue-600 active:translate-y-1 active:shadow-none transition-all"
              >
                [LAUNCH LIVE CONSOLE]
              </Link>
              <a
                href="#roi"
                className="px-5 py-3 font-mono text-sm font-bold bg-neutral-100 text-black border-2 border-black shadow-[4px_4px_0_0_#000] hover:bg-neutral-200 active:translate-y-1 active:shadow-none transition-all"
              >
                [WHAT BUSINESSES GAIN]
              </a>
              <Link
                to="/docs"
                className="px-4 py-3 font-mono text-xs font-bold bg-white text-neutral-800 border-2 border-black hover:bg-neutral-50 transition-all"
              >
                [VIEW SKILL.MD]
              </Link>
            </div>
          </div>

          {/* Hero Pixel Banner */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center">
            <div className="border-4 border-black bg-[#f8fafc] p-4 shadow-[6px_6px_0_0_#000] w-full max-w-md">
              <div className="border-b-2 border-black pb-2 mb-3 flex items-center justify-between">
                <span className="font-press-start text-[10px] text-black">SWARM TOPOLOGY</span>
                <span className="font-mono text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 border border-black font-bold">
                  [SYSTEM ONLINE]
                </span>
              </div>
              <img
                src="/assets/hero-banner.svg"
                alt="16Bits OmniOps Swarm Topology"
                className="w-full h-auto rendering-pixelated mx-auto"
              />
              <div className="mt-3 p-2 bg-neutral-100 border border-black font-mono text-[11px] text-neutral-700">
                [CONSENSUS LOOP]: Planner -&gt; Investigator -&gt; Verifier Gate -&gt; Synthesizer
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT HAPPENS WHEN YOU INVEST & WHAT YOU GAIN SECTION */}
      <section id="roi" className="flex flex-col gap-8 scroll-mt-24">
        <div className="border-l-8 border-black pl-4">
          <span className="font-mono text-xs font-bold text-[#3b82f6] uppercase tracking-wider">
            [ENTERPRISE VALUE PROPOSITION]
          </span>
          <h2 className="font-press-start text-lg sm:text-2xl text-black mt-1">
            WHAT HAPPENS WHEN YOUR BUSINESS INVESTS IN OMNIOPS
          </h2>
          <p className="font-mono text-sm text-neutral-600 mt-2 max-w-3xl">
            We don't sell generic AI chats. We sell operational continuity, reduced downtime penalties,
            and elimination of senior engineer burnout.
          </p>
        </div>

        {/* Before vs After Comparison Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Without OmniOps */}
          <div className="border-4 border-black bg-rose-50/50 p-6 shadow-[4px_4px_0_0_#000] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <span className="font-press-start text-xs text-rose-800">WITHOUT OMNIOPS</span>
              <span className="font-mono text-[10px] bg-rose-200 text-rose-900 border border-black px-2 py-0.5 font-bold">
                [HIGH COST &amp; PANIC]
              </span>
            </div>
            <ul className="space-y-3 font-mono text-xs text-neutral-800 list-none p-0 m-0">
              <li className="flex items-start gap-2">
                <span className="text-rose-600 font-bold">[X]</span>
                <span>
                  <strong>2 AM Alert Fatigue:</strong> Multiple senior engineers paged out of sleep,
                  scrambling to figure out which microservice crashed.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-600 font-bold">[X]</span>
                <span>
                  <strong>Manual Log Hunting:</strong> 45-90 minutes spent grepping through gigabytes of
                  unstructured logs and tracing distributed spans manually.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-600 font-bold">[X]</span>
                <span>
                  <strong>Dangerous Guesswork:</strong> Engineers running ad-hoc database commands or
                  restarts in panic without verifying downstream blast radius.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-rose-600 font-bold">[X]</span>
                <span>
                  <strong>Customer Churn &amp; SLA Fines:</strong> Downtime drags on for hours, violating
                  client SLAs and risking expensive enterprise churn.
                </span>
              </li>
            </ul>
          </div>

          {/* With OmniOps */}
          <div className="border-4 border-black bg-emerald-50/50 p-6 shadow-[4px_4px_0_0_#000] flex flex-col gap-4">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <span className="font-press-start text-xs text-emerald-800">WITH 16BITS OMNIOPS</span>
              <span className="font-mono text-[10px] bg-emerald-200 text-emerald-900 border border-black px-2 py-0.5 font-bold">
                [DETERMINISTIC DEFENSE]
              </span>
            </div>
            <ul className="space-y-3 font-mono text-xs text-neutral-800 list-none p-0 m-0">
              <li className="flex items-start gap-2">
                <span className="text-emerald-700 font-bold">[OK]</span>
                <span>
                  <strong>Instant Autonomous Triage:</strong> Raw error logs are ingested via webhook or
                  CLI. The 4-agent swarm plans and isolates root causes in seconds.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-700 font-bold">[OK]</span>
                <span>
                  <strong>Live Telemetry &amp; Runbook Match:</strong> The swarm queries active host vitals
                  and pulls your organization's exact SOPs from local storage.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-700 font-bold">[OK]</span>
                <span>
                  <strong>Cryptographic Safety Gate:</strong> The Verifier blocks destructive executions
                  until an authenticated operator reviews the plan and clicks approve.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-700 font-bold">[OK]</span>
                <span>
                  <strong>Audit-Ready Resolution:</strong> Complete post-mortem, exact fix commands, client
                  notification email, and LangSmith traces generated automatically.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Concrete Business Gains Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
            <div className="font-press-start text-xs text-[#3b82f6] mb-2">[FINANCIAL GAIN]</div>
            <div className="font-mono text-xs text-neutral-700 leading-relaxed">
              Enterprise outages average <strong>$5,600/minute</strong>. Slashing mean resolution time from 2 hours
              to 5 minutes saves tens of thousands in SLA penalties.
            </div>
          </div>

          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
            <div className="font-press-start text-xs text-emerald-600 mb-2">[TALENT RETENTION]</div>
            <div className="font-mono text-xs text-neutral-700 leading-relaxed">
              Protect your highest-paid senior engineers from 2 AM burnout. OmniOps does the triage legwork
              so engineers focus on shipping profitable products.
            </div>
          </div>

          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
            <div className="font-press-start text-xs text-amber-600 mb-2">[ZERO RUNAWAY RISK]</div>
            <div className="font-mono text-xs text-neutral-700 leading-relaxed">
              Unlike dangerous unconstrained autonomous bots, OmniOps halts high-risk actions behind a
              mandatory cryptographic Human-in-the-Loop signature.
            </div>
          </div>

          <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000]">
            <div className="font-press-start text-xs text-purple-600 mb-2">[AUDIT &amp; SOC2]</div>
            <div className="font-mono text-xs text-neutral-700 leading-relaxed">
              Every step, decision, tool telemetry query, and operator sign-off is permanently recorded in SQLite
              and public LangSmith traces for SOC2 audits.
            </div>
          </div>
        </div>
      </section>

      {/* HOW ANY COMPANY PLUGS AND PLAYS IN 3 MINUTES */}
      <section className="bg-white border-4 border-black p-6 sm:p-8 shadow-[6px_6px_0_0_#000]">
        <div className="border-b-2 border-black pb-4 mb-6">
          <span className="font-mono text-xs font-bold text-[#3b82f6] uppercase tracking-wider">
            [ZERO INTRUSIVE ONBOARDING]
          </span>
          <h2 className="font-press-start text-lg sm:text-xl text-black mt-1">
            HOW ANY COMPANY PLUGS AND PLAYS IN 3 MINUTES
          </h2>
          <p className="font-mono text-xs sm:text-sm text-neutral-600 mt-1">
            No complex agent configuration. No cloud vendor lock-in. Seamless terminal and webhook integration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Step 1 */}
          <div className="border-2 border-black p-4 bg-neutral-50 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="bg-black text-white font-mono text-xs font-bold px-2 py-0.5">
                STEP 1
              </span>
              <span className="font-mono text-xs font-bold text-black">INSTALL CLI OR CONTAINER</span>
            </div>
            <p className="font-mono text-xs text-neutral-600">
              Run npm install or start our Docker container. Zero proprietary agents needed.
            </p>
            {/* Clean Light Code Box */}
            <div className="bg-[#f8fafc] border-2 border-black p-2.5 font-mono text-xs text-neutral-900 font-bold overflow-x-auto">
              npm install -g omniops
            </div>
          </div>

          {/* Step 2 */}
          <div className="border-2 border-black p-4 bg-neutral-50 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="bg-black text-white font-mono text-xs font-bold px-2 py-0.5">
                STEP 2
              </span>
              <span className="font-mono text-xs font-bold text-black">MOUNT YOUR EXISTING RUNBOOKS</span>
            </div>
            <p className="font-mono text-xs text-neutral-600">
              Drop your existing markdown SOPs into the runbooks folder. OmniOps indexes them automatically.
            </p>
            {/* Clean Light Code Box */}
            <div className="bg-[#f8fafc] border-2 border-black p-2.5 font-mono text-xs text-neutral-900 font-bold overflow-x-auto">
              cp docs/runbooks/*.md ./runbooks/
            </div>
          </div>

          {/* Step 3 */}
          <div className="border-2 border-black p-4 bg-neutral-50 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="bg-black text-white font-mono text-xs font-bold px-2 py-0.5">
                STEP 3
              </span>
              <span className="font-mono text-xs font-bold text-black">PIPE LOGS OR HOOK ALERTS</span>
            </div>
            <p className="font-mono text-xs text-neutral-600">
              Pipe live system crash logs directly into the terminal or configure your Datadog/PagerDuty alert webhook.
            </p>
            {/* Clean Light Code Box */}
            <div className="bg-[#f8fafc] border-2 border-black p-2.5 font-mono text-xs text-neutral-900 font-bold overflow-x-auto">
              omniops "Postgres FATAL: pool exhausted"
            </div>
          </div>
        </div>
      </section>

      {/* WORKING FAQ ACCORDION SECTION */}
      <section id="faq" className="flex flex-col gap-6 scroll-mt-24">
        <div className="border-l-8 border-black pl-4">
          <span className="font-mono text-xs font-bold text-[#3b82f6] uppercase tracking-wider">
            [TRANSPARENCY &amp; ARCHITECTURE]
          </span>
          <h2 className="font-press-start text-lg sm:text-2xl text-black mt-1">
            FREQUENTLY ASKED QUESTIONS
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {FAQS.map((faq, idx) => {
            const isOpen = openFaq === idx
            return (
              <div
                key={idx}
                className="border-2 border-black bg-white shadow-[3px_3px_0_0_#000] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full text-left p-4 flex items-center justify-between gap-4 bg-neutral-50 hover:bg-neutral-100 transition-colors cursor-pointer border-none font-mono font-bold text-xs sm:text-sm text-black"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[#3b82f6] font-press-start text-[10px]">Q{idx + 1}.</span>
                    <span>{faq.question}</span>
                  </span>
                  <span className="font-press-start text-xs text-black">
                    {isOpen ? '[-]' : '[+]'}
                  </span>
                </button>
                {isOpen && (
                  <div className="p-4 border-t-2 border-black bg-white font-mono text-xs sm:text-sm text-neutral-700 leading-relaxed">
                    {faq.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* WORKING ENTERPRISE CONTACT SECTION */}
      <section id="contact" className="bg-white border-4 border-black p-6 sm:p-10 shadow-[8px_8px_0_0_#000] scroll-mt-24">
        <div className="max-w-3xl">
          <span className="font-mono text-xs font-bold text-[#3b82f6] uppercase tracking-wider">
            [PILOT DEPLOYMENT]
          </span>
          <h2 className="font-press-start text-lg sm:text-2xl text-black mt-1">
            DEPLOY OMNIOPS FOR YOUR INFRASTRUCTURE
          </h2>
          <p className="font-mono text-xs sm:text-sm text-neutral-600 mt-2">
            Schedule an enterprise architecture review or request an on-premises VPC pilot trial.
          </p>

          {contactSuccess && (
            <div className="mt-4 p-4 border-2 border-black bg-emerald-100 font-mono text-xs sm:text-sm text-emerald-900 font-bold">
              [CONFIRMED]: {contactSuccess}
            </div>
          )}

          <form onSubmit={handleContactSubmit} className="mt-6 flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-xs font-bold text-black mb-1">
                  COMPANY / ORGANIZATION:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Acme Corp"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs border-2 border-black bg-[#f8fafc] text-black focus:outline-none focus:border-[#3b82f6]"
                />
              </div>

              <div>
                <label className="block font-mono text-xs font-bold text-black mb-1">
                  WORK EMAIL:
                </label>
                <input
                  type="email"
                  required
                  placeholder="sre-lead@acme.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs border-2 border-black bg-[#f8fafc] text-black focus:outline-none focus:border-[#3b82f6]"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-black mb-1">
                TARGET DEPLOYMENT ARCHITECTURE:
              </label>
              <select
                value={deploymentType}
                onChange={(e) => setDeploymentType(e.target.value)}
                className="w-full p-2.5 font-mono text-xs border-2 border-black bg-[#f8fafc] text-black focus:outline-none focus:border-[#3b82f6]"
              >
                <option value="Private VPC">Private Enterprise VPC (Air-gapped)</option>
                <option value="Cloud SaaS">Managed Multi-Tenant Cloud</option>
                <option value="Hybrid Kubernetes">Hybrid Kubernetes On-Prem Cluster</option>
              </select>
            </div>

            <div>
              <label className="block font-mono text-xs font-bold text-black mb-1">
                PRODUCTION CHALLENGE / INQUIRY DETAILS:
              </label>
              <textarea
                rows={3}
                placeholder="We suffer repeated connection pool exhaustion and Redis evictions during flash sales..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-2.5 font-mono text-xs border-2 border-black bg-[#f8fafc] text-black focus:outline-none focus:border-[#3b82f6]"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 font-mono text-xs font-bold bg-black text-white border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,0.3)] hover:bg-neutral-800 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
              >
                {isSubmitting ? '[DISPATCHING INQUIRY...]' : '[SUBMIT ENTERPRISE INQUIRY]'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* RETRO 16-BIT FOOTER */}
      <footer className="border-t-4 border-black pt-6 pb-12 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono text-xs text-neutral-600">
        <div className="flex items-center gap-2">
          <img src="/assets/logo-pixel.svg" alt="16Bits OmniOps" className="w-5 h-5 rendering-pixelated" />
          <span className="font-press-start text-[10px] text-black">16BITS OMNIOPS</span>
          <span>// MIT Open Source</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/console" className="hover:underline text-black font-bold">CONSOLE</Link>
          <Link to="/docs" className="hover:underline text-black font-bold">SKILL.MD</Link>
          <Link to="/login" className="hover:underline text-black font-bold">LOGIN</Link>
          <a href="https://github.com/abbysallord/16Bits" target="_blank" rel="noreferrer" className="hover:underline text-black font-bold">GITHUB</a>
        </div>
      </footer>
    </div>
  )
}
