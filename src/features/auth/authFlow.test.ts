import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMe } from '../../api/auth.ts'
import { ApiError, NetworkError } from '../../api/errors.ts'
import { installSessionHandling, setSessionExpiredHandler } from '../../api/session.ts'
import { db, USER, USER_PASSWORD } from '../../mocks/db.ts'
import { errorResponse } from '../../mocks/errors.ts'
import { server } from '../../mocks/node.ts'
import { signIn, signOut } from './authFlow.ts'

const CREDENTIALS = { email: USER.email, password: USER_PASSWORD }

// Records the path and status of every mocked response in arrival order.
function recordResponses(): string[] {
  const responses: string[] = []
  server.events.on('response:mocked', ({ request, response }) => {
    responses.push(`${new URL(request.url).pathname} ${response.status}`)
  })
  return responses
}

let uninstallSessionHandling: () => void

beforeEach(() => {
  uninstallSessionHandling = installSessionHandling()
})

afterEach(() => {
  uninstallSessionHandling()
  server.events.removeAllListeners()
})

describe('signIn', () => {
  it('logs in, issues the session and returns the user', async () => {
    const responses = recordResponses()

    await expect(signIn(CREDENTIALS)).resolves.toEqual(USER)
    expect(responses).toEqual(['/csrf 204', '/auth/login 200', '/auth/token/issue 200', '/v1/me 200'])
  })

  it('stops after a rejected login with the field errors from the server', async () => {
    const responses = recordResponses()

    const error = await signIn({ ...CREDENTIALS, password: 'wrong' }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 422,
      fieldErrors: { password: ['These credentials do not match our records.'] },
    })
    expect(responses).toEqual(['/csrf 204', '/auth/login 422'])
  })

  it('closes the issued session when the user cannot be loaded', async () => {
    server.use(http.get('*/v1/me', () => HttpResponse.error()))

    await expect(signIn(CREDENTIALS)).rejects.toBeInstanceOf(NetworkError)
    expect(db.session).toBeNull()
  })

  it('does not load the user when the session cannot be issued', async () => {
    const responses = recordResponses()
    server.use(http.post('*/auth/token/issue', () => errorResponse(422, 'The given data was invalid.')))

    await expect(signIn(CREDENTIALS)).rejects.toMatchObject({ status: 422 })
    expect(responses.some((response) => response.startsWith('/v1/me'))).toBe(false)
  })
})

describe('signOut', () => {
  const onExpired = vi.fn()

  beforeEach(async () => {
    setSessionExpiredHandler(onExpired)
    await signIn(CREDENTIALS)
  })

  afterEach(() => {
    onExpired.mockReset()
  })

  it('revokes the session; a later 401 fails without a rotate or the expired handler', async () => {
    const responses = recordResponses()

    await signOut()

    await expect(getMe()).rejects.toMatchObject({ status: 401 })
    expect(responses).toEqual(['/auth/token/revoke 204', '/v1/me 401'])
    expect(onExpired).not.toHaveBeenCalled()
  })

  it('resolves when the revoke fails', async () => {
    server.use(http.post('*/auth/token/revoke', () => HttpResponse.error()))

    await expect(signOut()).resolves.toBeUndefined()
  })
})
