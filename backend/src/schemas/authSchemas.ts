import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  // Create a new team (teamName) or join an existing one with its invite code
  teamName: z.string().max(80).optional(),
  inviteCode: z.string().max(40).optional()
})

export const loginSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(1, 'Password is required')
})

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address format'),
  code: z.string().min(6, 'Enter the reset code').max(40),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(200)
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(200)
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
