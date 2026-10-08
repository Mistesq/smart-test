import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API_BASE_URL } from '../api/config.ts'
import { server } from './node.ts'

describe('msw test server', () => {
  it('serves handlers added at runtime', async () => {
    server.use(http.get('*/ping', () => HttpResponse.json({ ok: true })))

    const response = await fetch(`${API_BASE_URL}/ping`)

    expect(await response.json()).toEqual({ ok: true })
  })

  it('rejects unhandled requests', async () => {
    await expect(fetch(`${API_BASE_URL}/unhandled`)).rejects.toThrow(/onUnhandledRequest/)
  })
})
