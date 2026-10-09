import { useQuery } from '@tanstack/react-query'
import { getWebhook } from '../../api/webhooks.ts'

// A separate root from the list key, so invalidating the lists after an edit leaves the detail cache alone.
export function webhookQueryKey(id: number) {
  return ['webhook', id] as const
}

export function useWebhook(id: number) {
  return useQuery({ queryKey: webhookQueryKey(id), queryFn: () => getWebhook(id) })
}
