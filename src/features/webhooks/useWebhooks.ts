import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getWebhooks } from '../../api/webhooks.ts'
import type { ListParams } from './listParams.ts'

export const WEBHOOKS_PAGE_SIZE = 10

// Root of every webhook list key, for invalidation after an edit.
export const WEBHOOKS_QUERY_KEY = ['webhooks'] as const

export function useWebhooks({ page, search }: ListParams) {
  return useQuery({
    queryKey: [...WEBHOOKS_QUERY_KEY, { page, search }],
    queryFn: () => getWebhooks({ page, search, limit: WEBHOOKS_PAGE_SIZE }),
    // The previous page stays on screen while the next one loads, so the table does not flash.
    placeholderData: keepPreviousData,
  })
}
