import { z } from 'zod'

const SERVER_ERROR_TYPES = [
  'BadRequestException',
  'AuthenticationException',
  'NotFoundException',
  'TokenMismatchException',
  'ValidationException',
] as const

// UnknownError: the error body is missing, malformed or has a type we do not know.
// InvalidResponse: a success response whose body does not match the expected schema.
export type ApiErrorType = (typeof SERVER_ERROR_TYPES)[number] | 'UnknownError' | 'InvalidResponse'

export type FieldErrors = Record<string, string[]>

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'

const errorEnvelopeSchema = z.object({
  error: z.object({
    type: z.enum(SERVER_ERROR_TYPES).or(z.string().transform((): ApiErrorType => 'UnknownError')),
    message: z.string(),
    payload: z.record(z.string(), z.array(z.string())).optional(),
  }),
})

type ApiErrorInit = {
  status: number
  type: ApiErrorType
  message: string
  fieldErrors?: FieldErrors
}

export class ApiError extends Error {
  readonly status: number
  readonly type: ApiErrorType
  readonly fieldErrors: FieldErrors

  constructor({ status, type, message, fieldErrors = {} }: ApiErrorInit) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.type = type
    this.fieldErrors = fieldErrors
  }
}

// The request never got a response (offline, DNS, CORS, aborted connection).
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Network request failed. Check your connection and try again.', { cause })
    this.name = 'NetworkError'
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function parseApiError(status: number, body: unknown): ApiError {
  const envelope = errorEnvelopeSchema.safeParse(body)
  if (!envelope.success) {
    return new ApiError({ status, type: 'UnknownError', message: GENERIC_ERROR_MESSAGE })
  }
  const { type, message, payload } = envelope.data.error
  return new ApiError({ status, type, message, fieldErrors: payload })
}

export function invalidResponseError(status: number): ApiError {
  return new ApiError({ status, type: 'InvalidResponse', message: GENERIC_ERROR_MESSAGE })
}
