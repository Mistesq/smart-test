# Setup Phase 1 - App Shell, MSW Bootstrap & Test Tooling

## Overview

Turn the Vite scaffold into the app shell: providers, router with placeholder pages, MSW wiring for browser and Node, and the test/typecheck scripts every later spec relies on.

## Requirements

- `package.json` scripts: `typecheck` (`tsc -b`), `test` (`vitest run`), `test:watch` (`vitest`). Then update the Commands in `CLAUDE.md` to use them
- Vitest config: Node environment, setup file `src/test/setup.ts` that starts the `msw/node` server (`onUnhandledRequest: 'error'`), resets handlers after each test, closes after all
- MSW wiring: `src/mocks/handlers.ts` (exported empty array, filled by mock specs), `src/mocks/browser.ts` (`setupWorker`), `src/mocks/node.ts` (`setupServer`)
- `src/main.tsx`: start the worker (`onUnhandledRequest: 'bypass'`) before the first render, in dev AND production builds (A12). In dev mode only (`import.meta.env.DEV`), expose the worker as `window.__msw` (typed global declaration) so handlers can be overridden from the console
- `src/app/App.tsx`: MUI `ThemeProvider` + `CssBaseline`, `QueryClientProvider`, router. QueryClient defaults: `retry: false` for queries and mutations (the HTTP client owns retries), `refetchOnWindowFocus: false`
- `src/app/router.tsx`: `/login`, `/webhooks`, `/webhooks/:id/edit`, `/` → redirect to `/webhooks`, `*` → simple not-found page. Placeholder components for now
- Remove the scaffold demo from `App.tsx`, `App.css`, `index.css`. Ask before deleting asset files (`src/assets/*`, `public/icons.svg`)
- Fill `## File Organization` in `context/coding-standards.md` with the layout below

## Files to Create

```
src/app/App.tsx, router.tsx, queryClient.ts
src/mocks/handlers.ts, browser.ts, node.ts
src/test/setup.ts
vitest.config.ts (or a `test` block in vite.config.ts)
```

Target layout for later specs: `src/api/` (HTTP client, endpoints, Zod schemas), `src/mocks/` (handlers, db), `src/features/auth/`, `src/features/webhooks/`, `src/components/` (shared UI such as AppLayout).

## Notes

Use Context7 to verify the installed versions: Vitest 5, MSW 2.15, react-router 8.4, TanStack Query 5, MUI 9.

- `tsconfig.node.json` only includes `vite.config.ts`. Add `vitest.config.ts` there if you create it
- `msw/node` in `src/` may need Node types. If `npx tsc -b` fails, add a separate tsconfig for tests rather than adding `node` types to app code
- Node `fetch` rejects relative URLs. Plan for a configurable API base URL (empty in the browser, `http://localhost` in tests) and handler paths that match any origin (e.g. `'*/csrf'`). Verify how MSW 2 matches relative paths in Node
- No DOM environment is installed (no jsdom). Tests stay in Node
- react-router 8: import from `react-router`. Verify whether `RouterProvider` comes from `react-router` or `react-router/dom`

## Testing

1. `npm run typecheck`, `npm run lint`, `npm test` (passes with no tests or with a smoke test), `npm run build` all succeed
2. `npm run dev` → console shows `[MSW] Mocking enabled`
3. Open `/` → redirected to `/webhooks` placeholder. Open `/login` and `/foo` → login placeholder and not-found page
4. `npm run build && npm run preview` → MSW still starts

## References

- MSW browser integration: https://mswjs.io/docs/integrations/browser
- MSW Node integration: https://mswjs.io/docs/integrations/node
- Vitest config: https://vitest.dev/config/
- React Router: https://reactrouter.com/
- TanStack Query defaults: https://tanstack.com/query/v5/docs/framework/react/guides/important-defaults
