import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../../api/config.ts'
import { db, SESSION_TTL_MS } from '../db.ts'
import { CSRF_TOKEN } from '../http.ts'

type WebhookList = {
  data: { id: number; name: string }[]
  paging: { pages: { current: number; last: number }; results: { total: number; limitation: number } }
}

const getList = async (query: string) => {
  const response = await fetch(`${API_BASE_URL}/v1/webhooks${query}`)
  return { status: response.status, body: (await response.json()) as WebhookList }
}

const getWebhook = (id: number | string) => fetch(`${API_BASE_URL}/v1/webhooks/${id}`)

function putWebhook(id: number | string, body: unknown, headers: Record<string, string> = { 'X-CSRF-TOKEN': CSRF_TOKEN }) {
  return fetch(`${API_BASE_URL}/v1/webhooks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

// The auth flow is covered in auth.test.ts; here a session is seeded directly.
function seedSession() {
  db.session = { fingerprint: 'a'.repeat(32), expiresAt: Date.now() + SESSION_TTL_MS }
}

beforeEach(seedSession)

afterEach(() => {
  vi.useRealTimers()
})

describe('webhooks mock: list', () => {
  it('returns the first page with paging info', async () => {
    const { status, body } = await getList('?page=1&limit=10')

    expect(status).toBe(200)
    expect(body.data).toHaveLength(10)
    expect(body.data.map((webhook) => webhook.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(body.paging).toEqual({ pages: { current: 1, last: 3 }, results: { total: 28, limitation: 10 } })
  })

  it('returns the rest on the last page and nothing beyond it', async () => {
    expect((await getList('?page=3&limit=10')).body.data).toHaveLength(8)

    const beyond = await getList('?page=4&limit=10')
    expect(beyond.body.data).toEqual([])
    expect(beyond.body.paging.pages).toEqual({ current: 4, last: 3 })
  })

  it('searches names case-insensitively and counts only matches', async () => {
    const { body } = await getList('?search=ORDER')

    expect(body.data.map((webhook) => webhook.name)).toEqual([
      'Order created',
      'Order updated',
      'Order deleted',
      'Order archived',
    ])
    expect(body.paging).toEqual({ pages: { current: 1, last: 1 }, results: { total: 4, limitation: 10 } })
  })

  it('pages through search results', async () => {
    const { body } = await getList('?search=ate&page=2')

    expect(body.data).toHaveLength(4)
    expect(body.paging).toEqual({ pages: { current: 2, last: 2 }, results: { total: 14, limitation: 10 } })
  })

  it('reports one empty page when nothing matches', async () => {
    const { body } = await getList('?search=zzz')

    expect(body.data).toEqual([])
    expect(body.paging).toEqual({ pages: { current: 1, last: 1 }, results: { total: 0, limitation: 10 } })
  })

  it('honours a custom limit and ignores spaces around the search', async () => {
    const { body } = await getList('?search=%20order%20&limit=3&page=2')

    expect(body.data.map((webhook) => webhook.name)).toEqual(['Order archived'])
    expect(body.paging).toEqual({ pages: { current: 2, last: 2 }, results: { total: 4, limitation: 3 } })
  })

  it('falls back to defaults for invalid params and caps the limit', async () => {
    const invalid = await getList('?page=abc&limit=0')
    expect(invalid.body.paging.pages.current).toBe(1)
    expect(invalid.body.paging.results.limitation).toBe(10)

    const huge = await getList('?limit=1000')
    expect(huge.body.paging.results.limitation).toBe(100)
    expect(huge.body.data).toHaveLength(28)
  })
})

describe('webhooks mock: detail', () => {
  it('returns a webhook by id', async () => {
    const response = await getWebhook(1)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(db.webhooks[0])
  })

  it('returns 404 for an unknown or non-numeric id', async () => {
    for (const id of [9999, 'abc']) {
      const response = await getWebhook(id)
      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ error: { type: 'NotFoundException' } })
    }
  })
})

describe('webhooks mock: update', () => {
  it('reports name and url errors on their fields', async () => {
    const response = await putWebhook(1, { name: '  ', url: 'ftp://x' })

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      error: {
        type: 'ValidationException',
        payload: { name: ['The name field is required.'], url: ['The url must be a valid URL.'] },
      },
    })
  })

  it('reports missing fields as required', async () => {
    const response = await putWebhook(1, {})

    expect(await response.json()).toMatchObject({
      error: {
        payload: { name: ['The name field is required.'], url: ['The url field is required.'] },
      },
    })
  })

  it('reports only the invalid field and leaves the webhook unchanged', async () => {
    const before = { ...db.webhooks[0] }

    for (const url of ['not a url', 'http:example.com', 'javascript:alert(1)']) {
      const response = await putWebhook(1, { name: 'Renamed', url })
      const { error } = (await response.json()) as { error: { payload: Record<string, string[]> } }

      expect(response.status).toBe(422)
      expect(error.payload).toEqual({ url: ['The url must be a valid URL.'] })
    }
    expect(db.webhooks[0]).toEqual(before)
  })

  it('saves a valid body trimmed and shows it in the list', async () => {
    const response = await putWebhook(1, { name: '  Renamed  ', url: ' https://example.com/hook ' })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ id: 1, name: 'Renamed', url: 'https://example.com/hook' })
    expect((await getList('?search=renamed')).body.data).toMatchObject([{ id: 1, name: 'Renamed' }])
  })

  it('checks CSRF, then session, then id, then the body', async () => {
    expect((await putWebhook(9999, {}, {})).status).toBe(419)

    db.session = null
    expect((await putWebhook(9999, {})).status).toBe(401)

    seedSession()
    expect((await putWebhook(9999, {})).status).toBe(404)
    expect((await putWebhook(1, {})).status).toBe(422)
  })
})

describe('webhooks mock: session', () => {
  it('requires a live session on every endpoint', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + SESSION_TTL_MS)

    expect((await fetch(`${API_BASE_URL}/v1/webhooks`)).status).toBe(401)
    expect((await getWebhook(1)).status).toBe(401)
    expect((await putWebhook(1, { name: 'x', url: 'https://example.com' })).status).toBe(401)
  })
})
