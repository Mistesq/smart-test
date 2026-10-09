import { z } from 'zod'
import { parseListLinkState, type ListLinkState } from '../../lib/listLinkState.ts'
import { LOGIN_PATH, WEBHOOKS_PATH } from '../../lib/paths.ts'

// Location state the protected route passes to the login page: where to return after signing in.
const redirectStateSchema = z.object({
  from: z.object({
    pathname: z.string().startsWith('/'),
    search: z.string().refine((search) => search === '' || search.startsWith('?')),
    // Validated separately, so a broken value is dropped without losing the path.
    listLink: z.unknown(),
  }),
})

export type RedirectState = z.infer<typeof redirectStateSchema>

export type RedirectTarget = {
  to: string
  // The edit page's list context, restored with the page so Save and Cancel return to the same list.
  state?: ListLinkState
}

// routerState is the protected page's own location state; only a valid list link state is kept.
export function createRedirectState(pathname: string, search: string, routerState?: unknown): RedirectState {
  return { from: { pathname, search, listLink: parseListLinkState(routerState) ?? undefined } }
}

// History state is untyped, so it is validated; anything unexpected falls back to the webhook list.
export function getRedirectTarget(state: unknown): RedirectTarget {
  const parsed = redirectStateSchema.safeParse(state)
  if (!parsed.success) return { to: WEBHOOKS_PATH }
  const { pathname, search, listLink } = parsed.data.from
  // '//host' would leave the app; returning to the login page would loop.
  if (pathname.startsWith('//') || pathname === LOGIN_PATH) return { to: WEBHOOKS_PATH }
  return { to: pathname + search, state: parseListLinkState(listLink) ?? undefined }
}
