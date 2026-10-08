import { z } from 'zod'

export const loginSchema = z.object({
  email: z.email({ error: (issue) => (issue.input === '' ? 'Email is required' : 'Enter a valid email address') }),
  password: z.string().min(1, { error: 'Password is required' }),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const LOGIN_FIELDS = ['email', 'password'] as const satisfies readonly (keyof LoginFormValues)[]
