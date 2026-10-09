import { z } from 'zod'

// Only presence is checked here (A11). The http/https URL rule stays on the server, which reports it as a 422.
export const webhookFormSchema = z.object({
  name: z.string().trim().min(1, { error: 'Name is required' }),
  url: z.string().trim().min(1, { error: 'URL is required' }),
})

export type WebhookFormValues = z.infer<typeof webhookFormSchema>

export const WEBHOOK_FIELDS = ['name', 'url'] as const satisfies readonly (keyof WebhookFormValues)[]

// The `:id` route param: a positive safe integer written without signs, leading zeros or exponents.
const webhookIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform(Number)
  .pipe(z.int())

export function parseWebhookId(param: string | undefined): number | null {
  const parsed = webhookIdSchema.safeParse(param)
  return parsed.success ? parsed.data : null
}
