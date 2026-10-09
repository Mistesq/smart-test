# Current Feature: Webhooks Phase 2 - Edit Form with Server Errors

<!-- H1 gets the feature name when active, e.g. "# Current Feature: Add Navbar" -->

## Status

<!-- Not Started | In Progress | Complete -->

In Progress

## Goals

<!-- Checklist of what success looks like, filled by `/feature load`. Each goal is checked off when done, so the list doubles as plan vs actual. -->

- [x] `:id` route param validated with Zod (positive integer) before any API call; invalid id → not-found state, no request
- [x] `useWebhook(id)` query (`['webhook', id]`) in `src/features/webhooks/useWebhook.ts`
- [x] `WebhookEditPage` at `/webhooks/:id/edit` (replaces the placeholder in `router.tsx`): loading state; 404 → "Webhook not found" with a link back to the list; other errors → `Alert` + Retry
- [x] `webhookFormSchema.ts`: `name` and `url` required after trim (A11). No URL format rule on the client
- [x] Form: react-hook-form + `zodResolver`, default values from the loaded webhook
- [x] `useUpdateWebhook` mutation → `updateWebhook(id, body)`. Save disabled while submitting or when the form is not dirty
- [x] 422 → shared `applyFormError` from `src/lib/formErrors.ts` → first message under `name` / `url`; unknown payload keys and other errors → form-level `Alert` (`root.serverError`)
- [x] Success (A10): `setQueryData(['webhook', id], updated)`, invalidate `WEBHOOKS_QUERY_KEY`, navigate back to the list with its original search string
- [x] Cancel → back to the list with its original search string; direct visit (no list state) → `/webhooks`
- [x] `src/features/webhooks/updateWebhook.test.ts`: `updateWebhook` against the mock with an invalid URL → `ApiError` 422 → `mapFormError` returns `{ url: '...' }`

## Notes

<!-- Additional context, constraints, API contract, out of scope. -->

- Contract: `GET /v1/webhooks/{id}` → 200 `Webhook` | 401 | 404; `PUT /v1/webhooks/{id}` `{ name, url }` → 200 `Webhook` | 401 | 422 (419 handled by the client). Mock also returns 404 on PUT for an unknown id (to be noted in README)
- API functions already exist in `src/api/webhooks.ts` (`getWebhook`, `updateWebhook`, `WebhookInput`). Do not add new ones
- Reuse `mapFormError` / `applyFormError` / `FORM_ERROR_KEY` from `src/lib/formErrors.ts`. No second mapper
- The URL format rule is deliberately server-only, so the 422 path is visible in the UI. The server stays the source of truth
- Return target: the list row passes `ListLinkState` (`{ listSearch }`) as router state. Location state is external input (survives reload in history), so validate it with Zod before using it in a navigation; anything invalid → `/webhooks`
- `['webhook', id]` and `['webhooks', ...]` are separate key roots, so invalidating `WEBHOOKS_QUERY_KEY` does not touch the detail cache
- Out of scope: toggling `active`, creating or deleting webhooks, success toast, modal edit (A1 alt)
- Testing steps (from the spec):
  1. From `/webhooks?page=2&search=ate` ("ate" matches 14 webhooks), click a row → edit page with name and URL filled
  2. Clear the name → client error under Name, no request sent. URL `ftp://x` → request is sent → 422 → server message shown under the URL field
  3. Change the name, keeping "ate" in it → Save → back on `/webhooks?page=2&search=ate` with the new name in the table
  4. `/webhooks/9999/edit` → not-found message with a working link back
  5. Wait 30 s, then Save → PUT 401 → one rotate → PUT retried → success
  6. `npm test` (422 mapping test), `npm run typecheck`, `npm run lint` pass

## History

<!-- Completed features, append only, oldest to newest. -->

