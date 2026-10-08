# Current Feature: Setup Phase 1 - App Shell, MSW Bootstrap & Test Tooling

<!-- H1 gets the feature name when active, e.g. "# Current Feature: Add Navbar" -->

## Status

<!-- Not Started | In Progress | Complete -->

Complete

## Goals

<!-- Checklist of what success looks like, filled by `/feature load`. Each goal is checked off when done, so the list doubles as plan vs actual. -->

- [x] `package.json` scripts: `typecheck` (`tsc -b`), `test` (`vitest run`), `test:watch` (`vitest`); `CLAUDE.md` Commands updated to use them
- [x] Vitest config: Node environment, setup file `src/test/setup.ts` starts the `msw/node` server (`onUnhandledRequest: 'error'`), resets handlers after each test, closes after all
- [x] MSW wiring: `src/mocks/handlers.ts` (exported empty array), `src/mocks/browser.ts` (`setupWorker`), `src/mocks/node.ts` (`setupServer`)
- [x] `src/main.tsx` starts the worker (`onUnhandledRequest: 'bypass'`) before the first render, in dev AND production builds (A12); in dev only, exposes the worker as `window.__msw` with a typed global declaration
- [x] `src/app/App.tsx`: MUI `ThemeProvider` + `CssBaseline`, `QueryClientProvider`, router
- [x] `src/app/queryClient.ts`: `retry: false` for queries and mutations, `refetchOnWindowFocus: false`
- [x] `src/app/router.tsx`: `/login`, `/webhooks`, `/webhooks/:id/edit`, `/` → redirect to `/webhooks`, `*` → not-found page; placeholder components
- [x] Scaffold demo removed from `App.tsx`, `App.css`, `index.css` (ask before deleting `src/assets/*`, `public/icons.svg`)
- [x] `## File Organization` in `context/coding-standards.md` filled with the target layout

## Notes

<!-- Additional context, constraints, API contract, out of scope. -->

**Files to create:** `src/app/App.tsx`, `router.tsx`, `queryClient.ts`; `src/mocks/handlers.ts`, `browser.ts`, `node.ts`; `src/test/setup.ts`; `vitest.config.ts` (or a `test` block in `vite.config.ts`).

**Target layout for later specs:** `src/api/` (HTTP client, endpoints, Zod schemas), `src/mocks/` (handlers, db), `src/features/auth/`, `src/features/webhooks/`, `src/components/` (shared UI such as AppLayout).

**Gotchas:**

- Verify installed APIs with Context7: Vitest 5, MSW 2.15, react-router 8.4, TanStack Query 5, MUI 9
- `tsconfig.node.json` only includes `vite.config.ts`; add `vitest.config.ts` there if created
- `msw/node` in `src/` may need Node types. If `npx tsc -b` fails, add a separate tsconfig for tests instead of adding `node` types to app code
- Node `fetch` rejects relative URLs: plan a configurable API base URL (empty in the browser, `http://localhost` in tests) and handler paths matching any origin (e.g. `'*/csrf'`). Verify how MSW 2 matches relative paths in Node
- No jsdom installed; tests stay in Node
- react-router 8: import from `react-router`; verify whether `RouterProvider` comes from `react-router` or `react-router/dom`

**Decisions (confirmed before start):**

- Delete `src/assets/*` (`hero.png`, `react.svg`, `vite.svg`) and `public/icons.svg`; only the scaffold `App.tsx` uses them. Keep `public/favicon.svg`: `index.html` links it, so the favicon link stays as is
- `npm test` stays plain `vitest run`; add a smoke test (msw/node server starts, an unhandled request errors) instead of `--passWithNoTests`
- Separate `vitest.config.ts`, added to `tsconfig.node.json`
- Add one `API_BASE_URL` constant now (empty in the browser, `http://localhost` in tests); the HTTP client itself is api-phase-1

**Out of scope:** real handlers, HTTP client, auth, pages beyond placeholders.

**Testing (review checks against these):**

1. `npm run typecheck`, `npm run lint`, `npm test` (passes with no tests or a smoke test), `npm run build` all succeed
2. `npm run dev` → console shows `[MSW] Mocking enabled`
3. `/` → redirected to `/webhooks` placeholder; `/login` and `/foo` → login placeholder and not-found page
4. `npm run build && npm run preview` → MSW still starts

## History

<!-- Completed features, append only, oldest to newest. -->

- Project setup and boilerplate cleanup
