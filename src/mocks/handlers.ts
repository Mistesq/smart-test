import type { RequestHandler } from 'msw'

// Paths use a '*' origin ('*/csrf'), so they match both the browser origin and the Node test base URL.
export const handlers: RequestHandler[] = []
