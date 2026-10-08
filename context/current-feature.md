# Current Feature: Mock Phase 2 - Webhook Handlers

<!-- H1 gets the feature name when active, e.g. "# Current Feature: Add Navbar" -->

## Status

<!-- Not Started | In Progress | Complete -->

In Progress

## Goals

<!-- Checklist of what success looks like, filled by `/feature load`. Each goal is checked off when done, so the list doubles as plan vs actual. -->

- [x] `GET /v1/webhooks`: `requireSession()`, then parse `page` (int ≥ 1, default 1), `limit` (default 10) and optional `search`
- [x] Search is a case-insensitive substring of `name`; stable order by id
- [x] Paging: `pages.current` = requested page, `pages.last = max(1, ceil(total / limit))`, `results.total` = count after search, `results.limitation` = limit; a page beyond `last` returns `data: []`
- [x] `GET /v1/webhooks/{id}`: 401 without a session, 404 `NotFoundException` for an unknown id, 200 `Webhook`
- [x] `PUT /v1/webhooks/{id}`: checks in order CSRF (419) → session (401) → id (404) → validation (422) → update in memory → 200 updated `Webhook`
- [x] Validation: `name` required (trimmed, non-empty), `url` a valid `http`/`https` URL; 422 payload keyed by field (`{ "url": ["The url must be a valid URL."] }`)
- [x] Handlers in `src/mocks/handlers/webhooks.ts`, added to the exported `handlers` array
- [x] Handler tests covering the Testing steps below

## Notes

<!-- Additional context, constraints, API contract, out of scope. -->

Spec: `context/features/mock-phase-2-spec.md`.

### Route contract

| Method | Path | Input | Responses |
|---|---|---|---|
| GET | `/v1/webhooks?page=&limit=&search=` | query | 200 `WebhookList` \| 401 |
| GET | `/v1/webhooks/{id}` | - | 200 `Webhook` \| 401 \| 404 |
| PUT | `/v1/webhooks/{id}` | `{ name, url }` | 200 `Webhook` \| 401 \| 404 \| 419 \| 422 |

```ts
Webhook     = { id, name, url, active, created_at }
WebhookList = { data: Webhook[], paging: { pages: { current, last }, results: { total, limitation } } }
```

### Constraints

- Reuse `requireSession`, `requireCsrf` (`src/mocks/http.ts`), `errorResponse` / `validationErrorResponse` (`src/mocks/errors.ts`) and `readJson`. No duplicated checks
- Paths use a `*` origin (`'*/v1/webhooks'`)
- Laravel-style messages: `The name field is required.`, `The url must be a valid URL.`
- `created_at` stays an ISO string; seed stays deterministic (no `Math.random()`)
- 404 on PUT is outside the brief's contract but the only sensible answer for an unknown id. Mention in README (delivery phase)
- Out of scope: client API functions, list/edit UI, create/delete endpoints

### Decisions

- Seed stays as is. Test searches use words present in names: "order" (4 results), "ate" (14 results: "created"/"updated", 2 pages)
- Invalid `page` (non-integer, < 1) → 1. Invalid `limit` (non-integer, < 1) → 10; `limit` capped at 100
- `name` and `url` are stored trimmed; `search` is trimmed before matching
- Non-numeric id (`/v1/webhooks/abc`) → 404, same as an unknown id

### Testing steps (signed in via `/csrf` → login → issue)

1. `GET /v1/webhooks?page=1&limit=10` → 10 items, `results.total` 28, `pages.last` 3
2. `GET /v1/webhooks?page=3&limit=10` → 8 items. `page=4` → `data: []`
3. `GET /v1/webhooks?search=ORDER` → only names containing "order" (any case), `total` 4
4. `GET /v1/webhooks/9999` → 404 envelope
5. PUT `{ "name": "", "url": "ftp://x" }` → 422 with `name` and `url` payloads. Valid body → 200 and the list shows the new name
6. PUT without `X-CSRF-TOKEN` → 419. Any `/v1/*` after 30 s without rotate → 401

## History

<!-- Completed features, append only, oldest to newest. -->

- Project setup and boilerplate cleanup
- Setup Phase 1: app shell (MUI theme, QueryClient without retries, router with placeholder pages and not-found page), MSW worker in dev and production builds with an on-page error if it fails to start, msw/node test server, Vitest config with smoke test, typecheck/test scripts, `API_BASE_URL`, scaffold demo and assets removed
- Mock Phase 1: in-memory db (user, 28 webhooks, 30 s session, device tokens bound to the login fingerprint, `resetDb()` after every test), error envelope and 422 field-error helpers, `requireCsrf` (419) and `requireSession` (401) guards, `/csrf`, `/auth/login`, `/auth/token/issue|rotate|revoke` and `/v1/me` handlers, handler tests per testing rule plus device token reuse and issue fingerprint mismatch
