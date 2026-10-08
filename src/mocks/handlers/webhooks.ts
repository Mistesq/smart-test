import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { db } from '../db.ts'
import { errorResponse, validationErrorResponse } from '../errors.ts'
import { readJson, requireCsrf, requireSession } from '../http.ts'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 100

// Invalid or missing params fall back to defaults instead of failing the request.
const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .transform((limit) => Math.min(limit, MAX_LIMIT))
    .catch(DEFAULT_LIMIT),
  search: z.string().trim().catch(''),
})

const NAME_REQUIRED = 'The name field is required.'
const URL_REQUIRED = 'The url field is required.'

const updateSchema = z.object({
  name: z.string({ error: NAME_REQUIRED }).trim().min(1, { error: NAME_REQUIRED }),
  url: z
    .string({ error: URL_REQUIRED })
    .trim()
    .min(1, { error: URL_REQUIRED })
    .pipe(z.httpUrl({ error: 'The url must be a valid URL.' })),
})

// Comparing as strings makes a non-numeric id a plain miss (404).
function findWebhook(id: string) {
  return db.webhooks.find((webhook) => String(webhook.id) === id)
}

const notFound = () => errorResponse(404, 'Webhook not found.')

export const webhookHandlers = [
  http.get('*/v1/webhooks', ({ request }) => {
    const denied = requireSession()
    if (denied) return denied

    const searchParams = new URL(request.url).searchParams
    const { page, limit, search } = listQuerySchema.parse(Object.fromEntries(searchParams))
    const needle = search.toLowerCase()
    const matches = db.webhooks
      .filter((webhook) => webhook.name.toLowerCase().includes(needle))
      .sort((a, b) => a.id - b.id)

    return HttpResponse.json({
      data: matches.slice((page - 1) * limit, page * limit),
      paging: {
        pages: { current: page, last: Math.max(1, Math.ceil(matches.length / limit)) },
        results: { total: matches.length, limitation: limit },
      },
    })
  }),

  http.get<{ id: string }>('*/v1/webhooks/:id', ({ params }) => {
    const denied = requireSession()
    if (denied) return denied

    const webhook = findWebhook(params.id)
    return webhook ? HttpResponse.json(webhook) : notFound()
  }),

  http.put<{ id: string }>('*/v1/webhooks/:id', async ({ request, params }) => {
    const denied = requireCsrf(request) ?? requireSession()
    if (denied) return denied

    const webhook = findWebhook(params.id)
    if (!webhook) return notFound()

    const body = updateSchema.safeParse(await readJson(request))
    if (!body.success) return validationErrorResponse(body.error)

    Object.assign(webhook, body.data)
    return HttpResponse.json(webhook)
  }),
]
