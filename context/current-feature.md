# Current Feature: Webhooks Phase 1 - List with URL State

<!-- H1 gets the feature name when active, e.g. "# Current Feature: Add Navbar" -->

## Status

<!-- Not Started | In Progress | Complete -->

In Progress

## Goals

<!-- Checklist of what success looks like, filled by `/feature load`. Each goal is checked off when done, so the list doubles as plan vs actual. -->

- [x] `src/api/webhooks.ts`: `getWebhooks({ page, limit, search })`, `getWebhook(id)`, `updateWebhook(id, { name, url })` with `Webhook` / `WebhookList` Zod schemas (detail and update are used by phase 2)
- [x] `src/features/webhooks/listParams.ts`: parse `page` and `search` from `URLSearchParams` with Zod (invalid or `< 1` page → 1, missing search → `''`, A9) plus a builder that omits defaults (`page=1`, empty search) from the URL; unit tested in `listParams.test.ts`
- [x] `useWebhooks(params)`: query key `['webhooks', { page, search }]`, `limit` 10, `placeholderData: keepPreviousData`
- [x] `WebhookSearch`: debounced 300 ms, writes `search` and drops `page` with `replace: true` (A8); input re-syncs from the URL on back/forward
- [x] MUI `Pagination` (1-based): a page change pushes a new history entry; `page > pages.last` → replace with the last page (A9)
- [x] `WebhooksTable`: name, URL, active (Chip); each row links to `/webhooks/:id/edit`, passing the current list search string so the edit page can go back to it
- [x] States: loading (skeleton or progress), empty ("No webhooks found" mentioning the search), error (`Alert` + Retry via `refetch`)
- [x] `src/app/router.tsx`: `/webhooks` renders `WebhooksPage`
- [x] Dev only: `window.__msw` exposes `{ worker, http, HttpResponse }` so handlers can be overridden from the console without imports

## Notes

<!-- Additional context, constraints, API contract, out of scope. -->

**Files**: `src/api/webhooks.ts`; `src/features/webhooks/listParams.ts`, `listParams.test.ts`, `useWebhooks.ts`, `WebhooksPage.tsx`, `WebhooksTable.tsx`, `WebhookSearch.tsx`; update `src/app/router.tsx`.

**Contract**:

- `GET /v1/webhooks?page=&limit=&search=` → 200 `WebhookList` | 401
- `GET /v1/webhooks/{id}` → 200 `Webhook` | 401 | 404
- `PUT /v1/webhooks/{id}` `{ name, url }` → 200 `Webhook` | 401 | 422 (404 for an unknown id, outside the brief)
- `Webhook = { id, name, url, active, created_at }`
- `WebhookList = { data: Webhook[], paging: { pages: { current, last }, results: { total, limitation } } }`; mock: `last = max(1, ceil(total / limit))`

**Constraints and gotchas**:

- The URL is the single source of truth: no `useState` copies of `page`/`search` except the raw search input text
- Search is trimmed before it goes to the URL; the input keeps the raw text. Debounce loop guard: compare the trimmed debounced value with the URL value and skip the write when they are equal
- Row link passes the list search string via router `state` (`{ listSearch }`); the URL stays clean, and on an edit-page reload the state is lost, so the back link falls back to `/webhooks`
- TanStack Query v5: `keepPreviousData` is a helper passed to `placeholderData`. Verify with Context7
- MUI `Pagination` is 1-based; `TablePagination` is 0-based. Do not mix them
- With no results (`total = 0`, `last = 1`) page 1 stays (A9)
- Carried over from auth-phase-1: re-check the session-expiry redirect in the UI (rotate failure → login with "Your session has expired", original list URL kept)
- Console override (dev only): `__msw.worker.use(__msw.http.get('*/v1/webhooks', () => __msw.HttpResponse.json({ error: { type: 'ServerError', message: 'Boom' } }, { status: 500 })))`, then `__msw.worker.resetHandlers()` before Retry

**Review fixes**: an empty placeholder (the previous search had no results) shows the loading state instead of "No webhooks found" for the new search; browser-checked with a delayed handler (empty placeholder → spinner, non-empty placeholder → dimmed rows).

**Accepted**:

- A background refetch error on a list key that already has cached data (only on remount, `refetchOnWindowFocus` is off) replaces the table with the error `Alert`; Retry works
- A keystroke landing in the few ms while the search input's own URL write is applied can be reset to the written value (losing that character); fixing it needs extra state for a near-impossible race

**Out of scope**: edit page, client validation, 422 mapping, cache updates after save (webhooks-phase-2); README (delivery-phase-1).

**Testing steps** (review checks against them):

1. `/webhooks` → 10 rows, 3 pages. Page 2 → URL `?page=2`. Back → page 1, Forward → page 2
2. Type "order" → after ~300 ms URL `?search=order` (no `page`), 4 rows, one history entry for the whole typing
3. Reload `/webhooks?page=2&search=ate` → same page and search restored (after re-login). "ate" matches the 14 "created"/"updated" webhooks, so page 2 has 4 rows
4. `/webhooks?page=abc` → page 1. `/webhooks?page=99` → replaced with the last page
5. Search "zzz" → empty state. Force a handler error from the console via `window.__msw.use(...)` (dev only) → error state with working Retry
6. Wait 30 s, change page → network shows 401 → one rotate → retried list request 200
7. `npm test` (listParams tests), `npm run typecheck`, `npm run lint` pass

## History

<!-- Completed features, append only, oldest to newest. -->

