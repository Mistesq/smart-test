import { describe, expect, it } from 'vitest'
import { loginSchema } from './loginSchema.ts'

function errorsOf(input: unknown) {
  const result = loginSchema.safeParse(input)
  return result.success ? {} : Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]))
}

describe('loginSchema', () => {
  it('accepts an email and a password', () => {
    expect(errorsOf({ email: 'admin@example.com', password: 'password123' })).toEqual({})
  })

  it('requires both fields', () => {
    expect(errorsOf({ email: '', password: '' })).toEqual({
      email: 'Email is required',
      password: 'Password is required',
    })
  })

  it('rejects a malformed email', () => {
    expect(errorsOf({ email: 'admin', password: 'x' })).toEqual({ email: 'Enter a valid email address' })
  })
})
