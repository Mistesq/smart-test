# Current Feature: Auth Phase 1 - Login Page, Protected Routes & Logout

<!-- H1 gets the feature name when active, e.g. "# Current Feature: Add Navbar" -->

## Status

<!-- Not Started | In Progress | Complete -->

In Progress

## Goals

<!-- Checklist of what success looks like, filled by `/feature load`. Each goal is checked off when done, so the list doubles as plan vs actual. -->

- [x] `src/features/auth/authStore.ts`: in-memory status `anonymous | authenticated` with a `useSyncExternalStore` hook; starts `anonymous` on every page load (A7)
- [x] Login page (`/login`, `LoginPage.tsx` + `loginSchema.ts`): react-hook-form + `zodResolver` (email format, password required), MUI TextFields, submit disabled while pending
- [x] `useLogin` mutation: `login` → `startSession(token)` → `getMe()` seeded into `['me']` → status `authenticated` → the login page redirects to `location.state.from` or `/webhooks`; the device token only exists inside `signIn`
- [x] Login errors: 422 `fieldErrors` → `setError` on `email` / `password`; unknown fields or other errors → form-level `Alert`
- [x] One shared 422 → form field mapper (reused by the edit form in webhooks-phase-2)
- [x] `ProtectedRoute.tsx`: `anonymous` → `<Navigate to="/login" replace state={{ from: location }} />` keeping pathname + search; `/login` while `authenticated` → redirect to `from` or `/webhooks`
- [x] `src/components/AppLayout.tsx`: AppBar with `me.name` (`useMe`) and a Logout button
- [x] `useLogout`: `endSession()` → `revokeSession()` (errors ignored) → push `/login` → `queryClient.clear()` → status `anonymous` (reason `logout`)
- [x] `endSession()` in `src/api/session.ts`: marks the session expired WITHOUT calling the session-expired handler
- [x] Session-expired handler registered once at app start: `queryClient.clear()`, status `anonymous`; protected route redirects keeping the current location; login page shows "Your session has expired"
- [x] `src/app/router.tsx` updated (login route, protected layout with AppLayout around the webhook placeholders); `src/app/App.tsx` needed no change (handler lives in `main.tsx`)
- [x] Unit tests for the logic touched (auth store, field-error mapper, `endSession`)
- [x] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass

## Notes

<!-- Additional context, constraints, API contract, out of scope. -->

Spec: `context/features/auth-phase-1-spec.md`.

**Contracts / existing code**

- `src/api/session.ts`: `startSession(token)` (issue + new generation + clears `expired`), `setSessionExpiredHandler`, `installSessionHandling()` (already called in `main.tsx`), `resetSession()`. Add `endSession()` here.
- `src/api/auth.ts`: `login`, `revokeSession`, `getMe`, `userSchema`. `ApiError.fieldErrors` carries the 422 payload.
- Login request body / headers (`fingerprint`, `X-Captcha-Token`) are already handled by `login()`.

**Gotchas**

- Why `endSession()`: without it, a 401 that lands after revoke (in-flight or refetching query) goes to rotate → 400 → expired handler, and the UI shows "Your session has expired" after a deliberate logout.
- Never put the device token, fingerprint or user into the URL. Only `fingerprint` lives in localStorage (done).
- The `['me']` query is seeded at login; `useMe` must not refetch it right away (Testing step 3 expects exactly one `/v1/me`).
- Login page redirect on `authenticated` must not race `useLogin`'s navigate to `from` (otherwise the user lands on `/webhooks` instead of the original URL).
- Deliberate logout goes to `/login` without `from`; session expiry keeps `from`.
- MUI 9: verify TextField props (`slotProps` vs legacy `InputProps`) with Context7.
- react-router 8: verify `Navigate`, `useLocation` and location `state` typing (validate `state.from` at the boundary, it is `unknown`).

**Implementation decisions**

- Auth store keeps why the user is anonymous: `initial` (page load), `logout`, `expired`. `expired` drives the login page notice; `logout` makes the protected route render nothing (no `from`) while `useLogout` pushes `/login`, and the login page acknowledges it on mount (back to `initial`), so Back to a protected page redirects with `from` again.
- Logout pushes `/login` from `useLogout` itself, not via a push `<Navigate>`: StrictMode runs the `<Navigate>` effect twice in dev and left a duplicate `/login` history entry (found in the browser check).
- Redirect after sign-in: the login page renders `<Navigate to={getRedirectTarget(state)} replace />` once the store says `authenticated`, so `useLogin` does not navigate itself and there is no race between two navigations. The same branch covers `/login` while signed in.
- `location.state.from` is validated with Zod (`redirect.ts`): only `/`-paths, no `//host`, never `/login`; otherwise `/webhooks`.
- `getErrorMessage(error)` in `src/api/errors.ts` is the one error → message mapper; `src/lib/formErrors.ts` (`mapFormError`, `applyFormError`) maps 422 payloads to form fields and `root.serverError`.
- Session-expired handler is registered in `main.tsx` next to `installSessionHandling()`; `App.tsx` needed no change.
- `useMe` uses `staleTime: Infinity` (seeded at login, cleared on logout/expiry).
- `signIn` / `signOut` live in `src/features/auth/authFlow.ts` as plain functions; `useLogin` / `useLogout` only wrap them in mutations (cache, store, navigation). `authFlow.test.ts` tests them on the real mock handlers (request order, stop on login/issue failure, revoke failure ignored, no rotate/expired handler after logout).
- Code-scanner audit fixes: `signIn` closes the just-issued session (`signOut()`: `endSession()` + revoke) when `getMe()` fails, then rethrows (L1); `useLogin` mutation `gcTime: 0`, so the password in the mutation variables is dropped once the login page stops observing it (L2); `endSession()` also drops an in-flight rotate (`rotating = null`), so a 401 after the next sign-in cannot join its stale result (L3). Each fix has a test that fails without it.
- Accepted: exact `response:mocked` lists in `authFlow.test.ts` assume MSW records the last event before the client promise settles (same accepted pattern as api-phase-2, test-only, stable so far) (L4). Accepted: if `/v1/me` gets a 401 on its retry right after issue, the expired handler runs too and the login page shows the expired notice next to the form error (a just-issued session rejected by the server; message is accurate).
- Browser check: steps 1-5 pass. The expiry redirect cannot be triggered in the UI yet (placeholder pages make no protected requests); covered by session tests, to re-check in webhooks-phase-1.

