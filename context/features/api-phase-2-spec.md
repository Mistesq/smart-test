# API Phase 2 - Session Rotate & Auth Endpoints

## Overview

Add the session layer to the HTTP client: one shared rotate for concurrent 401s, one retry per request, session-expired signalling, the fingerprint, and the typed auth endpoints. Includes the one automated test the brief requires.

## Requirements

- `src/api/fingerprint.ts`: get-or-create 32 hex chars (16 bytes from `crypto.getRandomValues`, A5), stored in localStorage under one key. Storage is injectable or mockable for Node tests
- `src/api/auth.ts`: `login` (sends `X-Captcha-Token: test-captcha`, A4), `issueSession`, `rotateSession`, `revokeSession`, `getMe`. All send `fingerprint` per the contract. `User` Zod schema
- 401 on a non-`/auth/*` request → await the shared rotate, then retry ONCE. Requests to `/auth/*` skip this handler, so rotate never triggers rotate
- Shared rotate: one module-level in-flight promise. N parallel 401s → exactly one `POST /auth/token/rotate`
- Session generation counter: each request remembers the generation it was sent under. A 401 for an older generation retries without a new rotate
- Rotate failure (400 or any error) or a 401 on the retry → call the registered session-expired handler ONCE per expiry and reject with the 401 `ApiError`
- `setSessionExpiredHandler(fn)`: registration API for the auth UI (no React imports in `src/api/`)
- Required test plus failure-path tests in `src/api/session.test.ts`

## Files to Create

1. `src/api/session.ts`: shared rotate, generation counter, expired handler
2. `src/api/fingerprint.ts`
3. `src/api/auth.ts` (+ `User` schema)
4. `src/api/session.test.ts`
5. Update `src/api/httpClient.ts` to plug in the 401 handler

## Notes

- The required test is graded: name it clearly, e.g. `two parallel 401s share one rotate and both retries succeed`. Use the real mock handlers: `resetDb()` → login → issue → move time past 30 s → two parallel `GET /v1/webhooks` (or `/v1/me`) → assert one rotate call (count it in the handler or with a spy) and two 200 results
- Moving time: fake only `Date` (e.g. `vi.useFakeTimers({ toFake: ['Date'] })` or `vi.setSystemTime`) so promises and fetch keep working. Verify with Vitest 5 docs
- Do not store `device_session_token` anywhere: it is a return value passed straight into `issueSession`
- Retry limits are per request: at most one 419 retry and one 401 retry

## Testing

`npm test`:

1. Required: two parallel 401s → exactly one rotate → both requests resolve with 200
2. Rotate returns 400 → both requests reject with 401, expired handler called once
3. Retry also gets 401 → expired handler called, no second rotate
4. A 401 that arrives after a finished rotate (older generation) → retried without a new rotate
5. Fingerprint: 32 hex chars, same value on the second call

Also: `npm run typecheck` and `npm run lint` pass.

## References

- Vitest fake timers: https://vitest.dev/api/vi#vi-usefaketimers
- MSW in Vitest: https://mswjs.io/docs/integrations/node
- `crypto.getRandomValues`: https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues
