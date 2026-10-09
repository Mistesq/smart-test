# smart-test Project Specifications

Source: the original spec PDF in the repo root (gitignored).

## Problem (Core Idea)

A small SPA to sign in, browse and edit webhooks against an API that is fully mocked with MSW. The real subject of the project is a correct client session: device-token login, a 30-second session with transparent rotate-and-retry, a single shared rotate for concurrent 401s, CSRF handling, URL-driven list state and server-side form errors.

Constraints: small scope. Anything unfinished goes in README. Priorities: logic, architecture, typing and readability, not visuals. Architecture must fit the task size (no monorepo or complex infra).

## Users

- **Developer**: runs the app and the test from README, signs in with the test credentials, checks session behaviour, list URL state and edit errors.
- **Signed-in user** (single mock user): views webhooks and edits their name and URL.

## Core Features

### 1. Login and session
- Login form: email + password. Test credentials listed in README.
- Flow: `POST /auth/login` → `device_session_token` → `POST /auth/token/issue` → `GET /v1/me` → navigate to the webhook list.
- `device_session_token` is kept in memory only (never localStorage or URL).
- `fingerprint`: 32 hex chars, generated once, stored in localStorage, sent in auth request bodies.
- Session tokens are invisible to the client; the mock holds the session (HttpOnly-cookie analogue).
- Session lives 30 s. Protected request gets 401 → `POST /auth/token/rotate` → retry the request once.
- Concurrent 401s share ONE rotate. Rotate itself never triggers a rotate.
- Rotate failure or a second 401 after retry → end local session, go to login.
- Logout: `POST /auth/token/revoke`, clear local state and the cached user data (query cache).

### 2. CSRF
- Every request sends `X-Requested-With: XMLHttpRequest`.
- `GET /csrf` runs before any other API request; its `X-CSRF-TOKEN` response header is sent as `X-CSRF-TOKEN` on POST and PUT.
- Bonus (included): on 419, refetch the CSRF token and retry the request at most once.

### 3. Webhook list
- Table: name, URL, active.
- Pagination, 10 per page; search by name.
- Page and search live in the URL and are restored on reload and back/forward.
- Changing the search resets to page 1.
- Loading, empty and error states.

### 4. Edit
- Form with name and URL (see A1 for page vs modal).
- Server validation errors (422 payload) shown next to the matching fields.

### 5. Mock API (MSW)
- One user with fixed email/password; 25-30 webhooks; in-memory state.
- `/auth/login` requires a non-empty `X-Captcha-Token` header (no captcha widget).
- Wrong password → 422 with a field error.
- Session 30 s. Revoke always → 204.
- Rotate succeeds (200) even when the session has expired, as long as it was issued and not revoked; it renews `expiresAt` to now + 30 s. Rotate returns 400 only before a successful issue, after revoke, or on a fingerprint mismatch.
- Fixed CSRF token, checked on POST and PUT before the operation; missing/wrong → 419.
- `page` starts at 1, `limit=10`, search is a case-insensitive substring of name. `results.total` = count after search, `results.limitation` = page size. Stable order.
- Validation: name required, URL must be a valid http/https URL.

### 6. Test and delivery
- One required automated test: two parallel requests get 401 → exactly one rotate → both retries succeed.
- README: how to run the app and the test, test credentials, short explanation of key decisions, unfinished items.
- Delivered as a GitHub or GitLab link.

## Data Model (rough draft)

API contract (all paths same-origin):

