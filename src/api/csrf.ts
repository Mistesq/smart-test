import { API_BASE_URL, BASE_HEADERS } from './config.ts'
import { invalidResponseError, NetworkError, parseApiError } from './errors.ts'

let cachedToken: string | null = null
let inFlight: Promise<string> | null = null

async function loadCsrfToken(): Promise<string> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/csrf`, { headers: BASE_HEADERS })
  } catch (error) {
    throw new NetworkError(error)
  }
  if (!response.ok) {
    throw parseApiError(response.status, await response.json().catch(() => undefined))
  }
  const token = response.headers.get('X-CSRF-TOKEN')
  if (!token) throw invalidResponseError(response.status)
  return token
}

// Single flight: parallel callers share one GET /csrf, later callers get the cached token.
export function ensureCsrfToken(): Promise<string> {
  if (cachedToken) return Promise.resolve(cachedToken)
  if (inFlight) return inFlight

  const pending: Promise<string> = loadCsrfToken()
    .then((token) => {
      // A reset while loading makes this result stale, so it is not cached.
      if (inFlight === pending) cachedToken = token
      return token
    })
    .finally(() => {
      if (inFlight === pending) inFlight = null
    })
  inFlight = pending
  return pending
}

// Called on 419 with the token that was rejected. If another request already replaced it,
// the cache is kept, so parallel 419s share one refetch instead of each starting their own.
export function invalidateCsrfToken(rejectedToken: string): void {
  if (cachedToken === rejectedToken) cachedToken = null
}

export function resetCsrfToken(): void {
  cachedToken = null
  inFlight = null
}
