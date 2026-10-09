import { z } from 'zod'
import { parseListLinkState } from '../../lib/listLinkState.ts'
import { WEBHOOKS_PATH } from '../../lib/paths.ts'

export const DEFAULT_PAGE = 1

// Invalid params fall back to defaults instead of failing the page (A9). The search is trimmed,
// so the URL value and the value the search input compares against are always the same shape.
const listParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_PAGE),
  search: z.string().trim().catch(''),
})

export type ListParams = z.infer<typeof listParamsSchema>

export function parseListParams(searchParams: URLSearchParams): ListParams {
  return listParamsSchema.parse({
    page: searchParams.get('page') ?? undefined,
    search: searchParams.get('search') ?? undefined,
  })
}

// Defaults (page 1, empty search) are left out, so the plain list stays at a clean `/webhooks`.
export function buildListSearchParams({ page, search }: ListParams): URLSearchParams {
  const params = new URLSearchParams()
  if (page !== DEFAULT_PAGE) params.set('page', String(page))
  const term = search.trim()
  if (term) params.set('search', term)
  return params
}

// The same params as a location search string: '' or '?…'.
export function toListSearch(params: ListParams): string {
  const search = buildListSearchParams(params).toString()
  return search ? `?${search}` : ''
}

// Where the edit page goes back to. The search is rebuilt from the parsed params, so only a valid page
// and search reach the URL. No valid state → the plain list.
export function getListReturnTarget(state: unknown): string {
  const linkState = parseListLinkState(state)
  if (!linkState) return WEBHOOKS_PATH
  return WEBHOOKS_PATH + toListSearch(parseListParams(new URLSearchParams(linkState.listSearch)))
}
