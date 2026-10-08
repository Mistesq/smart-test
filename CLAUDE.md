@AGENTS.md

# smart-sender-test

Smart Sender senior frontend test assignment (React SPA). Product details: TODO, from `context/project-spec.md`.

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
