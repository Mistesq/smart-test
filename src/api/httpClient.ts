import type { z } from 'zod'
import { API_BASE_URL, BASE_HEADERS } from './config.ts'
import { ensureCsrfToken, invalidateCsrfToken } from './csrf.ts'
import { invalidResponseError, NetworkError, parseApiError } from './errors.ts'

export type HttpMethod = 'GET' | 'POST' | 'PUT'

export type QueryParams = Record<string, string | number | undefined>

export type RequestOptions<S extends z.ZodType> = {
  method?: HttpMethod
  path: string
  query?: QueryParams
  body?: unknown
  // Extra request headers; they cannot override the client's own headers.
  headers?: Record<string, string>
  // Parses the success body; a 204 response is parsed as `undefined`.
  schema: S
}

export type UnauthorizedDecision = 'retry' | 'fail'

export type UnauthorizedInfo = {
  method: HttpMethod
  path: string
  // True when the 401 came from the retry; request() then throws whatever the hook decides.
  isRetry: boolean
}

// Extension point for 401 handling (session rotate). `getRequestContext` runs right before every send;
// `onUnauthorized` gets the context of the send that came back with 401.
export type UnauthorizedHandler<Context> = {
  getRequestContext: () => Context
  onUnauthorized: (context: Context, info: UnauthorizedInfo) => Promise<UnauthorizedDecision>
}

type BoundUnauthorizedHandler = (info: UnauthorizedInfo) => Promise<UnauthorizedDecision>

// Binds the context at send time, so the stored handler does not depend on the Context type.
let prepareUnauthorizedHandler: (() => BoundUnauthorizedHandler) | null = null

// Installs the 401 handler and returns a function that removes it.
// A throwing hook counts as 'fail', so request() still throws the original 401 ApiError.
export function configureHttpClient<Context>(handler: UnauthorizedHandler<Context>): () => void {
  const prepare = (): BoundUnauthorizedHandler => {
    let context: Context
    try {
      context = handler.getRequestContext()
    } catch {
      return async () => 'fail'
    }
    return async (info) => {
      try {
        return await handler.onUnauthorized(context, info)
      } catch {
        return 'fail'
      }
    }
  }
  prepareUnauthorizedHandler = prepare
  return () => {
    if (prepareUnauthorizedHandler === prepare) prepareUnauthorizedHandler = null
  }
}

export function resetHttpClient(): void {
  prepareUnauthorizedHandler = null
}

function buildUrl(path: string, query?: QueryParams): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value))
  }
  const search = params.toString()
  return `${API_BASE_URL}${path}${search ? `?${search}` : ''}`
}

type SendOptions = {
  method: HttpMethod
  url: string
  json: string | undefined
  extraHeaders: Record<string, string> | undefined
  csrfToken: string
}

async function send({ method, url, json, extraHeaders, csrfToken }: SendOptions): Promise<Response> {
  // Header names are case-insensitive, so set() replaces an extra header in any letter case.
  const headers = new Headers(extraHeaders)
  for (const [name, value] of Object.entries(BASE_HEADERS)) headers.set(name, value)
  headers.set('Accept', 'application/json')
  if (method !== 'GET') headers.set('X-CSRF-TOKEN', csrfToken)
  if (json !== undefined) headers.set('Content-Type', 'application/json')

  try {
    return await fetch(url, { method, headers, body: json })
  } catch (error) {
    throw new NetworkError(error)
  }
}

function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined)
}

async function parseSuccess<S extends z.ZodType>(response: Response, schema: S): Promise<z.output<S>> {
  const body = response.status === 204 ? undefined : await readJson(response)
  const result = schema.safeParse(body)
  if (!result.success) throw invalidResponseError(response.status)
  return result.data
}

// The only place that talks to the API. Retry limits are local to each call:
// one retry after 419 (fresh CSRF token) and one after 401 (when the handler asks for it).
export async function request<S extends z.ZodType>(options: RequestOptions<S>): Promise<z.output<S>> {
  const { method = 'GET', path, query, body, headers, schema } = options
  const url = buildUrl(path, query)
  // Serialized before any network call: a body that cannot be serialized is a bug, not a network failure.
  const json = body === undefined ? undefined : JSON.stringify(body)
  let csrfRetried = false
  let unauthorizedRetried = false

  for (;;) {
    const csrfToken = await ensureCsrfToken()
    const onUnauthorized = prepareUnauthorizedHandler?.()
    const response = await send({ method, url, json, extraHeaders: headers, csrfToken })
    if (response.ok) return parseSuccess(response, schema)

    const error = parseApiError(response.status, await readJson(response))

    if (response.status === 419 && !csrfRetried) {
      csrfRetried = true
      invalidateCsrfToken(csrfToken)
      continue
    }
    if (response.status === 401 && onUnauthorized) {
      const decision = await onUnauthorized({ method, path, isRetry: unauthorizedRetried })
      if (decision === 'retry' && !unauthorizedRetried) {
        unauthorizedRetried = true
        continue
      }
    }
    throw error
  }
}
