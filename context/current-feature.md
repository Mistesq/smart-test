# Current Feature: API Phase 1 - HTTP Client, CSRF & Typed Errors

<!-- H1 gets the feature name when active, e.g. "# Current Feature: Add Navbar" -->

## Status

<!-- Not Started | In Progress | Complete -->

In Progress

## Goals

<!-- Checklist of what success looks like, filled by `/feature load`. Each goal is checked off when done, so the list doubles as plan vs actual. -->

- [x] `request()` in `src/api/httpClient.ts`: method, path, optional JSON body and query, Zod response schema; success body parsed with the schema, 204 → `undefined`
- [x] Every request sends `X-Requested-With: XMLHttpRequest`
- [x] `src/api/csrf.ts`: `ensureCsrfToken()` single-flight (first request triggers exactly one `GET /csrf`, parallel requests share it), token cached in memory, `resetCsrfToken()`
- [x] POST and PUT attach `X-CSRF-TOKEN`
- [x] 419 → drop cached token, fetch a new one, retry ONCE; a second 419 throws
- [x] `src/api/errors.ts`: `ApiError` (`status`, `type`, `message`, `fieldErrors: Record<string, string[]>`) parsed from the envelope with Zod; unparseable body → `ApiError` with a generic message; `NetworkError` for network failures; `isApiError()`
- [x] Configurable base URL (empty in the browser, absolute in tests)
- [x] Typed extension point for 401 handling (no 401 logic yet)
- [x] Unit tests in `src/api/httpClient.test.ts` against MSW handlers
- [x] `npm test`, `npm run typecheck`, `npm run lint` pass

## Notes

<!-- Additional context, constraints, API contract, out of scope. -->

- Spec: `context/features/api-phase-1-spec.md`
- Envelope: `{ error: { type, message, payload? } }`, `payload: Record<field, string[]>` on 422. Error types: 400 `BadRequestException`, 401 `AuthenticationException`, 404 `NotFoundException`, 419 `TokenMismatchException`, 422 `ValidationException`
- `GET /csrf` → 204 + `X-CSRF-TOKEN` header. Mock checks CSRF on POST/PUT only, before the operation
- `API_BASE_URL` already exists in `src/api/config.ts` (`'http://localhost'` in test mode, `''` otherwise)
- `erasableSyntaxOnly`: no constructor parameter properties or enums in `ApiError`; plain fields and `as const` unions
- No `any`: `request<T>` infers `T` from the Zod schema (`z.infer`)
- Retry counters per request call (flag/attempt number), never global
- Zod 4 API differs from v3: verify with Context7
- Out of scope: 401 handling / rotate / generation counter (API phase 2), endpoint functions, React hooks
- Decisions (agreed before start):
  - A success body that fails the schema → `ApiError` with type `InvalidResponse` and a generic message
  - `ApiError.type`: the 5 server exception names, else `UnknownError` (also for a missing/broken envelope)
  - `resetCsrfToken()` runs in `afterEach` in `src/test/setup.ts`, next to `resetDb()`
  - Base URL: the existing `API_BASE_URL`, no setter
  - 401 hook: `configureHttpClient({ getRequestContext, onUnauthorized })`, returns a remover. `getRequestContext()` runs right before each send (phase 2 returns the session generation); `onUnauthorized(context, { method, path, isRetry })` gets the context of the send that got 401. The one-retry limit lives in `request()`: on the retry's 401 the hook is still called (`isRetry: true`, so phase 2 can end the session) but `request()` throws whatever it returns
  - 419 and 401 retry flags are separate locals of each `request()` call
  - On 419, `invalidateCsrfToken(rejected)` clears the cache only if it still holds the rejected token, so parallel 419s share one refetch
- Decisions after the code-scanner audit:
  - M1: the body is serialized once in `request()`, before any network call. A body that cannot be serialized throws its own `TypeError` (a bug), not a `NetworkError`
  - M2: a throwing `getRequestContext` or a rejecting `onUnauthorized` counts as `'fail'`, so `request()` throws the original 401 `ApiError`. Phase 2 handles its own failures (e.g. ending the session) inside the hook
  - L5: `resetHttpClient()` removes the 401 hook; it runs in `afterEach` in `src/test/setup.ts`
  - L3 (accepted): a 2xx body stream that fails mid-read is reported as `InvalidResponse`, not `NetworkError`. It cannot happen with MSW and is rare in practice
  - L4 (accepted): a 419 on GET also refetches the token and retries once, though GET does not send it. The contract never returns 419 on GET, and the extra retry is harmless
- Testing steps (`src/api/httpClient.test.ts`):
  1. Any request carries `X-Requested-With: XMLHttpRequest` (assert inside a handler)
  2. Two parallel first requests → `/csrf` hit exactly once
  3. POST carries `X-CSRF-TOKEN`; GET does not need it
  4. 419 once → client refetches CSRF and the retry succeeds; 419 twice → `ApiError` with status 419
  5. 422 envelope → `ApiError.fieldErrors` equals the payload; broken JSON body → generic `ApiError`

## History

<!-- Completed features, append only, oldest to newest. -->

- Project setup and boilerplate cleanup
- Setup Phase 1: app shell (MUI theme, QueryClient without retries, router with placeholder pages and not-found page), MSW worker in dev and production builds with an on-page error if it fails to start, msw/node test server, Vitest config with smoke test, typecheck/test scripts, `API_BASE_URL`, scaffold demo and assets removed
- Mock Phase 1: in-memory db (user, 28 webhooks, 30 s session, device tokens bound to the login fingerprint, `resetDb()` after every test), error envelope and 422 field-error helpers, `requireCsrf` (419) and `requireSession` (401) guards, `/csrf`, `/auth/login`, `/auth/token/issue|rotate|revoke` and `/v1/me` handlers, handler tests per testing rule plus device token reuse and issue fingerprint mismatch
- Mock Phase 2: `GET /v1/webhooks` (session check, Zod-parsed page/limit/search with fallback to defaults and limit capped at 100, case-insensitive name search, stable order by id, `last = max(1, ceil(total / limit))`), `GET /v1/webhooks/{id}` (401/404/200, non-numeric id → 404), `PUT /v1/webhooks/{id}` (CSRF → session → id → validation → update; trimmed name required, http/https url via `z.httpUrl()`, Laravel-style 422 field payload, 404 for an unknown id outside the brief's contract, to be noted in README), handler tests; spec testing steps switched to search words present in the seed ("order", "ate")
