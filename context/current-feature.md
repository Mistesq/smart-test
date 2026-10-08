# Current Feature: API Phase 2 - Session Rotate & Auth Endpoints

<!-- H1 gets the feature name when active, e.g. "# Current Feature: Add Navbar" -->

## Status

<!-- Not Started | In Progress | Complete -->

Complete

## Goals

<!-- Checklist of what success looks like, filled by `/feature load`. Each goal is checked off when done, so the list doubles as plan vs actual. -->

- [x] `src/api/fingerprint.ts`: get-or-create 32 hex chars (16 bytes from `crypto.getRandomValues`, A5), stored in localStorage under one key; storage injectable or mockable for Node tests
- [x] `src/api/auth.ts`: `login` (sends `X-Captcha-Token: test-captcha`, A4), `issueSession`, `rotateSession`, `revokeSession`, `getMe`; all send `fingerprint` per the contract; `User` Zod schema
- [x] 401 on a non-`/auth/*` request → await the shared rotate, then retry ONCE; `/auth/*` requests skip the handler, so rotate never triggers rotate
- [x] Shared rotate: one module-level in-flight promise; N parallel 401s → exactly one `POST /auth/token/rotate`
- [x] Session generation counter: each request remembers the generation it was sent under; a 401 for an older generation retries without a new rotate
- [x] Rotate failure (400 or any error) or a 401 on the retry → call the registered session-expired handler ONCE per expiry and reject with the 401 `ApiError`
- [x] `setSessionExpiredHandler(fn)`: registration API for the auth UI (no React imports in `src/api/`)
- [x] `src/api/session.ts` plugs into the existing `configureHttpClient({ getRequestContext, onUnauthorized })` extension point in `src/api/httpClient.ts`
- [x] Required test plus failure-path tests in `src/api/session.test.ts`

## Notes

<!-- Additional context, constraints, API contract, out of scope. -->

Files: `src/api/session.ts` (shared rotate, generation counter, expired handler), `src/api/fingerprint.ts`, `src/api/auth.ts` (+ `User` schema), `src/api/session.test.ts`, update `src/api/httpClient.ts` only if the existing 401 extension point is not enough.

Contract (from the mock):

- `POST /auth/login` `{ email, password, fingerprint }` + header `X-Captcha-Token` → 200 `{ device_session_token }` | 422
- `POST /auth/token/issue` `{ device_session_token, fingerprint }` → 200 `{}` | 422
- `POST /auth/token/rotate` `{ fingerprint }` → 200 `{}` | 400 (only before issue, after revoke, or fingerprint mismatch; succeeds on an expired session)
- `POST /auth/token/revoke` `{ fingerprint }` → 204
- `GET /v1/me` → 200 `User { id, email, first_name, last_name, name }` | 401

Constraints and gotchas:

- The required test is graded: name it clearly, e.g. `two parallel 401s share one rotate and both retries succeed`. Use the real mock handlers: `resetDb()` → login → issue → move time past 30 s → two parallel `GET /v1/webhooks` (or `/v1/me`) → assert one rotate call (count in the handler or with a spy) and two 200 results
- Moving time: fake only `Date` (`vi.useFakeTimers({ toFake: ['Date'] })` or `vi.setSystemTime`) so promises and fetch keep working. Verify against Vitest 5 docs
- `device_session_token` is never stored: it is a return value passed straight into `startSession` (which calls `issueSession`)
- Retry limits are per request: at most one 419 retry and one 401 retry (already enforced by `request()`)
- Existing extension point: `getRequestContext` runs right before each send (capture the generation there), `onUnauthorized(context, { method, path, isRetry })` returns `'retry' | 'fail'`; `'fail'` makes `request()` throw the original 401 `ApiError`; a throwing hook counts as `'fail'`
- `resetHttpClient()` already runs in test setup; session state needs its own reset for tests

Decisions (agreed before start):

- `installSessionHandling()` explicitly installs the 401 hook (no import side effects) and returns the uninstall function; tests call it and uninstall in `afterEach`
- `expired` flag: once set, every further 401 fails at once (no rotate, no second handler call); a successful `startSession()` clears it and bumps the generation
- A 401 under the current generation while a rotate is in flight joins that rotate
- `isRetry: true` → no rotate, mark the session expired and return `'fail'`
- Fingerprint storage is a parameter (`getFingerprint(storage)`); tests pass an in-memory storage, no global stubs
- Edge cases in tests: rotate 400 via a real revoke; late 401 via a one-off `server.use()` override that holds one response until the rotate finishes
- The required test is named `two parallel 401s share one rotate and both retries succeed`, runs on the real mock handlers, moves time only through `Date` (`vi.setSystemTime` without fake timers mocks only `Date`, Vitest 5 docs), and asserts exactly one rotate and two 200 responses