**Out of scope**

- Webhook list / edit pages (stay placeholders inside the protected layout), session persistence across reloads (A7).

**Testing steps (from spec)**

1. Open `/webhooks?page=2&search=ate` signed out → redirected to `/login`
2. Wrong password → error under the password field. Empty email → client error, no request sent
3. Correct credentials (`admin@example.com` / `password123`) → back on `/webhooks?page=2&search=ate`. Network: `/csrf` once, then login → issue → `/v1/me`
4. App bar shows the user's name. Logout → `revoke` 204 → `/login`. Browser Back → redirected to login, no cached data shown
5. Reload while signed in → login page, then back to the same URL after signing in
6. `npm run typecheck`, `npm run lint`, `npm test` pass

## History

<!-- Completed features, append only, oldest to newest. -->

- Project setup and boilerplate cleanup
- Setup Phase 1: app shell (MUI theme, QueryClient without retries, router with placeholder pages and not-found page), MSW worker in dev and production builds with an on-page error if it fails to start, msw/node test server, Vitest config with smoke test, typecheck/test scripts, `API_BASE_URL`, scaffold demo and assets removed
- Mock Phase 1: in-memory db (user, 28 webhooks, 30 s session, device tokens bound to the login fingerprint, `resetDb()` after every test), error envelope and 422 field-error helpers, `requireCsrf` (419) and `requireSession` (401) guards, `/csrf`, `/auth/login`, `/auth/token/issue|rotate|revoke` and `/v1/me` handlers, handler tests per testing rule plus device token reuse and issue fingerprint mismatch
- Mock Phase 2: `GET /v1/webhooks` (session check, Zod-parsed page/limit/search with fallback to defaults and limit capped at 100, case-insensitive name search, stable order by id, `last = max(1, ceil(total / limit))`), `GET /v1/webhooks/{id}` (401/404/200, non-numeric id → 404), `PUT /v1/webhooks/{id}` (CSRF → session → id → validation → update; trimmed name required, http/https url via `z.httpUrl()`, Laravel-style 422 field payload, 404 for an unknown id outside the brief's contract, to be noted in README), handler tests; spec testing steps switched to search words present in the seed ("order", "ate")
- API Phase 1: `request()` in `src/api/httpClient.ts` (method, path, query, JSON body serialized before any network call, Zod response schema, 204 → `undefined`, schema mismatch → `InvalidResponse`), `X-Requested-With` on every request and `X-CSRF-TOKEN` on POST/PUT, single-flight `ensureCsrfToken()` with in-memory cache, 419 → `invalidateCsrfToken(rejected)` (clears only the rejected token, so parallel 419s share one refetch) + one retry, `ApiError` (`status`, `type`, `message`, `fieldErrors`; unknown/broken envelope → `UnknownError`) and `NetworkError`, 401 extension point `configureHttpClient({ getRequestContext, onUnauthorized })` (context captured right before each send, `isRetry` flag, one-retry limit in `request()`, a throwing hook counts as `'fail'`), `resetHttpClient()` and `resetCsrfToken()` in test setup; code-scanner audit fixes; accepted: a 2xx body stream failing mid-read → `InvalidResponse`, a 419 on GET also retries once; 27 client tests
- API Phase 2: `src/api/session.ts` (single-flight rotate shared by parallel 401s, session generation captured before each send so a late 401 from an older generation retries without a new rotate, `/auth/*` excluded from 401 handling, `isRetry` 401 or failed rotate → `expired` flag + session-expired handler once per expiry, a rotate failing after a new session retries under it, `startSession(token)` as the only way to start a session (calls `issueSession`, bumps the generation, clears `expired`), `setSessionExpiredHandler`, `installSessionHandling()` returning the uninstall function, called in `main.tsx`, `resetSession()` in test setup), `src/api/auth.ts` (`login` with `X-Captcha-Token: test-captcha`, `issueSession`, `rotateSession`, `revokeSession`, `getMe`, `userSchema`; issue/rotate accept any 200 body), `src/api/fingerprint.ts` (16 random bytes → 32 hex in localStorage, never throws, page-level fallback when storage is blocked or full), `request()` `headers` option (client headers set last via `Headers`, so they cannot be overridden in any case), required test `two parallel 401s share one rotate and both retries succeed` on the real mock handlers with only `Date` mocked, plus expiry, late-401, auth-path, auth endpoint and fingerprint tests (75 total); code-scanner audit fixes; accepted: uninstall mid-request, `resetSession()` during a rotate, MSW event ordering (test-only); moved to auth-phase-1: logout calls `endSession()` without the expired handler
