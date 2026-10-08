import { http, HttpResponse } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_TTL_MS, USER, USER_PASSWORD } from '../mocks/db.ts'
import { errorResponse } from '../mocks/errors.ts'
import { server } from '../mocks/node.ts'
import { getMe, login, revokeSession } from './auth.ts'
import { ApiError } from './errors.ts'
import { endSession, installSessionHandling, setSessionExpiredHandler, startSession } from './session.ts'

type MockedResponse = { path: string; status: number }

// Records every response the mock sends, so tests can count rotates and see each request's status.
function recordResponses() {
  const responses: MockedResponse[] = []
  server.events.on('response:mocked', ({ request, response }) => {
    responses.push({ path: new URL(request.url).pathname, status: response.status })
  })
  return {
    count: (path: string, status?: number) =>
      responses.filter((response) => response.path === path && (status === undefined || response.status === status))
        .length,
  }
}

async function signIn(): Promise<void> {
  const deviceSessionToken = await login({ email: USER.email, password: USER_PASSWORD })
  await startSession(deviceSessionToken)
}

// Only Date is mocked: promises, fetch and MSW keep running on real time.
function moveClockPastSessionTtl(): void {
  vi.setSystemTime(Date.now() + SESSION_TTL_MS + 1_000)
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const unauthorized = () => errorResponse(401, 'Unauthenticated.')

function expectUnauthorized(result: PromiseSettledResult<unknown>): void {
  expect(result.status).toBe('rejected')
  if (result.status === 'rejected') {
    expect(result.reason).toBeInstanceOf(ApiError)
    expect(result.reason).toMatchObject({ status: 401, type: 'AuthenticationException' })
  }
}

let uninstallSessionHandling: () => void

beforeEach(() => {
  uninstallSessionHandling = installSessionHandling()
})

afterEach(() => {
  uninstallSessionHandling()
  server.events.removeAllListeners()
  vi.useRealTimers()
})

describe('session: shared rotate', () => {
  it('two parallel 401s share one rotate and both retries succeed', async () => {
    const responses = recordResponses()
    const onExpired = vi.fn()
    setSessionExpiredHandler(onExpired)
    await signIn()
    moveClockPastSessionTtl()

    const results = await Promise.all([getMe(), getMe()])

    expect(results).toEqual([USER, USER])
    expect(responses.count('/v1/me', 401)).toBe(2)
    expect(responses.count('/auth/token/rotate')).toBe(1)
    expect(responses.count('/v1/me', 200)).toBe(2)
    expect(onExpired).not.toHaveBeenCalled()
  })

  it('retries a late 401 from an older generation without a new rotate', async () => {
    const responses = recordResponses()
    await signIn()
    moveClockPastSessionTtl()
    const lateArrived = deferred()
    const release = deferred()
    server.use(
      http.get(
        '*/v1/me',
        async () => {
          lateArrived.resolve()
          await release.promise
          return unauthorized()
        },
        { once: true },
      ),
    )

    // Sent before the rotate, its 401 is held until the rotate has finished.
    const late = getMe()
    await lateArrived.promise
    await expect(getMe()).resolves.toEqual(USER)
    release.resolve()

    await expect(late).resolves.toEqual(USER)
    expect(responses.count('/auth/token/rotate')).toBe(1)
  })

  it('does not rotate on a 401 from an auth endpoint', async () => {
    const responses = recordResponses()
    server.use(http.post('*/auth/login', unauthorized))

    await expect(login({ email: USER.email, password: USER_PASSWORD })).rejects.toMatchObject({ status: 401 })
    expect(responses.count('/auth/token/rotate')).toBe(0)
  })
})

describe('session: expiry', () => {
  it('rejects both requests with 401 and calls the expired handler once when rotate returns 400', async () => {
    const responses = recordResponses()
    const onExpired = vi.fn()
    setSessionExpiredHandler(onExpired)
    await signIn()
    await revokeSession()

    const results = await Promise.allSettled([getMe(), getMe()])

    results.forEach(expectUnauthorized)
    expect(responses.count('/auth/token/rotate', 400)).toBe(1)
    expect(onExpired).toHaveBeenCalledOnce()
  })

  it('expires the session without a second rotate when the retry also gets 401', async () => {
    const responses = recordResponses()
    const onExpired = vi.fn()
    setSessionExpiredHandler(onExpired)
    await signIn()
    server.use(http.get('*/v1/me', unauthorized))

    const results = await Promise.allSettled([getMe(), getMe()])

    results.forEach(expectUnauthorized)
    expect(responses.count('/v1/me', 401)).toBe(4)
    expect(responses.count('/auth/token/rotate')).toBe(1)
    expect(onExpired).toHaveBeenCalledOnce()
  })

  it('treats a rotate network error as a failed rotate', async () => {
    const onExpired = vi.fn()
    setSessionExpiredHandler(onExpired)
    await signIn()
    moveClockPastSessionTtl()
    server.use(http.post('*/auth/token/rotate', () => HttpResponse.error()))

    const results = await Promise.allSettled([getMe(), getMe()])

    results.forEach(expectUnauthorized)
    expect(onExpired).toHaveBeenCalledOnce()
  })

  it('retries under a session that started while the rotate was failing, without expiring it', async () => {
    const onExpired = vi.fn()
    setSessionExpiredHandler(onExpired)
    await signIn()
    await revokeSession()
    const rotateArrived = deferred()
    const releaseRotate = deferred()
    server.use(
      http.post(
        '*/auth/token/rotate',
        async () => {
          rotateArrived.resolve()
          await releaseRotate.promise
          return errorResponse(400, 'The session cannot be rotated.')
        },
        { once: true },
      ),
    )

    // Its rotate is held until a new sign-in has finished, then fails.
    const pending = getMe()
    await rotateArrived.promise
    await signIn()
    releaseRotate.resolve()

    await expect(pending).resolves.toEqual(USER)
    expect(onExpired).not.toHaveBeenCalled()
    await expect(getMe()).resolves.toEqual(USER)
  })

  it('keeps the session expired when startSession fails', async () => {
    const responses = recordResponses()
    const onExpired = vi.fn()
    setSessionExpiredHandler(onExpired)
    await signIn()
    await revokeSession()
    await expect(getMe()).rejects.toMatchObject({ status: 401 })

    await expect(startSession('unknown-device-token')).rejects.toMatchObject({ status: 422 })

    await expect(getMe()).rejects.toMatchObject({ status: 401 })
    expect(responses.count('/auth/token/rotate')).toBe(1)
    expect(onExpired).toHaveBeenCalledOnce()
  })

  it('fails further 401s at once after expiry, until a new session starts', async () => {
    const responses = recordResponses()
    const onExpired = vi.fn()
    setSessionExpiredHandler(onExpired)
    await signIn()
    await revokeSession()
    await expect(getMe()).rejects.toMatchObject({ status: 401 })

    await expect(getMe()).rejects.toMatchObject({ status: 401 })
    expect(responses.count('/auth/token/rotate')).toBe(1)
    expect(onExpired).toHaveBeenCalledOnce()

    await signIn()
    await revokeSession()
    await expect(getMe()).rejects.toMatchObject({ status: 401 })
    expect(responses.count('/auth/token/rotate')).toBe(2)
    expect(onExpired).toHaveBeenCalledTimes(2)
  })
})

describe('session: logout', () => {
  it('fails a 401 after logout without a rotate or the expired handler', async () => {
    const responses = recordResponses()
    const onExpired = vi.fn()
    setSessionExpiredHandler(onExpired)
    await signIn()

    endSession()
    await revokeSession()

    await expect(getMe()).rejects.toMatchObject({ status: 401 })
    expect(responses.count('/auth/token/rotate')).toBe(0)
    expect(onExpired).not.toHaveBeenCalled()
  })

  it('fails a request whose rotate finishes after logout without the expired handler', async () => {
    const onExpired = vi.fn()
    setSessionExpiredHandler(onExpired)
    await signIn()
    moveClockPastSessionTtl()
    const rotateArrived = deferred()
    const releaseRotate = deferred()
    server.use(
      http.post(
        '*/auth/token/rotate',
        async () => {
          rotateArrived.resolve()
          await releaseRotate.promise
          return errorResponse(400, 'The session cannot be rotated.')
        },
        { once: true },
      ),
    )

    const pending = getMe()
    await rotateArrived.promise
    endSession()
    releaseRotate.resolve()

    await expect(pending).rejects.toMatchObject({ status: 401 })
    expect(onExpired).not.toHaveBeenCalled()
  })

  it('does not let a rotate still in flight at logout expire the next session', async () => {
    const onExpired = vi.fn()
    setSessionExpiredHandler(onExpired)
    await signIn()
    moveClockPastSessionTtl()
    const rotateArrived = deferred()
    const releaseRotate = deferred()
    server.use(
      http.post(
        '*/auth/token/rotate',
        async () => {
          rotateArrived.resolve()
          await releaseRotate.promise
          return errorResponse(400, 'The session cannot be rotated.')
        },
        { once: true },
      ),
    )

    // Its rotate is held across a logout and a new sign-in, then fails.
    const stale = getMe()
    await rotateArrived.promise
    endSession()
    await signIn()
    server.use(http.get('*/v1/me', unauthorized, { once: true }))

    await expect(getMe()).resolves.toEqual(USER)
    releaseRotate.resolve()
    await expect(stale).resolves.toEqual(USER)
    expect(onExpired).not.toHaveBeenCalled()
  })

  it('works again after the next sign-in', async () => {
    await signIn()
    endSession()
    await revokeSession()

    await signIn()

    await expect(getMe()).resolves.toEqual(USER)
  })
})