Implementation notes (plan vs actual):

- `request()` got a `headers` option (needed for `X-Captcha-Token`); extra headers cannot override the client's own
- `startSession(deviceSessionToken)` in session.ts calls `issueSession()` and then opens a new generation, so the login flow in auth-phase-1 cannot skip that step; session.ts imports auth.ts, not the other way round, so there is no import cycle
- `installSessionHandling()` is called once in `main.tsx`; `resetSession()` added to test setup
- Fingerprint tests are co-located in `src/api/fingerprint.test.ts` (coding standards), not in `session.test.ts`
- Mutation check: with single-flight disabled, the required test and both expiry tests fail
- code-scanner audit fixes:
  - fingerprint: storage reads and writes are wrapped in try/catch, and a page-level value is kept when storage cannot save it, so `getFingerprint()` never throws and login/issue always send the same fingerprint (tests)
  - a rotate that fails after a new `startSession()` retries the request under the new generation instead of expiring the fresh session (test)
  - `send()` builds a `Headers` object and `set()`s the client headers, so extra headers cannot override them in any letter case
  - issue and rotate accept any 200 body (`z.unknown()`); the contract only promises a status
- Accepted (not fixed): uninstalling the hook mid-request, `resetSession()` during an in-flight rotate, and MSW event ordering in tests (test-only or theoretical)
- Moved to auth-phase-1 spec Notes: logout calls `endSession()`, which marks the session expired without calling the handler; the spec's login flow now uses `startSession(token)`

Out of scope: login page, protected routes, React wiring of the expired handler (auth-phase-1), webhook endpoint functions (webhooks-phase-1).

Testing (`npm test`):

1. Required: two parallel 401s → exactly one rotate → both requests resolve with 200
2. Rotate returns 400 → both requests reject with 401, expired handler called once
3. Retry also gets 401 → expired handler called, no second rotate
4. A 401 that arrives after a finished rotate (older generation) → retried without a new rotate
5. Fingerprint: 32 hex chars, same value on the second call

Also: `npm run typecheck` and `npm run lint` pass.

## History

<!-- Completed features, append only, oldest to newest. -->

- Project setup and boilerplate cleanup
- Setup Phase 1: app shell (MUI theme, QueryClient without retries, router with placeholder pages and not-found page), MSW worker in dev and production builds with an on-page error if it fails to start, msw/node test server, Vitest config with smoke test, typecheck/test scripts, `API_BASE_URL`, scaffold demo and assets removed
- Mock Phase 1: in-memory db (user, 28 webhooks, 30 s session, device tokens bound to the login fingerprint, `resetDb()` after every test), error envelope and 422 field-error helpers, `requireCsrf` (419) and `requireSession` (401) guards, `/csrf`, `/auth/login`, `/auth/token/issue|rotate|revoke` and `/v1/me` handlers, handler tests per testing rule plus device token reuse and issue fingerprint mismatch
- Mock Phase 2: `GET /v1/webhooks` (session check, Zod-parsed page/limit/search with fallback to defaults and limit capped at 100, case-insensitive name search, stable order by id, `last = max(1, ceil(total / limit))`), `GET /v1/webhooks/{id}` (401/404/200, non-numeric id → 404), `PUT /v1/webhooks/{id}` (CSRF → session → id → validation → update; trimmed name required, http/https url via `z.httpUrl()`, Laravel-style 422 field payload, 404 for an unknown id outside the brief's contract, to be noted in README), handler tests; spec testing steps switched to search words present in the seed ("order", "ate")
- API Phase 1: `request()` in `src/api/httpClient.ts` (method, path, query, JSON body serialized before any network call, Zod response schema, 204 → `undefined`, schema mismatch → `InvalidResponse`), `X-Requested-With` on every request and `X-CSRF-TOKEN` on POST/PUT, single-flight `ensureCsrfToken()` with in-memory cache, 419 → `invalidateCsrfToken(rejected)` (clears only the rejected token, so parallel 419s share one refetch) + one retry, `ApiError` (`status`, `type`, `message`, `fieldErrors`; unknown/broken envelope → `UnknownError`) and `NetworkError`, 401 extension point `configureHttpClient({ getRequestContext, onUnauthorized })` (context captured right before each send, `isRetry` flag, one-retry limit in `request()`, a throwing hook counts as `'fail'`), `resetHttpClient()` and `resetCsrfToken()` in test setup; code-scanner audit fixes; accepted: a 2xx body stream failing mid-read → `InvalidResponse`, a 419 on GET also retries once; 27 client tests
