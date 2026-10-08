# Webhooks Phase 1 - List with URL State

## Overview

The webhook list: typed endpoint and query hook, a table with search and pagination whose state lives in the URL, and loading, empty and error states.

## Requirements

- `src/api/webhooks.ts`: `getWebhooks({ page, limit, search })`, `getWebhook(id)`, `updateWebhook(id, { name, url })` with `Webhook` / `WebhookList` Zod schemas (detail and update are used by phase 2)
- `src/features/webhooks/listParams.ts`: parse `page` and `search` from `URLSearchParams` with Zod. Invalid or `< 1` page → 1, missing search → `''` (A9). Plus a builder that omits defaults (`page=1`, empty search) from the URL. Unit tested
- `useWebhooks(params)`: query key `['webhooks', { page, search }]`, `limit` 10, `placeholderData: keepPreviousData`
- Search field: debounced 300 ms, writes `search` and drops `page` with `replace: true` (A8). The input re-syncs from the URL on back/forward
- MUI `Pagination` (1-based): a page change pushes a new history entry. If `page > pages.last` → replace with the last page (A9)
- Table: name, URL, active (Chip). Each row links to `/webhooks/:id/edit`, passing the current list search string so the edit page can go back to it
- States: loading (skeleton or progress), empty ("No webhooks found" mentioning the search), error (`Alert` + Retry via `refetch`)

## Files to Create

1. `src/api/webhooks.ts`
2. `src/features/webhooks/listParams.ts`, `listParams.test.ts`
3. `src/features/webhooks/useWebhooks.ts`
4. `src/features/webhooks/WebhooksPage.tsx`, `WebhooksTable.tsx`, `WebhookSearch.tsx`
5. Update `src/app/router.tsx`

## Notes

- The URL is the single source of truth: no `useState` copies of `page`/`search` except the raw search input text
- Avoid a debounce loop: do not write to the URL if the debounced value equals the current URL value
- TanStack Query v5: `keepPreviousData` is a helper passed to `placeholderData`. Verify with Context7
- MUI `Pagination` is 1-based; `TablePagination` is 0-based. Do not mix them

## Testing

1. `/webhooks` → 10 rows, 3 pages. Page 2 → URL `?page=2`. Back → page 1, Forward → page 2
2. Type "order" → after ~300 ms URL `?search=order` (no `page`), 4 rows, one history entry for the whole typing
3. Reload `/webhooks?page=2&search=ate` → same page and search restored (after re-login). "ate" matches the 14 "created"/"updated" webhooks, so page 2 has 4 rows
4. `/webhooks?page=abc` → page 1. `/webhooks?page=99` → replaced with the last page
5. Search "zzz" → empty state. Force a handler error from the console via `window.__msw.use(...)` (dev only, exposed in setup phase 1) → error state with working Retry
6. Wait 30 s, change page → network shows 401 → one rotate → retried list request 200
7. `npm test` (listParams tests), `npm run typecheck`, `npm run lint` pass

## References

- React Router `useSearchParams`: https://reactrouter.com/
- TanStack Query paginated queries: https://tanstack.com/query/v5/docs/framework/react/guides/paginated-queries
- MUI Pagination: https://mui.com/material-ui/react-pagination/
