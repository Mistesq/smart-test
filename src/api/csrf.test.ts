import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../mocks/node.ts'
import { ensureCsrfToken, invalidateCsrfToken, resetCsrfToken } from './csrf.ts'
import { ApiError, NetworkError } from './errors.ts'

// Each GET /csrf answers with the next response from the list and serves token-1, token-2, ...
function useCsrf(...responses: ('token' | 'error' | 'no-header' | 'network')[]) {
  const csrf = { calls: 0 }
  server.use(
    http.get('*/csrf', () => {
      csrf.calls += 1
      const kind = responses[csrf.calls - 1] ?? 'token'
      if (kind === 'network') return HttpResponse.error()
      if (kind === 'no-header') return new HttpResponse(null, { status: 204 })
      if (kind === 'error') {
        return HttpResponse.json({ error: { type: 'BadRequestException', message: 'Nope.' } }, { status: 400 })
      }
      return new HttpResponse(null, { status: 204, headers: { 'X-CSRF-TOKEN': `token-${csrf.calls}` } })
    }),
  )
  return csrf
}

describe('csrf: ensureCsrfToken', () => {
  it('throws the parsed ApiError on an error response and does not cache the failure', async () => {
    const csrf = useCsrf('error')

    await expect(ensureCsrfToken()).rejects.toMatchObject({ status: 400, type: 'BadRequestException' })
    await expect(ensureCsrfToken()).resolves.toBe('token-2')
    expect(csrf.calls).toBe(2)
  })

  it('throws InvalidResponse when the header is missing', async () => {
    useCsrf('no-header')

    const error = await ensureCsrfToken().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 204, type: 'InvalidResponse' })
  })

  it('throws NetworkError when GET /csrf gets no response', async () => {
    useCsrf('network')

    await expect(ensureCsrfToken()).rejects.toBeInstanceOf(NetworkError)
  })

  it('does not cache a token that arrives after a reset', async () => {
    const csrf = useCsrf()

    const stale = ensureCsrfToken()
    resetCsrfToken()
    await expect(stale).resolves.toBe('token-1')

    await expect(ensureCsrfToken()).resolves.toBe('token-2')
    expect(csrf.calls).toBe(2)
  })
})

describe('csrf: invalidateCsrfToken', () => {
  it('clears the cache only when it still holds the rejected token', async () => {
    const csrf = useCsrf()
    await ensureCsrfToken()

    invalidateCsrfToken('token-0')
    await expect(ensureCsrfToken()).resolves.toBe('token-1')

    invalidateCsrfToken('token-1')
    await expect(ensureCsrfToken()).resolves.toBe('token-2')
    expect(csrf.calls).toBe(2)
  })
})
