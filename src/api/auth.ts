import { z } from 'zod'
import { getFingerprint } from './fingerprint.ts'
import { request } from './httpClient.ts'

// No captcha widget in this assignment; the mock only checks that the header is not empty (A4).
const CAPTCHA_TOKEN = 'test-captcha'

export const userSchema = z.object({
  id: z.number(),
  email: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  name: z.string(),
})

export type User = z.infer<typeof userSchema>

export type LoginCredentials = {
  email: string
  password: string
}

const loginResponseSchema = z.object({ device_session_token: z.string().min(1) })
// Issue and rotate only promise a 200; the body is not used, so any body (or none) is accepted.
const ignoredBodySchema = z.unknown()
const noContentSchema = z.undefined()

// Returns the short-lived device token. It is never stored: the caller passes it straight to issueSession().
export async function login({ email, password }: LoginCredentials): Promise<string> {
  const response = await request({
    method: 'POST',
    path: '/auth/login',
    headers: { 'X-Captcha-Token': CAPTCHA_TOKEN },
    body: { email, password, fingerprint: getFingerprint() },
    schema: loginResponseSchema,
  })
  return response.device_session_token
}

export async function issueSession(deviceSessionToken: string): Promise<void> {
  await request({
    method: 'POST',
    path: '/auth/token/issue',
    body: { device_session_token: deviceSessionToken, fingerprint: getFingerprint() },
    schema: ignoredBodySchema,
  })
}

export async function rotateSession(): Promise<void> {
  await request({
    method: 'POST',
    path: '/auth/token/rotate',
    body: { fingerprint: getFingerprint() },
    schema: ignoredBodySchema,
  })
}

export async function revokeSession(): Promise<void> {
  await request({
    method: 'POST',
    path: '/auth/token/revoke',
    body: { fingerprint: getFingerprint() },
    schema: noContentSchema,
  })
}

export function getMe(): Promise<User> {
  return request({ path: '/v1/me', schema: userSchema })
}
