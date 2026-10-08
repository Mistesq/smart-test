# API Phase 1 - HTTP Client, CSRF & Typed Errors

## Overview

Build the single HTTP client that every request goes through: common headers, single-flight CSRF, one 419 retry, Zod-parsed responses and a typed `ApiError`. Leave a clear hook for the 401/rotate logic in API phase 2.

## Requirements

- `request()` in `src/api/httpClient.ts`: method, path, optional JSON body and query, a Zod schema for the response. Parses success bodies with the schema; 204 → `undefined`
- Every request sends `X-Requested-With: XMLHttpRequest`
- `src/api/csrf.ts`: `ensureCsrfToken()` with a single-flight promise. The first request triggers exactly one `GET /csrf`, parallel requests share it, and the token is cached in memory
- POST and PUT attach `X-CSRF-TOKEN`
- 419 → drop the cached token, fetch a new one, retry the request ONCE. A second 419 throws
- `src/api/errors.ts`: `ApiError` (`status`, `type`, `message`, `fieldErrors: Record<string, string[]>`) parsed from the envelope with Zod. An unparseable body still becomes an `ApiError` with a generic message. A network failure is a separate error type
- Configurable base URL (empty in the browser, absolute in tests)
- Unit tests in `src/api/httpClient.test.ts` against MSW handlers

## Files to Create

1. `src/api/httpClient.ts`: `request()` and the client config (base URL, hook point for 401 handling)
2. `src/api/csrf.ts`: token cache, single-flight fetch, `resetCsrfToken()`
3. `src/api/errors.ts`: `ApiError`, `NetworkError`, the envelope schema, `isApiError()`
4. `src/api/httpClient.test.ts`

## Notes

- `erasableSyntaxOnly` is on: no constructor parameter properties or enums in `ApiError`. Use plain fields and `as const` unions for error types
- No `any`: `request<T>` infers `T` from the passed Zod schema (`z.infer`)
- Keep retry counters per request call (a flag or attempt number), never global
- Do not implement 401 handling here. Expose a small, typed extension point (e.g. `onUnauthorized` option or wrapper) that API phase 2 plugs into
- Zod 4 API differs from v3. Verify with Context7

## Testing

`npm test` runs `src/api/httpClient.test.ts`:

1. Any request carries `X-Requested-With: XMLHttpRequest` (assert inside a handler)
2. Two parallel first requests → `/csrf` hit exactly once
3. POST carries `X-CSRF-TOKEN`. GET does not need it
4. Handler returns 419 once → client refetches CSRF and the retry succeeds. 419 twice → `ApiError` with status 419
5. 422 envelope → `ApiError.fieldErrors` equals the payload. A broken JSON body → generic `ApiError`

Also: `npm run typecheck` and `npm run lint` pass.

## References

- Zod 4: https://zod.dev/
- MSW in Vitest: https://mswjs.io/docs/integrations/node
- Vitest API: https://vitest.dev/api/
