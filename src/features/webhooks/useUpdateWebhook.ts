import { mutationOptions, useMutation } from '@tanstack/react-query'
import { updateWebhook, type WebhookInput } from '../../api/webhooks.ts'
import { webhookQueryKey } from './useWebhook.ts'
import { WEBHOOKS_QUERY_KEY } from './useWebhooks.ts'

// After a save the detail cache holds the server's version and every cached list page refetches when shown (A10).
export function updateWebhookOptions(id: number) {
  return mutationOptions({
    mutationFn: (input: WebhookInput) => updateWebhook(id, input),
    onSuccess: (updated, _input, _onMutateResult, { client }) => {
      client.setQueryData(webhookQueryKey(id), updated)
      // Not awaited: the lists are inactive on the edit page, and the navigation back should not wait for them.
      void client.invalidateQueries({ queryKey: WEBHOOKS_QUERY_KEY })
    },
  })
}

export function useUpdateWebhook(id: number) {
  return useMutation(updateWebhookOptions(id))
}
