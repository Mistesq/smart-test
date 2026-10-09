import { MutationObserver, QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it } from 'vitest'
import { issueSession, login } from '../../api/auth.ts'
import { getWebhook, getWebhooks, type Webhook } from '../../api/webhooks.ts'
import { USER, USER_PASSWORD } from '../../mocks/db.ts'
import { updateWebhookOptions } from './useUpdateWebhook.ts'
import { webhookQueryKey } from './useWebhook.ts'

const LIST_KEY = ['webhooks', { page: 1, search: '' }] as const
const INPUT = { name: 'Order shipped', url: 'https://hooks.example.com/order/shipped' }

let queryClient: QueryClient

// The cache as the edit page leaves it: a list page and two webhook details, all fresh.
async function seedCache() {
  queryClient.setQueryData(LIST_KEY, await getWebhooks({ page: 1, limit: 10, search: '' }))
  queryClient.setQueryData(webhookQueryKey(1), await getWebhook(1))
  queryClient.setQueryData(webhookQueryKey(2), await getWebhook(2))
}

function save(id: number, input: { name: string; url: string }) {
  return new MutationObserver(queryClient, updateWebhookOptions(id)).mutate(input)
}

const isInvalidated = (queryKey: readonly unknown[]) => queryClient.getQueryState(queryKey)?.isInvalidated

beforeEach(async () => {
  queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  await issueSession(await login({ email: USER.email, password: USER_PASSWORD }))
  await seedCache()
})

describe('updateWebhookOptions', () => {
  it('stores the saved webhook and invalidates only the lists', async () => {
    const updated = await save(1, INPUT)

    expect(updated).toMatchObject({ id: 1, ...INPUT })
    expect(queryClient.getQueryData<Webhook>(webhookQueryKey(1))).toEqual(updated)
    expect(isInvalidated(LIST_KEY)).toBe(true)
    expect(isInvalidated(webhookQueryKey(1))).toBe(false)
    expect(isInvalidated(webhookQueryKey(2))).toBe(false)
  })

  it('leaves the cache untouched when the server rejects the input', async () => {
    const before = queryClient.getQueryData<Webhook>(webhookQueryKey(1))

    await expect(save(1, { name: 'Order created', url: 'ftp://x' })).rejects.toMatchObject({ status: 422 })

    expect(queryClient.getQueryData<Webhook>(webhookQueryKey(1))).toEqual(before)
    expect(isInvalidated(LIST_KEY)).toBe(false)
  })
})
