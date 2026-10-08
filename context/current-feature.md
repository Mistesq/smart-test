# Current Feature

<!-- H1 gets the feature name when active, e.g. "# Current Feature: Add Navbar" -->

## Status

<!-- Not Started | In Progress | Complete -->

Not Started

## Goals

<!-- Checklist of what success looks like, filled by `/feature load`. Each goal is checked off when done, so the list doubles as plan vs actual. -->

## Notes

<!-- Additional context, constraints, API contract, out of scope. -->

## History

<!-- Completed features, append only, oldest to newest. -->

- Project setup and boilerplate cleanup
- Setup Phase 1: app shell (MUI theme, QueryClient without retries, router with placeholder pages and not-found page), MSW worker in dev and production builds with an on-page error if it fails to start, msw/node test server, Vitest config with smoke test, typecheck/test scripts, `API_BASE_URL`, scaffold demo and assets removed
- Mock Phase 1: in-memory db (user, 28 webhooks, 30 s session, device tokens bound to the login fingerprint, `resetDb()` after every test), error envelope and 422 field-error helpers, `requireCsrf` (419) and `requireSession` (401) guards, `/csrf`, `/auth/login`, `/auth/token/issue|rotate|revoke` and `/v1/me` handlers, handler tests per testing rule plus device token reuse and issue fingerprint mismatch
- Mock Phase 2: `GET /v1/webhooks` (session check, Zod-parsed page/limit/search with fallback to defaults and limit capped at 100, case-insensitive name search, stable order by id, `last = max(1, ceil(total / limit))`), `GET /v1/webhooks/{id}` (401/404/200, non-numeric id → 404), `PUT /v1/webhooks/{id}` (CSRF → session → id → validation → update; trimmed name required, http/https url via `z.httpUrl()`, Laravel-style 422 field payload, 404 for an unknown id outside the brief's contract, to be noted in README), handler tests; spec testing steps switched to search words present in the seed ("order", "ate")
- API Phase 1: `request()` in `src/api/httpClient.ts` (method, path, query, JSON body serialized before any network call, Zod response schema, 204 → `undefined`, schema mismatch → `InvalidResponse`), `X-Requested-With` on every request and `X-CSRF-TOKEN` on POST/PUT, single-flight `ensureCsrfToken()` with in-memory cache, 419 → `invalidateCsrfToken(rejected)` (clears only the rejected token, so parallel 419s share one refetch) + one retry, `ApiError` (`status`, `type`, `message`, `fieldErrors`; unknown/broken envelope → `UnknownError`) and `NetworkError`, 401 extension point `configureHttpClient({ getRequestContext, onUnauthorized })` (context captured right before each send, `isRetry` flag, one-retry limit in `request()`, a throwing hook counts as `'fail'`), `resetHttpClient()` and `resetCsrfToken()` in test setup; code-scanner audit fixes; accepted: a 2xx body stream failing mid-read → `InvalidResponse`, a 419 on GET also retries once; 27 client tests