| Method | Path | Body | Responses |
|---|---|---|---|
| GET | `/csrf` | - | 204 + header `X-CSRF-TOKEN` |
| POST | `/auth/login` | `{ email, password, fingerprint }` | 200 `{ device_session_token }` \| 422 |
| POST | `/auth/token/issue` | `{ device_session_token, fingerprint }` | 200 (starts session) \| 422 |
| POST | `/auth/token/rotate` | `{ fingerprint }` | 200 \| 400 |
| POST | `/auth/token/revoke` | `{ fingerprint }` | 204 |
| GET | `/v1/me` | - | 200 `User` \| 401 |
| GET | `/v1/webhooks?page=&limit=&search=` | - | 200 `WebhookList` \| 401 |
| GET | `/v1/webhooks/{id}` | - | 200 `Webhook` \| 401 \| 404 |
| PUT | `/v1/webhooks/{id}` | `{ name, url }` | 200 `Webhook` \| 401 \| 422 |

```ts
User        = { id, email, first_name, last_name, name }
Webhook     = { id, name, url, active, created_at }
WebhookList = { data: Webhook[], paging: { pages: { current, last }, results: { total, limitation } } }
ApiError    = { error: { type, message, payload? } }   // payload: Record<field, string[]> on 422
```

Error types: 400 `BadRequestException`, 401 `AuthenticationException`, 404 `NotFoundException`, 419 `TokenMismatchException`, 422 `ValidationException` (with field payload).

Client state: `fingerprint` (localStorage), `device_session_token` (memory, short-lived), CSRF token (memory), current user (query cache), auth status (memory).
Mock state: user, webhooks, session `{ fingerprint, expiresAt } | null`, issued device tokens.

## Tech Stack

- **Type**: client-side SPA; the whole API is mocked with MSW (no backend)
- **Build / dev**: Vite 8, `@vitejs/plugin-react` 6
- **Language**: TypeScript 6 (strict by default)
- **UI**: React 19, MUI 9 (`@mui/material`) with Emotion
- **Routing**: react-router 8
- **Server state**: TanStack Query 5
- **Forms / validation**: react-hook-form 7 + `@hookform/resolvers` 5 + Zod 4
- **API mocking**: MSW 2 (browser worker in `public/`, `msw/node` in tests)
- **HTTP**: native `fetch` wrapper (no axios)
- **Testing**: Vitest 5
- **Lint**: ESLint 10 flat config + typescript-eslint
- **Deployment**: none for now (decided). Run locally per README

## Architecture Notes

- **Layers**: `api/` (HTTP client, endpoint functions, Zod response schemas) → state (TanStack Query hooks, auth store) → UI (pages, components). UI never calls `fetch` directly.
- **HTTP client** (one place for all cross-cutting rules): adds `X-Requested-With`, ensures CSRF token (single-flight `GET /csrf`), attaches `X-CSRF-TOKEN` on POST/PUT, 419 → refetch CSRF + retry once, 401 on protected requests → shared rotate + retry once, parses the error envelope into a typed `ApiError`.
- **Shared rotate**: a module-level in-flight promise; all 401s await the same promise. Auth endpoints (`/auth/*`) are excluded from the 401 handler, so rotate never triggers rotate. Rotate failure or a 401 on retry → `onSessionExpired` callback (clear auth state + query cache, redirect to login).
- **Late 401 edge case**: a request sent before a rotate finished may get its 401 after it. Track a session "generation" counter: if the request was sent under an older generation, retry without a new rotate.
- **Auth store**: small in-memory store (React context or `useSyncExternalStore`) holding status (`anonymous` / `authenticated`) and the in-memory device token during login. User data comes from the `/v1/me` query.
- **Routing**: `/login`, `/webhooks` (protected list), `/webhooks/:id/edit` (protected edit). A protected layout route redirects to `/login` and keeps the original location so the user returns to it (with list params) after signing in.
- **URL state**: `page` and `search` read from `useSearchParams`, validated with Zod (invalid → defaults; page beyond `last` → replace with the last page). The URL is the single source of truth for list params; query key = `['webhooks', { page, search }]`. Search typing uses `replace`, page changes push a history entry.
- **Errors**: one mapper from `ApiError` to UI: 422 payload → `setError` on form fields, other statuses → generic message / not found state.
- **Mock**: MSW handlers + in-memory db module, shared between the browser worker and `msw/node` in tests.

