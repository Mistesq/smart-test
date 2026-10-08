import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { db, SESSION_TTL_MS, USER, USER_PASSWORD } from '../db.ts'
import { errorResponse, validationErrorResponse } from '../errors.ts'
import { CSRF_TOKEN, readJson, requireCsrf, requireSession } from '../http.ts'

const fingerprintSchema = z
  .string({ error: 'Invalid fingerprint.' })
  .regex(/^[0-9a-f]{32}$/, { error: 'Invalid fingerprint.' })

const loginSchema = z.object({
  email: z.email({ error: 'Enter a valid email address.' }),
  password: z.string({ error: 'Password is required.' }).min(1, { error: 'Password is required.' }),
  fingerprint: fingerprintSchema,
})

const issueSchema = z.object({
  device_session_token: z.string({ error: 'Device token is required.' }).min(1, {
    error: 'Device token is required.',
  }),
  fingerprint: fingerprintSchema,
})

const fingerprintBodySchema = z.object({ fingerprint: fingerprintSchema })

function startSession(fingerprint: string): void {
  db.session = { fingerprint, expiresAt: Date.now() + SESSION_TTL_MS }
}

export const authHandlers = [
  http.get('*/csrf', () => new HttpResponse(null, { status: 204, headers: { 'X-CSRF-TOKEN': CSRF_TOKEN } })),

  http.post('*/auth/login', async ({ request }) => {
    const denied = requireCsrf(request)
    if (denied) return denied
    if (!request.headers.get('X-Captcha-Token')?.trim()) {
      return errorResponse(422, 'Captcha verification failed.')
    }

    const body = loginSchema.safeParse(await readJson(request))
    if (!body.success) return validationErrorResponse(body.error)

    const { email, password, fingerprint } = body.data
    // Unknown email and wrong password get the same error, so the response does not reveal which emails exist.
    if (email.toLowerCase() !== USER.email || password !== USER_PASSWORD) {
      return errorResponse(422, 'The given data was invalid.', {
        password: ['These credentials do not match our records.'],
      })
    }

    const deviceSessionToken = crypto.randomUUID()
    db.deviceTokens.set(deviceSessionToken, fingerprint)
    return HttpResponse.json({ device_session_token: deviceSessionToken })
  }),

  http.post('*/auth/token/issue', async ({ request }) => {
    const denied = requireCsrf(request)
    if (denied) return denied

    const body = issueSchema.safeParse(await readJson(request))
    if (!body.success) return validationErrorResponse(body.error)

    const { device_session_token: token, fingerprint } = body.data
    if (db.deviceTokens.get(token) !== fingerprint) {
      return errorResponse(422, 'The given data was invalid.', {
        device_session_token: ['The device token is invalid or has already been used.'],
      })
    }

    db.deviceTokens.delete(token)
    startSession(fingerprint)
    return HttpResponse.json({})
  }),

  // An expired session can still be rotated; only a missing (never issued or revoked) one cannot.
  http.post('*/auth/token/rotate', async ({ request }) => {
    const denied = requireCsrf(request)
    if (denied) return denied

    const body = fingerprintBodySchema.safeParse(await readJson(request))
    if (!body.success || db.session?.fingerprint !== body.data.fingerprint) {
      return errorResponse(400, 'The session cannot be rotated.')
    }

    startSession(body.data.fingerprint)
    return HttpResponse.json({})
  }),

  http.post('*/auth/token/revoke', async ({ request }) => {
    const denied = requireCsrf(request)
    if (denied) return denied

    const body = fingerprintBodySchema.safeParse(await readJson(request))
    if (body.success && db.session?.fingerprint === body.data.fingerprint) {
      db.session = null
    }
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('*/v1/me', () => requireSession() ?? HttpResponse.json(USER)),
]
