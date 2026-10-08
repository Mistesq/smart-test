import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { USER, USER_PASSWORD } from '../mocks/db.ts'
import { server } from '../mocks/node.ts'
import { issueSession, login } from './auth.ts'
import { ApiError } from './errors.ts'
import { getWebhook, getWebhooks, updateWebhook } from './webhooks.ts'

function recordListUrls() {
  const urls: URL[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname === '/v1/webhooks') urls.push(url)
  })
  return urls
}

beforeEach(async () => {
  await issueSession(await login({ email: USER.email, password: USER_PASSWORD }))
})

afterEach(() => {
  server.events.removeAllListeners()
})

describe('webhook endpoints', () => {
  it('returns a parsed page of webhooks', async () => {
    const list = await getWebhooks({ page: 3, limit: 10, search: '' })

    expect(list.data).toHaveLength(8)
    expect(list.paging).toEqual({ pages: { current: 3, last: 3 }, results: { total: 28, limitation: 10 } })
  })

  it('sends the search and leaves an empty one out of the URL', async () => {
    const urls = recordListUrls()

    const list = await getWebhooks({ page: 1, limit: 10, search: 'order' })
    await getWebhooks({ page: 1, limit: 10, search: '' })

    expect(list.paging.results.total).toBe(4)
    expect(urls.map((url) => url.search)).toEqual(['?page=1&limit=10&search=order', '?page=1&limit=10'])
  })

  it('returns one webhook and maps an unknown id to a 404 ApiError', async () => {
    await expect(getWebhook(1)).resolves.toMatchObject({ id: 1, name: 'Order created' })

    const error = await getWebhook(999).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 404, type: 'NotFoundException' })
  })

  it('updates a webhook and returns the saved version', async () => {
    const input = { name: 'Order shipped', url: 'https://hooks.example.com/order/shipped' }

    await expect(updateWebhook(1, input)).resolves.toMatchObject({ id: 1, ...input })
    await expect(getWebhook(1)).resolves.toMatchObject(input)
  })

  it('maps a 422 to field errors', async () => {
    await expect(updateWebhook(1, { name: '', url: 'ftp://example.com' })).rejects.toMatchObject({
      status: 422,
      type: 'ValidationException',
      fieldErrors: { name: [expect.any(String)], url: [expect.any(String)] },
    })
  })
})
