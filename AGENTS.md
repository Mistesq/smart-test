<!-- BEGIN:ai-harness-rules -->
# This is NOT the library version you know

The framework and library versions in this repo may have **breaking changes** since your training cutoff. APIs, conventions, config files and file structure can all differ from what you remember.

Before writing code against a framework or library:

- Check the installed version in `package.json` (and the lockfile).
- Read the installed docs first when they ship in the package (e.g. `node_modules/next/dist/docs/` for Next.js), or fetch that exact version's docs (Context7 MCP or a targeted web search) before relying on remembered APIs.
- Heed deprecation notices in build, lint and test output.
- When a pattern in this repo looks unusual, do NOT assume it is wrong. Verify against the installed version first.

Stack notes for this repo (installed versions):

- **Vite 8.3** + `@vitejs/plugin-react` 6.1 (Oxc transform). Client-side SPA, no SSR.
- **React 19.3** / react-dom 19.3. React Compiler is not enabled.
- **TypeScript 6.0**: `strict` is on by default and also set explicitly in `tsconfig.app.json` / `tsconfig.node.json`. Project references: run `tsc -b`.
- **MUI (`@mui/material`) 9.4** with Emotion 11. Major version jumps since v5/v6, so check the v9 API before using Grid, system props, theming or slots.
- **react-router 8.4**: import from `react-router`, not `react-router-dom`.
- **@tanstack/react-query 5.104** for server state.
- **react-hook-form 7.89** + `@hookform/resolvers` 5.9 + **Zod 4.6**. The Zod 4 API differs from v3 (e.g. top-level `z.email()`, `error` param).
- **MSW 2.15**: browser worker in `public/mockServiceWorker.js`.
- **Vitest 5.0**, **ESLint 10** flat config with typescript-eslint 8.71.
<!-- END:ai-harness-rules -->
