# Mock Phase 2 - Webhook Handlers

## Overview

Add the webhook endpoints to the mock: paginated and searchable list, detail and update with server-side validation, all behind the session check from mock phase 1.

## Requirements

- `GET /v1/webhooks`: `requireSession()`, then parse `page` (int ≥ 1, default 1), `limit` (default 10) and `search` (optional)
- Search: case-insensitive substring of `name`. Order: stable (by id)
- Paging: `pages.current` = requested page, `pages.last = max(1, ceil(total / limit))`, `results.total` = count after search, `results.limitation` = limit. A page beyond `last` returns `data: []`
- `GET /v1/webhooks/{id}`: 401 without a session, 404 `NotFoundException` for an unknown id, 200 `Webhook`
- `PUT /v1/webhooks/{id}`: order of checks CSRF (419) → session (401) → id (404) → validation (422) → update in memory → 200 updated `Webhook`
- Validation: `name` required (trimmed, non-empty), `url` must be a valid `http`/`https` URL. 422 payload uses field keys (`{ "url": ["The url must be a valid URL."] }`)
- Handlers live in `src/mocks/handlers/webhooks.ts` and are added to the exported `handlers` array

## Route Contract

| Method | Path | Input | Responses |
|---|---|---|---|
| GET | `/v1/webhooks?page=&limit=&search=` | query | 200 `WebhookList` \| 401 |
| GET | `/v1/webhooks/{id}` | - | 200 `Webhook` \| 401 \| 404 |
| PUT | `/v1/webhooks/{id}` | `{ name, url }` | 200 `Webhook` \| 401 \| 404 \| 419 \| 422 |

```ts
Webhook     = { id, name, url, active, created_at }
WebhookList = { data: Webhook[], paging: { pages: { current, last }, results: { total, limitation } } }
```

## Notes

- 404 on PUT is not in the brief's contract but is the only sensible answer for an unknown id. Mention it in README
- Error messages follow the brief's Laravel style (`The name field is required.`, `The url must be a valid URL.`)
- Use `created_at` as an ISO string. Keep the seed deterministic (no `Math.random()`)
- Reuse `requireSession`, the CSRF guard and the error helper from mock phase 1. No duplicated checks

## Testing

Signed in via the console flow from mock phase 1 (`/csrf` → login → issue):

1. `GET /v1/webhooks?page=1&limit=10` → 10 items, `results.total` 28, `pages.last` 3
2. `GET /v1/webhooks?page=3&limit=10` → 8 items. `page=4` → `data: []`
3. `GET /v1/webhooks?search=SLACK` → only names containing "slack" (any case), `total` matches
4. `GET /v1/webhooks/9999` → 404 envelope
5. PUT `{ "name": "", "url": "ftp://x" }` → 422 with `name` and `url` payloads. Valid body → 200 and the list shows the new name
6. PUT without `X-CSRF-TOKEN` → 419. Any `/v1/*` after 30 s without rotate → 401

## References

- MSW query parameters: https://mswjs.io/docs/recipes/query-parameters
- MSW path params: https://mswjs.io/docs/basics/intercepting-requests
