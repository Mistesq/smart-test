import { z } from 'zod'
import { request } from './httpClient.ts'

export const webhookSchema = z.object({
  id: z.number(),
  name: z.string(),
  url: z.string(),
  active: z.boolean(),
  created_at: z.string(),
})

export type Webhook = z.infer<typeof webhookSchema>

export const webhookListSchema = z.object({
  data: z.array(webhookSchema),
  paging: z.object({
    pages: z.object({ current: z.number(), last: z.number() }),
    results: z.object({ total: z.number(), limitation: z.number() }),
  }),
})

export type WebhookList = z.infer<typeof webhookListSchema>

export type WebhookListQuery = {
  page: number
  limit: number
  search: string
}

export type WebhookInput = {
  name: string
  url: string
}

export function getWebhooks({ page, limit, search }: WebhookListQuery): Promise<WebhookList> {
  return request({
    path: '/v1/webhooks',
    // An empty search is left out of the URL rather than sent as `search=`.
    query: { page, limit, search: search || undefined },
    schema: webhookListSchema,
  })
}

export function getWebhook(id: number): Promise<Webhook> {
  return request({ path: `/v1/webhooks/${id}`, schema: webhookSchema })
}

export function updateWebhook(id: number, input: WebhookInput): Promise<Webhook> {
  return request({ method: 'PUT', path: `/v1/webhooks/${id}`, body: input, schema: webhookSchema })
}
