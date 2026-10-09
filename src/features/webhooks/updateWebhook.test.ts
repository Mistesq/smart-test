import { beforeEach, describe, expect, it } from 'vitest'
import { issueSession, login } from '../../api/auth.ts'
import { ApiError } from '../../api/errors.ts'
import { updateWebhook } from '../../api/webhooks.ts'
import { mapFormError } from '../../lib/formErrors.ts'
import { USER, USER_PASSWORD } from '../../mocks/db.ts'
import { WEBHOOK_FIELDS } from './webhookFormSchema.ts'

beforeEach(async () => {
  await issueSession(await login({ email: USER.email, password: USER_PASSWORD }))
})

async function submitError(input: { name: string; url: string }): Promise<unknown> {
  return updateWebhook(1, input).then(
    () => expect.fail('expected the update to be rejected'),
    (error: unknown) => error,
  )
}

describe('webhook edit 422 path', () => {
  it('maps a server-rejected URL to the url field', async () => {
    const error = await submitError({ name: 'Order created', url: 'ftp://x' })

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, type: 'ValidationException' })
    expect(mapFormError(error, WEBHOOK_FIELDS)).toEqual({
      fieldErrors: { url: 'The url must be a valid URL.' },
      formError: null,
    })
  })

  it('maps errors for both fields at once', async () => {
    const error = await submitError({ name: ' ', url: 'not a url' })

    const { fieldErrors, formError } = mapFormError(error, WEBHOOK_FIELDS)
    expect(fieldErrors).toEqual({ name: expect.any(String), url: expect.any(String) })
    expect(formError).toBeNull()
  })
})