## Monetization (if any)

None.

## UI / UX

- MUI defaults, free design. Simple and readable over polished.
- Login page: centered card, email, password, submit, inline errors.
- App layout (protected): top bar with user name from `/v1/me` and a Logout button.
- List page: search field above a table (name, URL, active as a chip), MUI `Pagination` below; skeleton/spinner while loading, empty message, error with retry.
- Edit page: name and URL fields, Save and Cancel; field errors under inputs; 404 → not found message with a link back to the list.
- English UI (see A2).

## Roadmap

1. `setup-phase-1-spec.md`: app shell, providers, router placeholders, MSW wiring, test/typecheck scripts. Depends on: -
2. `mock-phase-1-spec.md`: in-memory db, CSRF guard, auth handlers, 30 s session. Depends on: 1
3. `mock-phase-2-spec.md`: webhook list/detail/update handlers with validation. Depends on: 2
4. `api-phase-1-spec.md`: HTTP client, single-flight CSRF, 419 retry, typed `ApiError`. Depends on: 1, 2
5. `api-phase-2-spec.md`: shared rotate, generation counter, auth endpoints, fingerprint, required test. Depends on: 3, 4
6. `auth-phase-1-spec.md`: login page and flow, protected routes, app bar, logout, session expiry. Depends on: 5
7. `webhooks-phase-1-spec.md`: webhooks API, list page with URL state, search, pagination, states. Depends on: 6
8. `webhooks-phase-2-spec.md`: edit page, client validation, 422 field errors, cache updates. Depends on: 7
9. `delivery-phase-1-spec.md`: README, cleanup, final quality gates. Depends on: 8

## Status

Not started. Vite scaffold and AI harness only.

## Assumptions

- A1 Edit form: separate page `/webhooks/:id/edit`. Loads by id, handles 404, back returns to the list with its params. Alt: modal over the list.
- A2 UI language: English. API error messages are English and shown as-is next to fields. Alt: Ukrainian UI.
- A3 Test credentials: `admin@example.com` / `password123`. Fixed in the mock and README. Alt: other values.
- A4 Captcha header: client sends a fixed `X-Captcha-Token: test-captcha`. Spec says no widget. Alt: random value per login.
- A5 Fingerprint: 16 random bytes from `crypto.getRandomValues`, hex-encoded. Alt: `crypto.randomUUID()` without dashes.
- A6 Mock fingerprint check: `rotate` checks it against the session (mismatch → 400, within the contract's `200 | 400`). `issue` checks it against the fingerprint the device token was issued for at login (mismatch → 422, within `200 | 422`). `revoke` always returns 204 per the contract and ends the session when the fingerprint matches. Alt: no fingerprint check at all.
- A7 After reload: user signs in again and returns to the originally requested URL with its page/search. Alt: always land on `/webhooks`.
- A8 Search input: debounced 300 ms, writes `search` to the URL and drops `page`. Typing replaces the current history entry; a page change pushes a new one. Alt: search on Enter/submit.
- A9 Invalid URL params (`page=abc`, `page=0`): fall back to page 1 / empty search. `page` beyond the last page → redirect (replace) to the last page; with no results, page 1. Alt: show an error.
- A10 After a successful save: update the detail cache, invalidate the list, return to the list with its params. Alt: stay on the edit page with a success toast.
- A11 Client validation: only checks that name and url are not empty (Zod). The http/https URL rule stays on the server only, so a 422 is visible in the UI and mapped to fields. Alt: mirror all server rules on the client.
- A12 MSW runs in dev and in the production build (`npm run preview`), since there is no real API. Alt: dev only.
- A13 Mock data: 28 deterministic webhooks, some inactive. Alt: random seed.
- A14 Tests: the required rotate test plus a few unit tests for the HTTP client (CSRF, 419 retry, rotate failure). Alt: only the required test.

## Open Questions

None.
