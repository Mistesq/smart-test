# Smart Sender webhooks

Test assignment for the Senior Frontend Engineer role at Smart Sender. A small React SPA where you sign in, browse webhooks and edit them. The API is fully mocked with [MSW](https://mswjs.io) and runs in the browser. The main subject is the client session: device-token login, a 30-second session with transparent rotate-and-retry, one shared rotate for parallel 401s, CSRF handling, list state kept in the URL, and server-side form errors.

## Quick start

Requirements: **Node `^20.19.0 || >=22.12.0`** (required by Vite 8) and npm.

```bash
npm install
npm run dev                        # dev server, Vite prints the URL (default http://localhost:5173)
npm run build && npm run preview   # production build (default http://localhost:4173)
```

Test credentials: **`admin@example.com` / `password123`**

MSW runs in the production build as well, because there is no real API.

## Tests

```bash
npm test
```

The required test is in [`src/api/session.test.ts`](src/api/session.test.ts):
`two parallel 401s share one rotate and both retries succeed`. It runs on the real mock handlers (`msw/node`) and mocks only `Date` to expire the session. To run only this test:

```bash
npm test -- src/api/session.test.ts -t "two parallel 401s share one rotate and both retries succeed"
```

Other checks: `npm run lint`, `npm run typecheck`.

## Architecture

```
src/
  api/        HTTP client, CSRF, session (rotate), endpoints, Zod response schemas, typed ApiError
  mocks/      MSW handlers + in-memory db, shared by the browser worker and the tests
  features/
    auth/     login page and flow, auth store, protected route, logout
    webhooks/ list (URL state, search, pagination) and edit page
  components/ app layout, not-found page
  lib/        form error mapping (422 → fields), route paths, list link state
  app/        providers, router, query client
```

Layers go one way: UI → TanStack Query hooks → `api/` functions → `request()`. Components never call `fetch`.

## Key decisions

- **One HTTP client** ([`src/api/httpClient.ts`](src/api/httpClient.ts)). `request()` is the only place that sends API requests, except the bootstrap `GET /csrf` in `csrf.ts`, which uses `fetch` directly to avoid recursion. It adds `X-Requested-With`, attaches `X-CSRF-TOKEN` on POST/PUT, validates the response with Zod and turns the error envelope into a typed `ApiError`. On 419 it refetches the CSRF token and retries once. On 401 it asks the session layer whether to retry.
- **Single-flight CSRF** ([`src/api/csrf.ts`](src/api/csrf.ts)). `GET /csrf` runs before the first API request and the token is cached in memory. Parallel callers share one fetch. On a 419, only the rejected token is invalidated, so parallel 419s also share one refetch.
- **Shared rotate + generation counter** ([`src/api/session.ts`](src/api/session.ts)). Every 401 awaits the same in-flight rotate promise, so parallel 401s cause exactly one `POST /auth/token/rotate`. Each request records the session generation it was sent under. A late 401 from an older generation is retried without another rotate. A failed rotate or a 401 on the retry ends the session: the query cache is cleared, and the user lands on the login page with a "session has expired" notice. After signing in they return to the original URL.
- **Auth endpoints are excluded from rotate.** A 401 on `/auth/*` never starts a rotate, so rotate cannot trigger rotate.
- **Tokens.** `device_session_token` exists only as a local variable in the sign-in flow (never in storage or the URL). The fingerprint is 32 hex chars in `localStorage`. Logout ends the local session first, then revokes it and clears the query cache.
- **The URL is the source of truth for the list.** `page` and `search` are read from the query string, so they survive reload and back/forward. Search is debounced by 300 ms, replaces the history entry and resets to page 1. A page change pushes a new entry. Invalid params fall back to defaults, and a page beyond the last one is replaced with the last page.
- **Zod at every boundary.** API responses, URL query and route params, router history state (redirect and return targets) and forms.
- **Edit is a separate page** (`/webhooks/:id/edit`). It handles 404, and Save and Cancel return to the list with its page and search. Server 422 errors are shown under the matching fields through one shared mapper. On the client, the form only checks that the fields are not empty. The http/https URL rule lives on the server, so the 422 path can be seen in the UI.
- **MSW in the production build.** The worker starts before React renders in both dev and `preview`. If it fails, the page shows an error instead of a broken app.
- **Chunks** ([`vite.config.ts`](vite.config.ts)). `react` (React, react-dom, react-router), `mui` (MUI + Emotion), `vendor` (the other libraries), the app code, and the mocks with MSW. The mocks chunk is loaded through a dynamic `import()` in `main.tsx`. The vendor groups take only modules loaded at startup, so MSW is not pulled into them.

## Known limitations

- **The mock db resets on page reload.** MSW runs in the page, so a reload loses the session and any edits. After signing in again you return to the URL you were on.
- **The session lives 30 s**, per the brief. Rotate is transparent: in the Network tab you will see `401 → POST /auth/token/rotate → retry`.
- **Unsaved form changes are lost if the session ends while you edit.** After signing in you return to the edit page, still linked to the same list page and search, but with the saved values.
- **`PUT /v1/webhooks/{id}` returns 404 for an unknown id.** The brief's contract does not list this response.
- **The captcha is a stub.** The client sends a static `X-Captcha-Token: test-captcha`, and the mock only checks that it is not empty.

All assumptions (A1-A14) and their alternatives are listed in [`context/project-overview.md`](context/project-overview.md#assumptions).

## How this was built

Developed with [Claude Code](https://claude.com/claude-code). The harness is part of the repo:

- [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md): commands, installed versions and a warning not to rely on remembered library APIs.
- [`context/`](context/): project overview (the brief broken down, plus assumptions), coding standards, workflow rules, and [`current-feature.md`](context/current-feature.md) with the history of every phase.
- [`context/features/`](context/features/): one spec per phase (setup → mock → api → auth → webhooks → delivery).
- [`.claude/`](.claude/): the `specs` and `feature` skills that drive the workflow, and the `code-scanner` review agent.

Each phase followed the cycle **specs → `/feature` (branch, implementation, tests, typecheck) → `code-scanner` audit → review → merge**. The decomposition, the session and retry design, the review and the verification are mine.

`.mcp.json` launches the Playwright MCP through `cmd /c` (Windows). On macOS/Linux, replace `"command": "cmd", "args": ["/c", "npx", ...]` with `"command": "npx", "args": ["@playwright/mcp@latest"]`. The app itself does not need it.
