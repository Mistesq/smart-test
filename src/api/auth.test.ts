import { afterEach, describe, expect, it } from 'vitest'
import { USER, USER_PASSWORD } from '../mocks/db.ts'
import { server } from '../mocks/node.ts'
import { getMe, issueSession, login, revokeSession, rotateSession } from './auth.ts'
import { ApiError } from './errors.ts'

const CREDENTIALS = { email: USER.email, password: USER_PASSWORD }

// Captures every request that reaches the mock (clones, so the handlers can still read the bodies).
function recordRequests() {
  const requests: Request[] = []
  server.events.on('request:start', ({ request }) => {
    requests.push(request.clone())
  })
  return {
    to: (path: string) => requests.filter((request) => new URL(request.url).pathname === path),
  }
}

afterEach(() => {
  server.events.removeAllListeners()
})

describe('auth endpoints', () => {
  it('logs in with the captcha header and fingerprint and returns the device token', async () => {
    const requests = recordRequests()

    const deviceSessionToken = await login(CREDENTIALS)

    expect(deviceSessionToken).toEqual(expect.any(String))
    const [loginRequest] = requests.to('/auth/login')
    expect(loginRequest.headers.get('X-Captcha-Token')).toBe('test-captcha')
    expect(await loginRequest.json()).toEqual({ ...CREDENTIALS, fingerprint: expect.stringMatching(/^[0-9a-f]{32}$/) })
  })

  it('maps a wrong password to a 422 error on the password field', async () => {
    const error = await login({ ...CREDENTIALS, password: 'wrong' }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 422,
      type: 'ValidationException',
      fieldErrors: { password: ['These credentials do not match our records.'] },
    })
  })

  it('sends the same fingerprint to login, issue, rotate and revoke', async () => {
    const requests = recordRequests()

    await issueSession(await login(CREDENTIALS))
    await rotateSession()
    await expect(revokeSession()).resolves.toBeUndefined()

    const paths = ['/auth/login', '/auth/token/issue', '/auth/token/rotate', '/auth/token/revoke']
    const fingerprints = await Promise.all(
      paths.map(async (path) => ((await requests.to(path)[0].json()) as { fingerprint: string }).fingerprint),
    )
    expect(new Set(fingerprints).size).toBe(1)
  })

  it('returns the current user after the session is issued', async () => {
    await issueSession(await login(CREDENTIALS))

    await expect(getMe()).resolves.toEqual(USER)
  })

  it('rejects a reused device token with 422', async () => {
    const deviceSessionToken = await login(CREDENTIALS)
    await issueSession(deviceSessionToken)

    await expect(issueSession(deviceSessionToken)).rejects.toMatchObject({
      status: 422,
      fieldErrors: { device_session_token: [expect.any(String)] },
    })
  })
})
