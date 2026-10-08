import { z } from 'zod'

export const DEFAULT_REDIRECT = '/webhooks'
const LOGIN_PATH = '/login'

// Location state the protected route passes to the login page: where to return after signing in.
const redirectStateSchema = z.object({
  from: z.object({
    pathname: z.string().startsWith('/'),
    search: z.string().refine((search) => search === '' || search.startsWith('?')),
  }),
})

export type RedirectState = z.infer<typeof redirectStateSchema>

export function createRedirectState(pathname: string, search: string): RedirectState {
  return { from: { pathname, search } }
}

// History state is untyped, so it is validated; anything unexpected falls back to the webhook list.
export function getRedirectTarget(state: unknown): string {
  const parsed = redirectStateSchema.safeParse(state)
  if (!parsed.success) return DEFAULT_REDIRECT
  const { pathname, search } = parsed.data.from
  // '//host' would leave the app; returning to the login page would loop.
  if (pathname.startsWith('//') || pathname === LOGIN_PATH) return DEFAULT_REDIRECT
  return pathname + search
}
