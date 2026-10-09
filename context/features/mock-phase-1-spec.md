# Mock Phase 1 - In-Memory DB, CSRF & Auth Handlers

## Overview

Implement the mock backend's state and the CSRF/auth part of the contract with MSW, including the 30-second session that later client specs depend on.

## Requirements

- `src/mocks/db.ts`: one user (`admin@example.com` / `password123`, A3), 28 deterministic webhooks with some inactive (A13), session `{ fingerprint, expiresAt } | null`, a set of issued device tokens, and `resetDb()` for tests
- `src/mocks/errors.ts`: one helper that builds the error envelope `{ error: { type, message, payload? } }` for 400/401/404/419/422
- CSRF guard: fixed token, checked on every POST and PUT BEFORE the operation. Missing or wrong → 419 `TokenMismatchException`
- Login: requires a non-empty `X-Captcha-Token` header. Missing header, bad body or wrong credentials → 422 with field errors (wrong password → `password` field)
- Issue: known, unused device token + fingerprint → session starts (`expiresAt = now + 30s`), token is consumed. Otherwise 422
- Rotate: returns 200 even when the session has expired, as long as it was issued and not revoked; renews `expiresAt` to now + 30 s. Returns 400 only before a successful issue, after revoke, or on a fingerprint mismatch (A6)
- Revoke: always 204. Clears the session when the fingerprint matches
- `requireSession()` helper: 401 `AuthenticationException` when there is no session or `now >= expiresAt`. Used by `/v1/me` and all `/v1/*` handlers

## Route Contract

| Method | Path | Input | Responses |
|---|---|---|---|
| GET | `/csrf` | - | 204, header `X-CSRF-TOKEN` |
| POST | `/auth/login` | `{ email, password, fingerprint }` + `X-Captcha-Token` | 200 `{ device_session_token }` \| 419 \| 422 |
| POST | `/auth/token/issue` | `{ device_session_token, fingerprint }` | 200 \| 419 \| 422 |
| POST | `/auth/token/rotate` | `{ fingerprint }` | 200 \| 400 \| 419 |
| POST | `/auth/token/revoke` | `{ fingerprint }` | 204 \| 419 |
| GET | `/v1/me` | - | 200 `{ id, email, first_name, last_name, name }` \| 401 |

## Notes

- MSW 2 API: `http`, `HttpResponse` from `msw`. Verify with Context7
- Use `Date.now()` for all session time checks, so tests can move time with Vitest fake timers. TTL as a constant `SESSION_TTL_MS = 30_000`
- Validate request bodies with Zod inside handlers. Never trust the client
- Mock state lives in the page (MSW runs handlers in the client), so a reload resets it. That is expected per the spec
- Do not add the session token to responses or headers: the client never sees it

## Testing

Run `npm run dev`, open the app, and in the browser console:

1. `await fetch('/csrf')` → 204, `res.headers.get('X-CSRF-TOKEN')` is set
2. POST `/auth/login` without `X-CSRF-TOKEN` → 419. With it but without `X-Captcha-Token` → 422
3. POST `/auth/login` with a wrong password → 422, `error.payload.password` present. With correct data → 200 `{ device_session_token }`
4. `/auth/token/rotate` before issue → 400. Issue → 200. `GET /v1/me` → 200 user
5. Wait 30 s → `GET /v1/me` → 401. Rotate → 200 → `/v1/me` → 200
6. Rotate with a different fingerprint → 400. Revoke → 204. Rotate → 400

## References

- MSW request handlers: https://mswjs.io/docs/basics/intercepting-requests
- MSW mocking responses: https://mswjs.io/docs/basics/mocking-responses
