import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../../api/config.ts'
import { SESSION_TTL_MS, USER, USER_PASSWORD } from '../db.ts'
import { CSRF_TOKEN } from '../http.ts'

const FINGERPRINT = 'a'.repeat(32)
const OTHER_FINGERPRINT = 'b'.repeat(32)
const CSRF_HEADERS = { 'X-CSRF-TOKEN': CSRF_TOKEN }
const LOGIN_HEADERS = { ...CSRF_HEADERS, 'X-Captcha-Token': 'test-captcha' }
const CREDENTIALS = { email: USER.email, password: USER_PASSWORD, fingerprint: FINGERPRINT }

function post(path: string, body: unknown, headers: Record<string, string> = CSRF_HEADERS) {
  return fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

const getMe = () => fetch(`${API_BASE_URL}/v1/me`)
const rotate = (fingerprint = FINGERPRINT) => post('/auth/token/rotate', { fingerprint })

async function getDeviceToken() {
  const login = await post('/auth/login', CREDENTIALS, LOGIN_HEADERS)
  const { device_session_token } = (await login.json()) as { device_session_token: string }
  return device_session_token
}

const issue = (device_session_token: string, fingerprint = FINGERPRINT) =>
  post('/auth/token/issue', { device_session_token, fingerprint })

const signIn = async () => issue(await getDeviceToken())

afterEach(() => {
  vi.useRealTimers()
})

describe('auth mock', () => {
  it('serves the CSRF token in a header', async () => {
    const response = await fetch(`${API_BASE_URL}/csrf`)

    expect(response.status).toBe(204)
    expect(response.headers.get('X-CSRF-TOKEN')).toBe(CSRF_TOKEN)
  })

  it('rejects a POST without the CSRF token with 419', async () => {
    const response = await post('/auth/login', CREDENTIALS, { 'X-Captcha-Token': 'test-captcha' })

    expect(response.status).toBe(419)
    expect(await response.json()).toMatchObject({ error: { type: 'TokenMismatchException' } })
  })

  it('rejects login without the captcha header with 422', async () => {
    const response = await post('/auth/login', CREDENTIALS)

    expect(response.status).toBe(422)
  })

  it('reports a wrong password on the password field', async () => {
    const response = await post('/auth/login', { ...CREDENTIALS, password: 'wrong' }, LOGIN_HEADERS)

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      error: { type: 'ValidationException', payload: { password: [expect.any(String)] } },
    })
  })

  it('returns a device token for valid credentials', async () => {
    const response = await post('/auth/login', CREDENTIALS, LOGIN_HEADERS)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ device_session_token: expect.any(String) })
  })

  it('refuses rotate before issue, then serves the user after issue', async () => {
    expect((await rotate()).status).toBe(400)
    expect((await signIn()).status).toBe(200)

    const me = await getMe()
    expect(me.status).toBe(200)
    expect(await me.json()).toEqual(USER)
  })

  it('accepts a device token only once', async () => {
    const token = await getDeviceToken()

    expect((await issue(token)).status).toBe(200)
    expect((await issue(token)).status).toBe(422)
  })

  it('refuses issue with a fingerprint other than the login one', async () => {
    const response = await issue(await getDeviceToken(), OTHER_FINGERPRINT)

    expect(response.status).toBe(422)
  })

  it('expires the session after 30 s and renews it on rotate', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    await signIn()

    vi.setSystemTime(Date.now() + SESSION_TTL_MS)
    expect((await getMe()).status).toBe(401)
    expect((await rotate()).status).toBe(200)
    expect((await getMe()).status).toBe(200)
  })

  it('refuses rotate on a fingerprint mismatch and after revoke', async () => {
    await signIn()

    expect((await rotate(OTHER_FINGERPRINT)).status).toBe(400)
    expect((await post('/auth/token/revoke', { fingerprint: FINGERPRINT })).status).toBe(204)
    expect((await rotate()).status).toBe(400)
  })
})
