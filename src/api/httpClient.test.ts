import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { server } from '../mocks/node.ts'
import { ApiError, GENERIC_ERROR_MESSAGE, isApiError, NetworkError } from './errors.ts'
import { configureHttpClient, request, type UnauthorizedHandler } from './httpClient.ts'

const okSchema = z.object({ ok: z.literal(true) })

// Serves a new token on every GET /csrf (token-1, token-2, ...) and counts the calls.
function useCountingCsrf() {
  const csrf = { calls: 0, current: () => `token-${csrf.calls}` }
  server.use(
    http.get('*/csrf', () => {
      csrf.calls += 1
      return new HttpResponse(null, { status: 204, headers: { 'X-CSRF-TOKEN': csrf.current() } })
    }),
  )
  return csrf
}

function useEndpoint(
  method: 'get' | 'post',
  resolve: (request: Request, call: number) => Response | Promise<Response>,
) {
  const endpoint = { calls: 0, requests: [] as Request[] }
  server.use(
    http[method]('*/test/endpoint', ({ request }) => {
      endpoint.calls += 1
      endpoint.requests.push(request)
      return resolve(request, endpoint.calls)
    }),
  )
  return endpoint
}

const ok = () => HttpResponse.json({ ok: true })
const envelope = (status: number, type: string, message: string, payload?: Record<string, string[]>) =>
  HttpResponse.json({ error: { type, message, ...(payload && { payload }) } }, { status })
const tokenMismatch = () => envelope(419, 'TokenMismatchException', 'CSRF token mismatch.')
const unauthorized = () => envelope(401, 'AuthenticationException', 'Unauthenticated.')

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected the request to fail')
}

describe('httpClient: headers and CSRF', () => {
  it('sends X-Requested-With on every request, GET /csrf included', async () => {
    const seen: (string | null)[] = []
    server.use(
      http.get('*/csrf', ({ request }) => {
        seen.push(request.headers.get('X-Requested-With'))
        return new HttpResponse(null, { status: 204, headers: { 'X-CSRF-TOKEN': 't' } })
      }),
    )
    const endpoint = useEndpoint('get', ok)

    await request({ path: '/test/endpoint', schema: okSchema })

    expect(seen).toEqual(['XMLHttpRequest'])
    expect(endpoint.requests[0].headers.get('X-Requested-With')).toBe('XMLHttpRequest')
  })

  it('shares one GET /csrf between parallel first requests and caches the token', async () => {
    const csrf = useCountingCsrf()
    useEndpoint('get', ok)

    await Promise.all([
      request({ path: '/test/endpoint', schema: okSchema }),
      request({ path: '/test/endpoint', schema: okSchema }),
    ])
    await request({ path: '/test/endpoint', schema: okSchema })

    expect(csrf.calls).toBe(1)
  })

  it('attaches X-CSRF-TOKEN to POST and a JSON body, but not the token to GET', async () => {
    useCountingCsrf()
    const post = useEndpoint('post', ok)
    const get = useEndpoint('get', ok)

    await request({ method: 'POST', path: '/test/endpoint', body: { name: 'x' }, schema: okSchema })
    await request({ path: '/test/endpoint', schema: okSchema })

    expect(post.requests[0].headers.get('X-CSRF-TOKEN')).toBe('token-1')
    expect(post.requests[0].headers.get('Content-Type')).toBe('application/json')
    expect(await post.requests[0].json()).toEqual({ name: 'x' })
    expect(get.requests[0].headers.get('X-CSRF-TOKEN')).toBeNull()
  })

  it('refetches the token after a 419 and retries once', async () => {
    const csrf = useCountingCsrf()
    const endpoint = useEndpoint('post', (_request, call) => (call === 1 ? tokenMismatch() : ok()))

    await expect(request({ method: 'POST', path: '/test/endpoint', schema: okSchema })).resolves.toEqual({ ok: true })

    expect(csrf.calls).toBe(2)
    expect(endpoint.requests.map((r) => r.headers.get('X-CSRF-TOKEN'))).toEqual(['token-1', 'token-2'])
  })

  it('throws ApiError 419 when the retry also gets 419', async () => {
    useCountingCsrf()
    const endpoint = useEndpoint('post', tokenMismatch)

    const error = await catchError(request({ method: 'POST', path: '/test/endpoint', schema: okSchema }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 419, type: 'TokenMismatchException' })
    expect(endpoint.calls).toBe(2)
  })

  it('shares one token refetch between parallel 419s', async () => {
    const csrf = useCountingCsrf()
    useEndpoint('post', (request) => (request.headers.get('X-CSRF-TOKEN') === 'token-1' ? tokenMismatch() : ok()))

    await Promise.all([
      request({ method: 'POST', path: '/test/endpoint', schema: okSchema }),
      request({ method: 'POST', path: '/test/endpoint', schema: okSchema }),
    ])

    expect(csrf.calls).toBe(2)
  })

  it('keeps the refreshed token when a stale 419 arrives after the refetch', async () => {
    const csrf = useCountingCsrf()
    let markRefreshed = () => {}
    const refreshed = new Promise<void>((resolve) => {
      markRefreshed = resolve
    })
    let staleCalls = 0
    // The first stale request gets 419 at once; the second one only after the first has retried with token-2.
    const endpoint = useEndpoint('post', async (request) => {
      if (request.headers.get('X-CSRF-TOKEN') !== 'token-1') {
        markRefreshed()
        return ok()
      }
      staleCalls += 1
      if (staleCalls === 2) await refreshed
      return tokenMismatch()
    })

    await Promise.all([
      request({ method: 'POST', path: '/test/endpoint', schema: okSchema }),
      request({ method: 'POST', path: '/test/endpoint', schema: okSchema }),
    ])

    expect(csrf.calls).toBe(2)
    expect(endpoint.requests.map((r) => r.headers.get('X-CSRF-TOKEN'))).toEqual([
      'token-1',
      'token-1',
      'token-2',
      'token-2',
    ])
  })
})