- Project setup and boilerplate cleanup
- Setup Phase 1: app shell (MUI theme, QueryClient without retries, router with placeholder pages and not-found page), MSW worker in dev and production builds with an on-page error if it fails to start, msw/node test server, Vitest config with smoke test, typecheck/test scripts, `API_BASE_URL`, scaffold demo and assets removed
- Mock Phase 1: in-memory db (user, 28 webhooks, 30 s session, device tokens bound to the login fingerprint, `resetDb()` after every test), error envelope and 422 field-error helpers, `requireCsrf` (419) and `requireSession` (401) guards, `/csrf`, `/auth/login`, `/auth/token/issue|rotate|revoke` and `/v1/me` handlers, handler tests per testing rule plus device token reuse and issue fingerprint mismatch
- Mock Phase 2: `GET /v1/webhooks` (session check, Zod-parsed page/limit/search with fallback to defaults and limit capped at 100, case-insensitive name search, stable order by id, `last = max(1, ceil(total / limit))`), `GET /v1/webhooks/{id}` (401/404/200, non-numeric id → 404), `PUT /v1/webhooks/{id}` (CSRF → session → id → validation → update; trimmed name required, http/https url via `z.httpUrl()`, Laravel-style 422 field payload, 404 for an unknown id outside the brief's contract, to be noted in README), handler tests; spec testing steps switched to search words present in the seed ("order", "ate")
- API Phase 1: `request()` in `src/api/httpClient.ts` (method, path, query, JSON body serialized before any network call, Zod response schema, 204 → `undefined`, schema mismatch → `InvalidResponse`), `X-Requested-With` on every request and `X-CSRF-TOKEN` on POST/PUT, single-flight `ensureCsrfToken()` with in-memory cache, 419 → `invalidateCsrfToken(rejected)` (clears only the rejected token, so parallel 419s share one refetch) + one retry, `ApiError` (`status`, `type`, `message`, `fieldErrors`; unknown/broken envelope → `UnknownError`) and `NetworkError`, 401 extension point `configureHttpClient({ getRequestContext, onUnauthorized })` (context captured right before each send, `isRetry` flag, one-retry limit in `request()`, a throwing hook counts as `'fail'`), `resetHttpClient()` and `resetCsrfToken()` in test setup; code-scanner audit fixes; accepted: a 2xx body stream failing mid-read → `InvalidResponse`, a 419 on GET also retries once; 27 client tests
- API Phase 2: `src/api/session.ts` (single-flight rotate shared by parallel 401s, session generation captured before each send so a late 401 from an older generation retries without a new rotate, `/auth/*` excluded from 401 handling, `isRetry` 401 or failed rotate → `expired` flag + session-expired handler once per expiry, a rotate failing after a new session retries under it, `startSession(token)` as the only way to start a session (calls `issueSession`, bumps the generation, clears `expired`), `setSessionExpiredHandler`, `installSessionHandling()` returning the uninstall function, called in `main.tsx`, `resetSession()` in test setup), `src/api/auth.ts` (`login` with `X-Captcha-Token: test-captcha`, `issueSession`, `rotateSession`, `revokeSession`, `getMe`, `userSchema`; issue/rotate accept any 200 body), `src/api/fingerprint.ts` (16 random bytes → 32 hex in localStorage, never throws, page-level fallback when storage is blocked or full), `request()` `headers` option (client headers set last via `Headers`, so they cannot be overridden in any case), required test `two parallel 401s share one rotate and both retries succeed` on the real mock handlers with only `Date` mocked, plus expiry, late-401, auth-path, auth endpoint and fingerprint tests (75 total); code-scanner audit fixes; accepted: uninstall mid-request, `resetSession()` during a rotate, MSW event ordering (test-only); moved to auth-phase-1: logout calls `endSession()` without the expired handler
- Auth Phase 1: `authStore.ts` (`useSyncExternalStore`, `authenticated` or `anonymous` with reason `initial | logout | expired`, `acknowledgeLogout()` on login page mount, `resetAuthStore()` in test setup), login page (react-hook-form + Zod, MUI `inputRef`, submit disabled while pending, 422 field errors under inputs, other errors in a `root.serverError` alert, "Your session has expired" notice), `authFlow.ts` (`signIn`: login → `startSession` → `getMe`, device token local only, closes the issued session if `getMe` fails; `signOut`: `endSession()` before revoke, revoke errors ignored) wrapped by `useLogin` (`['me']` seeded, `gcTime: 0` so the password does not linger in the mutation cache) and `useLogout` (push `/login`, `queryClient.clear()`, reason `logout`), redirect after sign-in done by the login page's `<Navigate>` (one navigation, no race), `ProtectedRoute` (keeps pathname + search; renders nothing during logout navigation), `redirect.ts` (Zod-validated return target, no `//host` or `/login`), `AppLayout` (user name + logout), `useMe` (`staleTime: Infinity`), `endSession()` in `session.ts` (no expired handler, drops an in-flight rotate), expired handler registered in `main.tsx`, `getErrorMessage()` in `src/api/errors.ts`, `src/lib/formErrors.ts` (shared 422 → form mapper, `src/lib/` added to coding standards); browser check of spec steps 1-5 (fixed a duplicate `/login` history entry from StrictMode's double `<Navigate>` push); code-scanner audit fixes L1-L3 with tests; accepted: MSW event ordering in `authFlow.test.ts` (test-only), expired notice next to the form error if `/v1/me` gets a 401 on retry right after issue; expiry redirect to re-check in the UI in webhooks-phase-1; 107 tests
- Webhooks Phase 1: `src/api/webhooks.ts` (`getWebhooks`, `getWebhook`, `updateWebhook`, `webhookSchema` / `webhookListSchema`, empty search left out of the request), `listParams.ts` (Zod-parsed page with fallback to 1 and trimmed search, builder that omits defaults, `toListSearch()`, `ListLinkState`), `useWebhooks` (`['webhooks', { page, search }]`, limit 10, `keepPreviousData`, `WEBHOOKS_QUERY_KEY` for phase 2 invalidation), `WebhookSearch` (300 ms debounce, `replace` + drop page, write skipped when the trimmed value equals the URL, re-sync from the URL on back/forward), `WebhooksPage` (page change pushes, page beyond the last replaced via `<Navigate replace>` once real data arrives, loading / empty / error + Retry, an empty placeholder shows the loading state), `WebhooksTable` (name links to the edit page with `{ listSearch }` router state, URL, active chip, dimmed while placeholder), dev `window.__msw = { worker, http, HttpResponse }`; browser check of spec steps 1-6 and the session-expiry redirect carried over from auth-phase-1; accepted: a refetch error on cached data replaces the table with the alert, a keystroke during the input's own URL write can be lost; 128 tests
