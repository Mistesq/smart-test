@AGENTS.md

# smart-test

React SPA for browsing and editing webhooks against an API mocked with MSW. Product details: `context/project-overview.md`.

## Context Files

Read the following to get the full context of the project:

- @context/project-overview.md
- @context/coding-standards.md
- @context/ai-interaction.md
- @context/current-feature.md

## Commands

Package manager: **npm** (`package-lock.json`).

- **Dev server**: `npm run dev` (Vite)
- **Build**: `npm run build` (`tsc -b && vite build`)
- **Preview build**: `npm run preview`
- **Lint**: `npm run lint`
- **Typecheck**: `npm run typecheck` (`tsc -b`; root `tsconfig.json` only has project references, so plain `npx tsc --noEmit` checks nothing)
- **Test (once)**: `npm test` (`vitest run`)
- **Test (watch)**: `npm run test:watch`
