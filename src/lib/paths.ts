export const LOGIN_PATH = '/login'
export const WEBHOOKS_PATH = '/webhooks'
export const WEBHOOK_EDIT_ROUTE = `${WEBHOOKS_PATH}/:id/edit`

export function webhookEditPath(id: number): string {
  return `${WEBHOOKS_PATH}/${id}/edit`
}