- Project setup and boilerplate cleanup
- Setup Phase 1: app shell (MUI theme, QueryClient without retries, router with placeholder pages and not-found page), MSW worker in dev and production builds with an on-page error if it fails to start, msw/node test server, Vitest config with smoke test, typecheck/test scripts, `API_BASE_URL`, scaffold demo and assets removed
- Mock Phase 1: in-memory db (user, 28 webhooks, 30 s session, device tokens bound to the login fingerprint, `resetDb()` after every test), error envelope and 422 field-error helpers, `requireCsrf` (419) and `requireSession` (401) guards, `/csrf`, `/auth/login`, `/auth/token/issue|rotate|revoke` and `/v1/me` handlers, handler tests per testing rule plus device token reuse and issue fingerprint mismatch
- Mock Phase 2: `GET /v1/webhooks` (session check, Zod-parsed page/limit/search with fallback to defaults and limit capped at 100, case-insensitive name search, stable order by id, `last = max(1, ceil(total / limit))`), `GET /v1/webhooks/{id}` (401/404/200, non-numeric id → 404), `PUT /v1/webhooks/{id}` (CSRF → session → id → validation → update; trimmed name required, http/https url via `z.httpUrl()`, Laravel-style 422 field payload, 404 for an unknown id outside the brief's contract, to be noted in README), handler tests; spec testing steps switched to search words present in the seed ("order", "ate")
- API Phase 1: `request()` in `src/api/httpClient.ts` (method, path, query, JSON body serialized before any network call, Zod response schema, 204 → `undefined`, schema mismatch → `InvalidResponse`), `X-Requested-With` on every request and `X-CSRF-TOKEN` on POST/PUT, single-flight `ensureCsrfToken()` with in-memory cache, 419 → `invalidateCsrfToken(rejected)` (clears only the rejected token, so parallel 419s share one refetch) + one retry, `ApiError` (`status`, `type`, `message`, `fieldErrors`; unknown/broken envelope → `UnknownError`) and `NetworkError`, 401 extension point `configureHttpClient({ getRequestContext, onUnauthorized })` (context captured right before each send, `isRetry` flag, one-retry limit in `request()`, a throwing hook counts as `'fail'`), `resetHttpClient()` and `resetCsrfToken()` in test setup; code-scanner audit fixes; accepted: a 2xx body stream failing mid-read → `InvalidResponse`, a 419 on GET also retries once; 27 client tests
- API Phase 2: `src/api/session.ts` (single-flight rotate shared by parallel 401s, session generation captured before each send so a late 401 from an older generation retries without a new rotate, `/auth/*` excluded from 401 handling, `isRetry` 401 or failed rotate → `expired` flag + session-expired handler once per expiry, a rotate failing after a new session retries under it, `startSession(token)` as the only way to start a session (calls `issueSession`, bumps the generation, clears `expired`), `setSessionExpiredHandler`, `installSessionHandling()` returning the uninstall function, called in `main.tsx`, `resetSession()` in test setup), `src/api/auth.ts` (`login` with `X-Captcha-Token: test-captcha`, `issueSession`, `rotateSession`, `revokeSession`, `getMe`, `userSchema`; issue/rotate accept any 200 body), `src/api/fingerprint.ts` (16 random bytes → 32 hex in localStorage, never throws, page-level fallback when storage is blocked or full), `request()` `headers` option (client headers set last via `Headers`, so they cannot be overridden in any case), required test `two parallel 401s share one rotate and both retries succeed` on the real mock handlers with only `Date` mocked, plus expiry, late-401, auth-path, auth endpoint and fingerprint tests (75 total); code-scanner audit fixes; accepted: uninstall mid-request, `resetSession()` during a rotate, MSW event ordering (test-only); moved to auth-phase-1: logout calls `endSession()` without the expired handler
- Auth Phase 1: `authStore.ts` (`useSyncExternalStore`, `authenticated` or `anonymous` with reason `initial | logout | expired`, `acknowledgeLogout()` on login page mount, `resetAuthStore()` in test setup), login page (react-hook-form + Zod, MUI `inputRef`, submit disabled while pending, 422 field errors under inputs, other errors in a `root.serverError` alert, "Your session has expired" notice), `authFlow.ts` (`signIn`: login → `startSession` → `getMe`, device token local only, closes the issued session if `getMe` fails; `signOut`: `endSession()` before revoke, revoke errors ignored) wrapped by `useLogin` (`['me']` seeded, `gcTime: 0` so the password does not linger in the mutation cache) and `useLogout` (push `/login`, `queryClient.clear()`, reason `logout`), redirect after sign-in done by the login page's `<Navigate>` (one navigation, no race), `ProtectedRoute` (keeps pathname + search; renders nothing during logout navigation), `redirect.ts` (Zod-validated return target, no `//host` or `/login`), `AppLayout` (user name + logout), `useMe` (`staleTime: Infinity`), `endSession()` in `session.ts` (no expired handler, drops an in-flight rotate), expired handler registered in `main.tsx`, `getErrorMessage()` in `src/api/errors.ts`, `src/lib/formErrors.ts` (shared 422 → form mapper, `src/lib/` added to coding standards); browser check of spec steps 1-5 (fixed a duplicate `/login` history entry from StrictMode's double `<Navigate>` push); code-scanner audit fixes L1-L3 with tests; accepted: MSW event ordering in `authFlow.test.ts` (test-only), expired notice next to the form error if `/v1/me` gets a 401 on retry right after issue; expiry redirect to re-check in the UI in webhooks-phase-1; 107 tests
