import type { RequestHandler } from 'msw'
import { authHandlers } from './handlers/auth.ts'
import { webhookHandlers } from './handlers/webhooks.ts'

// Paths use a '*' origin ('*/csrf'), so they match both the browser origin and the Node test base URL.
export const handlers: RequestHandler[] = [...authHandlers, ...webhookHandlers]
