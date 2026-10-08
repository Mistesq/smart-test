import { HttpResponse } from 'msw'
import type { z } from 'zod'

const ERROR_TYPES = {
  400: 'BadRequestException',
  401: 'AuthenticationException',
  404: 'NotFoundException',
  419: 'TokenMismatchException',
  422: 'ValidationException',
} as const

type ErrorStatus = keyof typeof ERROR_TYPES

type FieldErrors = Record<string, string[]>

export function errorResponse(status: ErrorStatus, message: string, payload?: FieldErrors) {
  return HttpResponse.json(
    { error: { type: ERROR_TYPES[status], message, ...(payload && { payload }) } },
    { status },
  )
}

export function validationErrorResponse(error: z.ZodError) {
  const payload: FieldErrors = {}
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'body')
    payload[field] = [...(payload[field] ?? []), issue.message]
  }
  return errorResponse(422, 'The given data was invalid.', payload)
}
