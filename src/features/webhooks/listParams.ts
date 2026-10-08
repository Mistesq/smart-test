import { z } from 'zod'

export const DEFAULT_PAGE = 1

// Invalid params fall back to defaults instead of failing the page (A9). The search is trimmed,
// so the URL value and the value the search input compares against are always the same shape.
const listParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(DEFAULT_PAGE),
  search: z.string().trim().catch(''),
})

export type ListParams = z.infer<typeof listParamsSchema>

// Location state a list row passes to the edit page, so it can return to the same page and search.
export type ListLinkState = {
  listSearch: string
}

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
