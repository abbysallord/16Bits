import { z } from 'zod'
import type { JsonSpec } from '../services/aiService.js'

// Verification Agent (safety gate) verdict.
// The JSON Schema goes to the model (strict mode: all properties required, no extras);
// zod re-checks the reply and trims it to safe sizes.
export const verifierVerdictZod = z.object({
  verdict: z.enum(['VERIFIED_SAFE', 'OPERATOR_AUTHORIZATION_REQUIRED']),
  risk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  requiresApproval: z.boolean(),
  slaAtRisk: z.boolean(),
  destructiveActions: z.array(z.string().max(200)).max(10),
  reasons: z.array(z.string().max(300)).min(1).max(5),
  summary: z.string().min(1).max(800)
})
export type VerifierVerdict = z.infer<typeof verifierVerdictZod>

export const verifierVerdictSpec: JsonSpec<VerifierVerdict> = {
  name: 'verifier_verdict',
  zod: verifierVerdictZod,
  schema: {
    type: 'object',
    properties: {
      verdict: { type: 'string', enum: ['VERIFIED_SAFE', 'OPERATOR_AUTHORIZATION_REQUIRED'] },
      risk: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      requiresApproval: { type: 'boolean', description: 'true if a human must approve before any action runs' },
      slaAtRisk: { type: 'boolean', description: 'true if the SLA resolution window may be breached' },
      destructiveActions: { type: 'array', items: { type: 'string' }, description: 'risky or destructive steps in the plan (restarts, deletes, failovers, scaling down); empty if none' },
      reasons: { type: 'array', items: { type: 'string' }, description: '1 to 5 short reasons for the verdict' },
      summary: { type: 'string', description: 'plain-English verdict for the operator, under 100 words' }
    },
    required: ['verdict', 'risk', 'requiresApproval', 'slaAtRisk', 'destructiveActions', 'reasons', 'summary'],
    additionalProperties: false
  }
}

// Runbook pick: which candidate fits the incident (0 = none)
export const runbookPickZod = z.object({
  choice: z.number().int().min(0).max(10),
  reason: z.string().max(300)
})
export type RunbookPick = z.infer<typeof runbookPickZod>

export const runbookPickSpec: JsonSpec<RunbookPick> = {
  name: 'runbook_pick',
  zod: runbookPickZod,
  schema: {
    type: 'object',
    properties: {
      choice: { type: 'integer', description: 'number of the matching runbook, or 0 if none apply' },
      reason: { type: 'string', description: 'one short sentence' }
    },
    required: ['choice', 'reason'],
    additionalProperties: false
  }
}