describe('httpClient: responses and errors', () => {
  it('builds the query string, skipping undefined values', async () => {
    const endpoint = useEndpoint('get', ok)

    await request({ path: '/test/endpoint', query: { page: 2, search: 'a b', empty: undefined }, schema: okSchema })

    expect(new URL(endpoint.requests[0].url).search).toBe('?page=2&search=a+b')
  })

  it('returns undefined for 204', async () => {
    useEndpoint('post', () => new HttpResponse(null, { status: 204 }))

    await expect(request({ method: 'POST', path: '/test/endpoint', schema: z.undefined() })).resolves.toBeUndefined()
  })

  it('throws InvalidResponse when a success body does not match the schema', async () => {
    useEndpoint('get', () => HttpResponse.json({ ok: 'yes' }))

    const error = await catchError(request({ path: '/test/endpoint', schema: okSchema }))

    expect(error).toMatchObject({ status: 200, type: 'InvalidResponse', message: GENERIC_ERROR_MESSAGE })
  })

  it('maps a 422 payload to fieldErrors', async () => {
    const payload = { name: ['The name field is required.'], url: ['The url must be a valid URL.'] }
    useEndpoint('post', () => envelope(422, 'ValidationException', 'The given data was invalid.', payload))

    const error = await catchError(request({ method: 'POST', path: '/test/endpoint', schema: okSchema }))

    expect(isApiError(error)).toBe(true)
    expect(error).toMatchObject({ status: 422, type: 'ValidationException', message: 'The given data was invalid.' })
    expect((error as ApiError).fieldErrors).toEqual(payload)
  })

  it('turns a broken or unknown error body into a generic ApiError', async () => {
    useEndpoint('get', () => new HttpResponse('<html>oops', { status: 500 }))
    const broken = await catchError(request({ path: '/test/endpoint', schema: okSchema }))
    expect(broken).toMatchObject({ status: 500, type: 'UnknownError', message: GENERIC_ERROR_MESSAGE, fieldErrors: {} })

    useEndpoint('get', () => envelope(503, 'MaintenanceException', 'Down for maintenance.'))
    const unknown = await catchError(request({ path: '/test/endpoint', schema: okSchema }))
    expect(unknown).toMatchObject({ status: 503, type: 'UnknownError', message: 'Down for maintenance.' })
  })

  it('throws NetworkError when the request gets no response', async () => {
    useEndpoint('get', () => HttpResponse.error())

    const error = await catchError(request({ path: '/test/endpoint', schema: okSchema }))

    expect(error).toBeInstanceOf(NetworkError)
    expect((error as NetworkError).cause).toBeInstanceOf(TypeError)
    expect(isApiError(error)).toBe(false)
  })

  it('fails a body that cannot be serialized before any network call, not as a NetworkError', async () => {
    const csrf = useCountingCsrf()
    const endpoint = useEndpoint('post', ok)
    const circular: Record<string, unknown> = {}
    circular.self = circular

    const error = await catchError(request({ method: 'POST', path: '/test/endpoint', body: circular, schema: okSchema }))

    expect(error).toBeInstanceOf(TypeError)
    expect(error).not.toBeInstanceOf(NetworkError)
    expect(csrf.calls).toBe(0)
    expect(endpoint.calls).toBe(0)
  })
})

