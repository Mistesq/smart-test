# Current Feature: Mock Phase 1 - In-Memory DB, CSRF & Auth Handlers

<!-- H1 gets the feature name when active, e.g. "# Current Feature: Add Navbar" -->

## Status

<!-- Not Started | In Progress | Complete -->

In Progress

## Goals

<!-- Checklist of what success looks like, filled by `/feature load`. Each goal is checked off when done, so the list doubles as plan vs actual. -->

- [x] `src/mocks/db.ts`: one user (`admin@example.com` / `password123`), 28 deterministic webhooks with some inactive, session `{ fingerprint, expiresAt } | null`, issued device tokens (`Map` of token → login fingerprint), `resetDb()` for tests
- [x] `src/mocks/errors.ts`: one helper building the error envelope `{ error: { type, message, payload? } }` for 400/401/404/419/422
- [x] CSRF guard: fixed token, checked on every POST and PUT before the operation; missing or wrong → 419 `TokenMismatchException`
- [x] `GET /csrf` → 204 with `X-CSRF-TOKEN` header
- [x] `POST /auth/login`: requires non-empty `X-Captcha-Token`; missing header, bad body or wrong credentials → 422 with field errors (wrong password → `password` field); success → 200 `{ device_session_token }`
- [x] `POST /auth/token/issue`: known, unused device token + fingerprint → session starts (`expiresAt = now + 30s`), token consumed; otherwise 422
- [x] `POST /auth/token/rotate`: 200 even when the session expired (if issued and not revoked), renews `expiresAt` to now + 30 s; 400 only before a successful issue, after revoke, or on fingerprint mismatch
- [x] `POST /auth/token/revoke`: always 204; clears the session when the fingerprint matches
- [x] `requireSession()` helper: 401 `AuthenticationException` when no session or `now >= expiresAt`; used by `/v1/me` and all `/v1/*` handlers
- [x] `GET /v1/me` → 200 `{ id, email, first_name, last_name, name }` | 401
- [x] Handlers registered in shared `handlers.ts` (browser worker + msw/node)
- [x] Unit tests for the handlers via msw/node; typecheck, lint and tests pass

## Notes

<!-- Additional context, constraints, API contract, out of scope. -->

Route contract:

| Method | Path | Input | Responses |
|---|---|---|---|
| GET | `/csrf` | - | 204, header `X-CSRF-TOKEN` |
| POST | `/auth/login` | `{ email, password, fingerprint }` + `X-Captcha-Token` | 200 `{ device_session_token }` \| 419 \| 422 |
| POST | `/auth/token/issue` | `{ device_session_token, fingerprint }` | 200 \| 419 \| 422 |
| POST | `/auth/token/rotate` | `{ fingerprint }` | 200 \| 400 \| 419 |
| POST | `/auth/token/revoke` | `{ fingerprint }` | 204 \| 419 |
| GET | `/v1/me` | - | 200 `{ id, email, first_name, last_name, name }` \| 401 |

Constraints and gotchas:

- MSW 2 API: `http`, `HttpResponse` from `msw`. Verify against the installed version (Context7)
- Handler paths use a `*` origin (`'*/csrf'`), see coding standards
- Use `Date.now()` for all session time checks so tests can move time with Vitest fake timers. TTL constant `SESSION_TTL_MS = 30_000`
- Validate request bodies with Zod inside handlers. Never trust the client
- Order inside POST handlers: CSRF guard first (419), then captcha/body/credentials (422)
- Session record stays after expiry (only `expiresAt` is in the past), so rotate can tell "expired" from "never issued / revoked"
- Mock state lives in the page, so a reload resets it. Expected per the brief
- Never put the session token in responses or headers: the client never sees it

Decisions (agreed before start):

- Unknown email gets the same 422 on `password` as a wrong password (no email enumeration)
- Missing `X-Captcha-Token` → 422 with a message only, no field payload (form-level error)
- Device token is bound to the login fingerprint; issue with another fingerprint → 422
- Issue and rotate return 200 with an empty JSON `{}`
- Handlers split per area in `src/mocks/handlers/` (`auth.ts` now), combined in `handlers.ts`
- Mock tests are short: one per Testing step rule, plus two for issue (device token reuse → 422, other fingerprint → 422)

Out of scope: webhook list/detail/update handlers (mock-phase-2), any client code (api-phase-1+).

Manual testing (`npm run dev`, browser console):

1. `await fetch('/csrf')` → 204, `res.headers.get('X-CSRF-TOKEN')` is set
2. POST `/auth/login` without `X-CSRF-TOKEN` → 419. With it but without `X-Captcha-Token` → 422
3. POST `/auth/login` with a wrong password → 422, `error.payload.password` present. With correct data → 200 `{ device_session_token }`
4. `/auth/token/rotate` before issue → 400. Issue → 200. `GET /v1/me` → 200 user
5. Wait 30 s → `GET /v1/me` → 401. Rotate → 200 → `/v1/me` → 200
6. Rotate with a different fingerprint → 400. Revoke → 204. Rotate → 400

## History

<!-- Completed features, append only, oldest to newest. -->

- Project setup and boilerplate cleanup
- Setup Phase 1: app shell (MUI theme, QueryClient without retries, router with placeholder pages and not-found page), MSW worker in dev and production builds with an on-page error if it fails to start, msw/node test server, Vitest config with smoke test, typecheck/test scripts, `API_BASE_URL`, scaffold demo and assets removed
