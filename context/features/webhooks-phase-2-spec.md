# Webhooks Phase 2 - Edit Form with Server Errors

## Overview

The edit page for a webhook's name and URL: loads by id, validates on the client, saves via PUT, and shows server validation errors next to the matching fields.

## Requirements

- Route `/webhooks/:id/edit` (A1): `useWebhook(id)` query (`['webhook', id]`). Loading state; 404 → "Webhook not found" with a link back; other errors → `Alert` + Retry
- Form: react-hook-form + `zodResolver` (A11): client checks only that `name` and `url` are not empty (trimmed). The http/https URL rule is server-only. Default values from the loaded webhook
- `useUpdateWebhook` mutation → `updateWebhook(id, body)`. Save disabled while submitting or when the form is not dirty
- 422 → shared field-error mapper → `setError` on `name` / `url` (first message per field). Payload keys that are not form fields → form-level `Alert`. Other errors → form-level `Alert`
- Success (A10): `setQueryData(['webhook', id], updated)`, invalidate `['webhooks']`, navigate back to the list with its original search string
- Cancel → back to the list with its original search string. Direct visit without list params → `/webhooks`
- Test the 422 path end to end without UI: `updateWebhook` against the mock with an invalid URL → `ApiError` 422 → mapper returns `{ url: '...' }`

## Files to Create

1. `src/features/webhooks/WebhookEditPage.tsx`
2. `src/features/webhooks/webhookFormSchema.ts`
3. `src/features/webhooks/useWebhook.ts`, `useUpdateWebhook.ts`
4. `src/features/webhooks/updateWebhook.test.ts`
5. Update `src/app/router.tsx`

## Notes

- The URL format rule is deliberately NOT on the client, so the server 422 path is visible in the UI. The server stays the source of truth
- Reuse the field-error mapper from auth phase 1. Do not write a second one
- Validate the `id` route param (Zod) before calling the API

## Testing

1. From `/webhooks?page=2&search=hook`, click a row → edit page with name and URL filled
2. Clear the name → client error under Name, no request sent. URL `ftp://x` → request is sent → 422 → server message shown under the URL field
3. Change the name → Save → back on `/webhooks?page=2&search=hook` with the new name in the table
4. `/webhooks/9999/edit` → not-found message with a working link back
5. Wait 30 s, then Save → PUT 401 → one rotate → PUT retried → success
6. `npm test` (422 mapping test), `npm run typecheck`, `npm run lint` pass

## References

- react-hook-form `setError` / `reset`: https://react-hook-form.com/docs/useform
- TanStack Query invalidation from mutations: https://tanstack.com/query/v5/docs/framework/react/guides/invalidations-from-mutations
- Zod 4 string formats: https://zod.dev/api
