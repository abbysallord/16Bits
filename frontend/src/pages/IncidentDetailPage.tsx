import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchIncidentDetails, approveIncident, getCurrentUser } from '../services/api'
import type { Incident, AgentStepLog, User } from '../services/api'

export const IncidentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [logs, setLogs] = useState<AgentStepLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isApproving, setIsApproving] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  useEffect(() => {
    setCurrentUser(getCurrentUser())
    if (id) {
      loadIncident(id)
    }
  }, [id])

  const loadIncident = async (incidentId: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchIncidentDetails(incidentId)
      setIncident(data.incident)
      setLogs(data.logs || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load incident')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!id) return
    setIsApproving(true)
    try {
      const operatorName = currentUser
        ? `${currentUser.name} (${currentUser.email})`
        : 'Lead Operator'
      await approveIncident(id, operatorName)
      await loadIncident(id)
    } catch (err: any) {
      alert(`Approval error: ${err.message}`)
    } finally {
      setIsApproving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center font-mono text-xs">
        [FETCHING INCIDENT TELEMETRY RECORD...]
      </div>
    )
  }

  if (error || !incident) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4">
        <div className="bg-rose-100 border-4 border-black p-6 shadow-[6px_6px_0_0_#000] font-mono text-xs">
          <div className="font-bold text-rose-900 mb-2">[ERROR]: {error || 'Incident not found'}</div>
          <Link to="/console" className="font-bold text-black hover:underline">
            &larr; Return to Console
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 flex flex-col gap-6">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between border-b-2 border-black pb-3">
        <div className="flex items-center gap-2 font-mono text-xs">
          <Link to="/console" className="text-neutral-600 hover:text-black">
            CONSOLE
          </Link>
          <span className="text-neutral-400">/</span>
          <span className="font-bold text-black">INCIDENT {incident.id.slice(0, 8)}...</span>
        </div>

        <Link
          to="/console"
          className="font-mono text-xs font-bold px-3 py-1 border-2 border-black bg-neutral-100 hover:bg-neutral-200"
        >
          &larr; ALL INCIDENTS
        </Link>
      </div>

      {/* Incident Header Card */}
      <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000] flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b-2 border-black pb-3">
          <span
            className={`font-mono text-xs font-bold px-2 py-1 border border-black ${
              incident.priority === 'CRITICAL'
                ? 'bg-rose-100 text-rose-900'
                : incident.priority === 'HIGH'
                ? 'bg-amber-100 text-amber-900'
                : 'bg-blue-100 text-blue-900'
            }`}
          >
            [{incident.priority} PRIORITY]
          </span>

          <span
            className={`font-mono text-xs font-bold px-3 py-1 border-2 border-black ${
              incident.status === 'RESOLVED'
                ? 'bg-emerald-200 text-emerald-900'
                : incident.status === 'AWAITING_APPROVAL'
                ? 'bg-amber-200 text-amber-900'
                : 'bg-blue-200 text-blue-900'
            }`}
          >
            STATUS: {incident.status}
          </span>
        </div>

        <h1 className="font-press-start text-sm sm:text-lg text-black leading-snug">
          {incident.title}
        </h1>

        <div className="bg-[#f8fafc] border-2 border-black p-3 font-mono text-xs text-neutral-800">
          <div className="text-[10px] text-neutral-500 font-bold mb-1">[RAW INCIDENT DESCRIPTION]:</div>
          {incident.description}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-[11px] text-neutral-600 pt-2 border-t border-neutral-200">
          <div>
            <span className="font-bold text-black">CATEGORY:</span> {incident.category}
          </div>
          <div>
            <span className="font-bold text-black">RECORD ID:</span> {incident.id.slice(0, 8)}...
          </div>
          <div>
            <span className="font-bold text-black">CREATED:</span> {new Date(incident.created_at).toLocaleTimeString()}
          </div>
          <div>
            <span className="font-bold text-black">UPDATED:</span> {new Date(incident.updated_at).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Human Approval Required Banner if AWAITING_APPROVAL */}
      {incident.status === 'AWAITING_APPROVAL' && (
        <div className="bg-amber-50 border-4 border-black p-6 shadow-[6px_6px_0_0_#000] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col gap-1 font-mono text-xs">
            <span className="font-press-start text-xs text-amber-900">
              SAFETY GATE ACTIVE: APPROVAL REQUIRED
            </span>
            <span className="text-neutral-700">
              The verifier gate quarantined high-risk commands. Authorize execution below.
            </span>
          </div>

          <button
            type="button"
            disabled={isApproving}
            onClick={handleApprove}
            className="px-6 py-3 font-mono text-xs font-bold bg-emerald-400 text-black border-2 border-black shadow-[3px_3px_0_0_#000] hover:bg-emerald-300 active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
          >
            {isApproving ? '[AUTHORIZING...]' : '[AUTHORIZE REMEDIATION]'}
          </button>
        </div>
      )}

      {/* Synthesized Resolution Playbook */}
      {incident.resolution && (
        <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000] flex flex-col gap-3">
          <div className="border-b-2 border-black pb-2 flex items-center justify-between">
            <span className="font-press-start text-xs text-black">SYNTHESIZED PLAYBOOK &amp; POST-MORTEM</span>
          </div>
          {/* Light-themed box */}
          <div className="bg-[#f8fafc] border-2 border-black p-4 font-mono text-xs text-neutral-900 whitespace-pre-wrap leading-relaxed">
            {incident.resolution}
          </div>
        </div>
      )}

      {/* 4-Agent Execution Log Trajectory */}
      <div className="bg-white border-4 border-black p-6 shadow-[6px_6px_0_0_#000] flex flex-col gap-4">
        <div className="border-b-2 border-black pb-2">
          <span className="font-press-start text-xs text-black">AGENT CONSENSUS TRAJECTORY</span>
        </div>

        <div className="flex flex-col gap-3 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="text-neutral-500 py-4">[No intermediate step logs recorded for this incident]</div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className="border-2 border-black p-3 bg-[#f8fafc]">
                <div className="flex items-center justify-between border-b border-neutral-300 pb-1 mb-2">
                  <span className="font-bold text-black flex items-center gap-2">
                    <span className="bg-black text-white px-1.5 py-0.5 text-[10px]">
                      STEP {log.stepNumber}
                    </span>
                    <span className="text-[#3b82f6]">{log.agentName}</span>
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-neutral-800 mb-1">{log.thought}</div>
                <div className="font-bold text-[11px] text-neutral-900">
                  &gt; Action: {log.action}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
