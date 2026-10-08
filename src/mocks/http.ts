import { db } from './db.ts'
import { errorResponse } from './errors.ts'

export const CSRF_TOKEN = 'mock-csrf-token'

// A missing or malformed body is treated as empty, so the schema reports the missing fields.
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return {}
  }
}

// Guards return an error response to send instead of running the handler, or null to continue.
export function requireCsrf(request: Request) {
  return request.headers.get('X-CSRF-TOKEN') === CSRF_TOKEN
    ? null
    : errorResponse(419, 'CSRF token mismatch.')
}

export function requireSession() {
  return db.session && Date.now() < db.session.expiresAt
    ? null
    : errorResponse(401, 'Unauthenticated.')
}