describe('httpClient: 401 extension point', () => {
  type OnUnauthorized<Context> = UnauthorizedHandler<Context>['onUnauthorized']

  it('throws ApiError 401 when no handler is configured', async () => {
    useEndpoint('get', unauthorized)

    const error = await catchError(request({ path: '/test/endpoint', schema: okSchema }))

    expect(error).toMatchObject({ status: 401, type: 'AuthenticationException' })
  })

  it('passes the context taken right before the failed send and retries once on "retry"', async () => {
    let generation = 1
    const getRequestContext = vi.fn(() => generation)
    const onUnauthorized = vi.fn<OnUnauthorized<number>>(async () => 'retry')
    configureHttpClient({ getRequestContext, onUnauthorized })
    // The generation changes while the first request is in flight, as a rotate by another request would.
    const endpoint = useEndpoint('get', (_request, call) => {
      if (call > 1) return ok()
      generation = 2
      return unauthorized()
    })

    await expect(request({ path: '/test/endpoint', schema: okSchema })).resolves.toEqual({ ok: true })

    expect(endpoint.calls).toBe(2)
    expect(onUnauthorized).toHaveBeenCalledExactlyOnceWith(1, { method: 'GET', path: '/test/endpoint', isRetry: false })
    expect(getRequestContext.mock.results.map((result) => result.value)).toEqual([1, 2])
  })

  it('does not send a second retry even if the handler asks for it', async () => {
    const onUnauthorized = vi.fn<OnUnauthorized<null>>(async () => 'retry')
    configureHttpClient({ getRequestContext: () => null, onUnauthorized })
    const endpoint = useEndpoint('get', unauthorized)

    const error = await catchError(request({ path: '/test/endpoint', schema: okSchema }))

    expect(error).toMatchObject({ status: 401 })
    expect(endpoint.calls).toBe(2)
    expect(onUnauthorized.mock.calls.map(([, info]) => info.isRetry)).toEqual([false, true])
  })

  it('throws without a retry on "fail"', async () => {
    configureHttpClient({ getRequestContext: () => null, onUnauthorized: async () => 'fail' })
    const endpoint = useEndpoint('get', unauthorized)

    await expect(request({ path: '/test/endpoint', schema: okSchema })).rejects.toMatchObject({ status: 401 })
    expect(endpoint.calls).toBe(1)
  })

  it('throws the original 401 ApiError when onUnauthorized rejects', async () => {
    configureHttpClient({
      getRequestContext: () => null,
      onUnauthorized: () => Promise.reject(new Error('rotate exploded')),
    })
    const endpoint = useEndpoint('get', unauthorized)

    const error = await catchError(request({ path: '/test/endpoint', schema: okSchema }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401, type: 'AuthenticationException' })
    expect(endpoint.calls).toBe(1)
  })

  it('throws the original 401 ApiError when getRequestContext throws', async () => {
    const onUnauthorized = vi.fn<OnUnauthorized<never>>(async () => 'retry')
    configureHttpClient({
      getRequestContext: () => {
        throw new Error('no context')
      },
      onUnauthorized,
    })
    const endpoint = useEndpoint('get', unauthorized)

    const error = await catchError(request({ path: '/test/endpoint', schema: okSchema }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401 })
    expect(onUnauthorized).not.toHaveBeenCalled()
    expect(endpoint.calls).toBe(1)
  })

  it('keeps a newer handler when an older remover runs', async () => {
    const removeOld = configureHttpClient({ getRequestContext: () => null, onUnauthorized: async () => 'fail' })
    const onUnauthorized = vi.fn<OnUnauthorized<null>>(async () => 'retry')
    configureHttpClient({ getRequestContext: () => null, onUnauthorized })
    removeOld()
    useEndpoint('get', (_request, call) => (call === 1 ? unauthorized() : ok()))

    await expect(request({ path: '/test/endpoint', schema: okSchema })).resolves.toEqual({ ok: true })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('counts 419 and 401 retries separately', async () => {
    useCountingCsrf()
    configureHttpClient({ getRequestContext: () => null, onUnauthorized: async () => 'retry' })
    const endpoint = useEndpoint('post', (_request, call) => {
      if (call === 1) return tokenMismatch()
      if (call === 2) return unauthorized()
      return ok()
    })

    await expect(request({ method: 'POST', path: '/test/endpoint', schema: okSchema })).resolves.toEqual({ ok: true })
    expect(endpoint.calls).toBe(3)
  })
})
