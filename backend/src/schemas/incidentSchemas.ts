import { z } from 'zod'

export const createIncidentSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH'),
  category: z.string().default('System Incident')
})

export const runAgentSchema = z.object({
  incidentId: z.string().optional(),
  title: z.string().min(3),
  description: z.string().min(5),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('HIGH'),
  category: z.string().default('Enterprise Workflow')
})

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>
export type RunAgentInput = z.infer<typeof runAgentSchema>
