import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { getErrorMessage, isApiError } from '../api/errors.ts'

export const FORM_ERROR_KEY = 'root.serverError'

export type FormErrorMapping<TField extends string> = {
  fieldErrors: Partial<Record<TField, string>>
  // Shown above the form: a non-422 error, a 422 without field errors, or errors for fields the form lacks.
  formError: string | null
}

// Splits an error from a form submit into messages for the form's own fields and one form-level message.
export function mapFormError<TField extends string>(
  error: unknown,
  fields: readonly TField[],
): FormErrorMapping<TField> {
  if (!isApiError(error) || error.status !== 422) {
    return { fieldErrors: {}, formError: getErrorMessage(error) }
  }

  const fieldErrors: Partial<Record<TField, string>> = {}
  const otherMessages: string[] = []
  for (const [field, messages] of Object.entries(error.fieldErrors)) {
    const message = messages[0]
    if (!message) continue
    const formField = fields.find((name) => name === field)
    if (formField) fieldErrors[formField] = message
    else otherMessages.push(message)
  }

  const hasFieldErrors = Object.keys(fieldErrors).length > 0
  const formError = otherMessages.length > 0 ? otherMessages.join(' ') : hasFieldErrors ? null : error.message
  return { fieldErrors, formError }
}

// Puts a submit error into react-hook-form: field messages under their inputs, the rest under FORM_ERROR_KEY.
export function applyFormError<TValues extends FieldValues>(
  error: unknown,
  fields: readonly Path<TValues>[],
  setError: UseFormSetError<TValues>,
): void {
  const { fieldErrors, formError } = mapFormError(error, fields)
  for (const field of fields) {
    const message = fieldErrors[field]
    if (message) setError(field, { type: 'server', message })
  }
  if (formError) setError(FORM_ERROR_KEY, { type: 'server', message: formError })
}
